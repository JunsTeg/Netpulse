import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Device, NmapScanConfig, NmapScanResult, DEVICE_PORTS, DeviceType, DeviceStatus } from '../device.model';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as net from 'net';
import * as snmp from 'net-snmp';
import { sequelize } from '../../../database';
import { QueryTypes } from 'sequelize';

const execAsync = promisify(exec);

interface NetworkStats {
  bandwidth: number;
  latency: number;
  packetLoss: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface SNMPConfig {
  community: string;
  version: '1' | '2c';
  timeout: number;
  retries: number;
}

// Declaration des types pour net-snmp
declare module 'net-snmp' {
  export function createSession(target: string, community: string, options?: any): Session;
  
  interface Session {
    get(oids: string[], callback: (error: Error | null, varbinds: any[]) => void): void;
    close(): void;
  }
}

@Injectable()
export class NmapAgentService {
  private readonly logger = new Logger(NmapAgentService.name);
  private readonly snmpConfig: SNMPConfig = {
    community: 'public',
    version: '2c',
    timeout: 5000,
    retries: 1
  };

  async execute(config: NmapScanConfig, userId?: string): Promise<NmapScanResult> {
    const startTime = Date.now();
    const actionId = uuidv4();
    
    try {
      // Enregistrement de l'action dans l'historique
      await this.logAction(actionId, userId, 'network_scan_start', 'Démarrage du scan réseau');

      // Verification des outils necessaires
      const tools = await this.checkRequiredTools();
      if (!tools.allInstalled) {
        const error = new Error(`Outils manquants: ${tools.missing.join(', ')}`);
        await this.saveErrorLog('system', error, 'checkRequiredTools');
        throw error;
      }

      // 1. Scan rapide du reseau local uniquement
      const localNetwork = this.getLocalNetwork();
      await this.logAction(actionId, userId, 'network_scan', `Scan du réseau ${localNetwork}`);
      const nmapDevices = await this.executeQuickScan(localNetwork);
      this.logger.log(`[SCAN] Appareils trouves: ${nmapDevices.length}`);

      // 2. Enrichissement des informations de base
      const enrichedDevices = await this.enrichBasicInfo(nmapDevices);
      await this.logAction(actionId, userId, 'network_scan', `${enrichedDevices.length} appareils enrichis`);

      // 3. Collecte des statistiques pour chaque appareil
      for (const device of enrichedDevices) {
        try {
          const networkStats = await this.collectNetworkStatsWithSNMP(device.ipAddress);
          await this.saveNetworkStats(device.id, networkStats);
          await this.logAction(actionId, userId, 'device_stats_collected', `Stats collectées pour ${device.ipAddress}`);
          await this.saveScanLogs(device);
        } catch (error) {
          await this.saveErrorLog(device.id, error, 'deviceProcessing');
          this.logger.error(`[SCAN] Erreur traitement appareil ${device.ipAddress}: ${error.message}`);
        }
      }

      await this.logAction(actionId, userId, 'network_scan_complete', 
        `Scan terminé. ${enrichedDevices.length} appareils trouvés en ${Date.now() - startTime}ms`);

      return {
        success: true,
        devices: enrichedDevices,
        scanTime: new Date(),
        scanDuration: Date.now() - startTime
      };
      
    } catch (error) {
      await this.saveErrorLog('system', error, 'execute');
      this.logger.error(`[SCAN] Erreur scan: ${error.message}`);
      return {
        success: false,
        devices: [],
        error: error.message,
        scanTime: new Date(),
        scanDuration: Date.now() - startTime
      };
    }
  }

  private async logAction(actionId: string, userId: string | undefined, action: string, detail: string): Promise<void> {
    try {
      // Si pas d'ID utilisateur, on ne log pas l'action
      if (!userId) {
        this.logger.debug(`[HISTORIQUE] Pas d'ID utilisateur, action non loggee: ${action}`);
        return;
      }

      // Enregistrement uniquement des actions utilisateur dans l'historique
      if (action.startsWith('network_scan') || action === 'device_stats_collected') {
        await sequelize.query(
          `INSERT INTO historiques (
            id, userId, action, targetType, targetId,
            timestamp, detail, ipAddress
          ) VALUES (
            :id, :userId, :action, 'network', :targetId,
            CURRENT_TIMESTAMP, :detail, :ipAddress
          )`,
          {
            replacements: {
              id: uuidv4(),
              userId, // Utilisation directe de l'ID utilisateur
              action,
              targetId: actionId,
              detail,
              ipAddress: this.getLocalIP()
            },
            type: QueryTypes.INSERT
          }
        );
      }
    } catch (error) {
      this.logger.error(`[HISTORIQUE] Erreur enregistrement action: ${error.message}`);
    }
  }

  private async checkRequiredTools(): Promise<{ allInstalled: boolean; missing: string[] }> {
    const tools = ['nmap', 'ping'];
    const missing: string[] = [];

    for (const tool of tools) {
      try {
        if (tool === 'nmap') {
          await execAsync('nmap --version');
        } else if (tool === 'ping') {
          await execAsync('ping -n 1 127.0.0.1');
        }
      } catch (error) {
        missing.push(tool);
      }
    }

    return {
      allInstalled: missing.length === 0,
      missing
    };
  }

  private getLocalNetwork(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          // Retourne le sous-reseau /24
          const ipParts = iface.address.split('.');
          return `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/24`;
        }
      }
    }
    return '127.0.0.1/24';
  }

  private async executeQuickScan(network: string): Promise<Device[]> {
    try {
      // Commande nmap optimisee pour un scan rapide
      const isWindows = os.platform() === 'win32';
      const nmapCommand = isWindows 
        ? `nmap -sn --send-eth -T4 --max-retries 1 --host-timeout 5s ${network}`
        : `nmap -sn -T4 --max-retries 1 --host-timeout 5s ${network}`;
      
      const { stdout } = await execAsync(nmapCommand);
      return this.parseNmapOutput(stdout);
    } catch (error) {
      this.logger.error(`[SCAN] Erreur scan nmap: ${error.message}`);
      return [];
    }
  }

  private async enrichBasicInfo(devices: Device[]): Promise<Device[]> {
    const enrichedDevices = await Promise.all(devices.map(async (device) => {
      try {
        // Recuperation de l'adresse MAC
        const macAddress = await this.getMACAddress(device.ipAddress);
        
        // Detection du type d'appareil basée sur MAC
        const deviceType = this.detectDeviceType(macAddress);
        
        // Recuperation du hostname
        const hostname = await this.getHostname(device.ipAddress);

        // Creation d'un objet Device conforme au schema
        const enrichedDevice: Device = {
          ...device,
          hostname,
          macAddress,
          deviceType,
          os: 'Unknown', // Par defaut
          stats: {
            cpu: 0,
            memory: 0,
            uptime: '0',
            status: DeviceStatus.ACTIVE,
            services: []
          },
          lastSeen: new Date(),
          firstDiscovered: new Date()
          };

          return enrichedDevice;
      } catch (error) {
        this.logger.error(`[SCAN] Erreur enrichissement info ${device.ipAddress}: ${error.message}`);
        return device;
      }
    }));

    return enrichedDevices;
  }

  private async getMACAddress(ip: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`arp -a ${ip}`);
      const macMatch = stdout.match(/([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})/i);
        return macMatch ? macMatch[1].replace(/-/g, ':') : '';
    } catch (error) {
      this.logger.error(`[SCAN] Erreur recuperation MAC ${ip}: ${error.message}`);
      return '';
    }
  }

  private async getHostname(ipAddress: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`nslookup ${ipAddress}`);
      const match = stdout.match(/Name:\s*(.+)/);
      return match ? match[1].trim() : ipAddress;
    } catch (error) {
      return ipAddress;
    }
  }

  private detectDeviceType(macAddress: string): DeviceType {
    if (!macAddress) return DeviceType.OTHER;
    
    const macPrefix = macAddress.substring(0, 8).toUpperCase();
    
    // Detection basique du type d'appareil basé sur le prefixe MAC
    if (macPrefix.startsWith('00:50:56') || macPrefix.startsWith('00:0C:29')) {
      return DeviceType.SERVER;  // Machines virtuelles
    } else if (macPrefix.startsWith('B8:27:EB') || macPrefix.startsWith('DC:A6:32')) {
      return DeviceType.SERVER;  // Raspberry Pi
    } else if (macPrefix.startsWith('00:1A:79')) {
      return DeviceType.ROUTER;
    } else if (macPrefix.startsWith('00:1B:63') || macPrefix.startsWith('00:1C:B3')) {
      return DeviceType.SWITCH;
    } else if (macPrefix.startsWith('00:1A:2B') || macPrefix.startsWith('00:1C:0E')) {
      return DeviceType.AP;
    } else if (macPrefix.startsWith('00:1E:8C') || macPrefix.startsWith('00:1F:3F')) {
      return DeviceType.LAPTOP;
    } else if (macPrefix.startsWith('00:1D:7D') || macPrefix.startsWith('00:1F:5B')) {
      return DeviceType.DESKTOP;
    } else if (macPrefix.startsWith('00:1E:8C') || macPrefix.startsWith('00:1F:3F')) {
      return DeviceType.MOBILE;
    }
    
    return DeviceType.OTHER;
  }

  private parseNmapOutput(stdout: string): Device[] {
    const devices: Device[] = [];
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch && !this.isLocalhost(ipMatch[1])) {
        devices.push({
          id: uuidv4(),
          hostname: ipMatch[1],
          ipAddress: ipMatch[1],
          macAddress: '',
          os: 'Unknown',
          deviceType: DeviceType.OTHER,
          stats: {
            cpu: 0,
            memory: 0,
            uptime: '0',
            status: DeviceStatus.ACTIVE,
            services: []
          },
          lastSeen: new Date(),
          firstDiscovered: new Date()
        });
      }
    }
    
    return devices;
  }

  private isLocalhost(ip: string): boolean {
    return ip === '127.0.0.1' || ip === '::1' || ip === this.getLocalIP();
  }

  private getLocalIP(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  private async collectNetworkStatsWithSNMP(ip: string): Promise<NetworkStats> {
    try {
      // Tentative de collecte SNMP
      const session = snmp.createSession(ip, this.snmpConfig.community, {
        version: this.snmpConfig.version,
        timeout: this.snmpConfig.timeout,
        retries: this.snmpConfig.retries
      });

      const oids = [
        '1.3.6.1.2.1.25.3.3.1.2.1',  // CPU usage
        '1.3.6.1.2.1.25.2.3.1.6.1',  // Memory usage
        '1.3.6.1.2.1.2.2.1.10.1',    // Interface in octets
        '1.3.6.1.2.1.2.2.1.16.1'     // Interface out octets
      ];

      return new Promise(async (resolve, reject) => {
        session.get(oids, async (error, varbinds) => {
          session.close();
          
          if (error) {
            // Fallback sur ping si SNMP echoue
            this.logger.warn(`[SNMP] Erreur pour ${ip}, utilisation ping: ${error.message}`);
            try {
              const stats = await this.collectNetworkStats(ip);
              resolve(stats);
            } catch (err) {
              reject(err);
            }
            return;
          }

          // Traitement des resultats SNMP
          const [cpu, memory, inOctets, outOctets] = varbinds.map(v => v.value);
          
          // Mesure de la latence en complement
          const { stdout: pingOutput } = await execAsync(`ping -n 1 ${ip}`);
          const latency = this.parsePingLatency(pingOutput);
          const packetLoss = this.parsePingPacketLoss(pingOutput);

          resolve({
            cpuUsage: cpu || 0,
            memoryUsage: memory || 0,
            bandwidth: (inOctets + outOctets) || 0,
            latency,
            packetLoss
          });
        });
      });
    } catch (error) {
      this.logger.error(`[SNMP] Erreur session ${ip}: ${error.message}`);
      // Fallback sur la methode ping
      return this.collectNetworkStats(ip);
    }
  }

  private async collectNetworkStats(ip: string): Promise<NetworkStats> {
    try {
      // Mesure de la latence et perte de paquets
      const { stdout: pingOutput } = await execAsync(`ping -n 4 ${ip}`);
      const latency = this.parsePingLatency(pingOutput);
      const packetLoss = this.parsePingPacketLoss(pingOutput);

      // Mesure de la bande passante (simplifiee)
      const bandwidth = await this.measureBandwidth(ip);

      // Mesure CPU et memoire (simplifiee)
      const { cpuUsage, memoryUsage } = await this.measureResourceUsage(ip);

      return {
        bandwidth,
        latency,
        packetLoss,
        cpuUsage,
        memoryUsage
      };
    } catch (error) {
      this.logger.error(`[SCAN] Erreur collecte stats ${ip}: ${error.message}`);
      return {
        bandwidth: 0,
        latency: 0,
        packetLoss: 100,
        cpuUsage: 0,
        memoryUsage: 0
      };
    }
  }

  private async saveNetworkStats(deviceId: string, stats: NetworkStats): Promise<void> {
    try {
      await sequelize.query(
        `INSERT INTO statistiques_reseau (
          id, deviceId, bandwidth, latency, packetLoss,
          cpuUsage, memoryUsage, timestamp, intervalLabel
        ) VALUES (
          :id, :deviceId, :bandwidth, :latency, :packetLoss,
          :cpuUsage, :memoryUsage, CURRENT_TIMESTAMP, '1m'
        )`,
        {
          replacements: {
            id: uuidv4(),
            deviceId,
            ...stats
          },
          type: QueryTypes.INSERT
        }
      );
    } catch (error) {
      this.logger.error(`[SCAN] Erreur sauvegarde stats ${deviceId}: ${error.message}`);
    }
  }

  private async saveErrorLog(deviceId: string, error: Error, context: string): Promise<void> {
    try {
      await sequelize.query(
        `INSERT INTO journaux (
          id, deviceId, port, protocol, timestamp,
          rawData, parsedData, logType, severity
        ) VALUES (
          :id, :deviceId, NULL, 'error', CURRENT_TIMESTAMP,
          :rawData, :parsedData, 'error', 'error'
        )`,
        {
          replacements: {
            id: uuidv4(),
            deviceId,
            rawData: JSON.stringify({
              error: error.message,
              stack: error.stack,
              context,
              timestamp: new Date()
            }),
            parsedData: JSON.stringify({
              errorType: error.name,
              message: error.message,
              context
            })
          },
          type: QueryTypes.INSERT
        }
      );
    } catch (err) {
      this.logger.error(`[JOURNAL] Erreur sauvegarde log erreur: ${err.message}`);
    }
  }

  private async saveScanLogs(device: Device): Promise<void> {
    try {
      // Enregistrement des logs techniques dans journaux
      await sequelize.query(
        `INSERT INTO journaux (
          id, deviceId, port, protocol, timestamp,
          rawData, parsedData, logType, severity
        ) VALUES (
          :id, :deviceId, NULL, 'scan', CURRENT_TIMESTAMP,
          :rawData, :parsedData, 'network_scan', 'info'
        )`,
        {
          replacements: {
            id: uuidv4(),
            deviceId: device.id,
            rawData: JSON.stringify({
              scanType: 'quick',
              scanTime: new Date(),
              deviceInfo: {
                ip: device.ipAddress,
                mac: device.macAddress,
                type: device.deviceType,
                os: device.os
              },
              technicalDetails: {
                services: device.stats.services
              }
            }),
            parsedData: JSON.stringify({
              status: device.stats.status,
              deviceType: device.deviceType,
              scanResult: 'success',
              metrics: {
                cpu: device.stats.cpu,
                memory: device.stats.memory,
                uptime: device.stats.uptime
              }
            })
          },
          type: QueryTypes.INSERT
        }
      );
    } catch (error) {
      await this.saveErrorLog(device.id, error, 'saveScanLogs');
    }
  }

  private parsePingLatency(pingOutput: string): number {
    try {
      const match = pingOutput.match(/Average = (\d+)ms/);
      return match ? parseInt(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  private parsePingPacketLoss(pingOutput: string): number {
    try {
      const match = pingOutput.match(/(\d+)% loss/);
      return match ? parseInt(match[1]) : 100;
    } catch {
      return 100;
    }
  }

  private async measureBandwidth(ip: string): Promise<number> {
    try {
      // Simulation simple de mesure de bande passante
      const startTime = Date.now();
      await execAsync(`ping -n 1 -l 1024 ${ip}`);
      const duration = Date.now() - startTime;
      // Calcul simplifie: 1KB / duration en ms
      return duration > 0 ? (1024 / duration) * 1000 : 0;
    } catch {
      return 0;
    }
  }

  private async measureResourceUsage(ip: string): Promise<{ cpuUsage: number; memoryUsage: number }> {
    try {
      const session = snmp.createSession(ip, this.snmpConfig.community, {
        version: this.snmpConfig.version,
        timeout: this.snmpConfig.timeout,
        retries: this.snmpConfig.retries
      });

      const oids = [
        '1.3.6.1.2.1.25.3.3.1.2.1',  // CPU usage
        '1.3.6.1.2.1.25.2.3.1.6.1'   // Memory usage
      ];

      return new Promise((resolve, reject) => {
        session.get(oids, (error, varbinds) => {
          session.close();
          
          if (error) {
            this.logger.warn(`[SNMP] Erreur ressources ${ip}: ${error.message}`);
            resolve({ cpuUsage: 0, memoryUsage: 0 });
            return;
          }

          resolve({
            cpuUsage: varbinds[0].value || 0,
            memoryUsage: varbinds[1].value || 0
          });
        });
      });
    } catch (error) {
      this.logger.error(`[SNMP] Erreur session ressources ${ip}: ${error.message}`);
      return { cpuUsage: 0, memoryUsage: 0 };
    }
  }
} 
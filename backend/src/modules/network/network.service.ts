import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Device, NmapScanConfig, DeviceStats, CreateDeviceDto, UpdateDeviceDto, DeviceType, DeviceStatus, ServiceInfo } from './device.model';
import { sequelize } from '../../database';
import { QueryTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as net from 'net';
import { execAsync } from '../../utils/exec-async';
import { NmapAgentService } from './agents/nmap.service';
import { TracerouteAgentService } from './agents/traceroute.service';
import { NetstatAgentService } from './agents/netstat.service';
import { NetworkTopologyData, NetworkTopologyRecord } from './network.types';
import * as dns from 'dns';

interface BandwidthStats {
  avg_download: number;
  avg_upload: number;
}

interface TrafficStats {
  protocol: string;
  port: number;
  total_bytes: number;
  connection_count: number;
}

interface DeviceStatsResult {
  hostname: string;
  total_traffic: number;
  connection_count: number;
  last_seen: Date;
}

interface NetworkInterface {
  name: string;
  type: 'Wi-Fi' | 'Ethernet';
  ip: string;
  netmask: string;
  gateway: string;
  isActive: boolean;
  metrics: {
    latency: number;
    packetLoss: number;
    bandwidth: number;
    score: number;
  };
}

interface NetworkConnection {
  interface: string;
  localIP: string;
  remoteIP: string;
  type: 'Wi-Fi' | 'Ethernet';
  connectionType: 'LAN' | 'WAN';
  isActive: boolean;
  lastSeen: Date;
  metrics: {
    bandwidth: {
      download: number;  // en Mbps
      upload: number;    // en Mbps
    };
    latency: number;     // en ms
    packetLoss: number;  // en %
  };
}

interface ExternalDevice {
  ip: string;
  mac: string;
  hostname: string;
  vendor: string;
  os: string;
  services: {
    port: number;
    protocol: string;
    service: string;
    version?: string;
  }[];
  connectionType: 'LAN' | 'WAN';
  lastSeen: Date;
  metrics: {
    bandwidth: {
      download: number;
      upload: number;
    };
    latency: number;
    packetLoss: number;
  };
}

interface NetworkDeviceInfo {
  id: string;
  ip: string;
  mac: string;
  hostname: string;
  vendor: string;
  os: string;
  type: string;
  stats: {
    cpu: number;
    memory: number;
    uptime: string;
    bandwidth: {
      download: number;
      upload: number;
    };
    latency: number;
    packetLoss: number;
  };
  connections: {
    local: string[];  // IPs des équipements locaux connectés
    external: string[]; // IPs des connexions externes
  };
  services: {
    port: number;
    protocol: string;
    service: string;
    version?: string;
  }[];
}

interface NetworkTopology {
  devices: {
    id: string;
    ip: string;
    type: DeviceType;
    connections: {
      target: string;
      type: 'LAN' | 'WAN';
      metrics: {
        bandwidth: number;
        latency: number;
        packetLoss: number;
      };
    }[];
  }[];
  connections: {
    source: string;
    target: string;
    type: 'LAN' | 'WAN';
    metrics: {
      bandwidth: number;
      latency: number;
      packetLoss: number;
    };
  }[];
  stats: {
    totalDevices: number;
    activeDevices: number;
    averageLatency: number;
    averagePacketLoss: number;
    totalBandwidth: {
      download: number;
      upload: number;
    };
  };
}

@Injectable()
export class NetworkService {
  private readonly logger = new Logger(NetworkService.name);

  constructor(
    private readonly nmapAgent: NmapAgentService,
    private readonly tracerouteAgent: TracerouteAgentService,
    private readonly netstatAgent: NetstatAgentService,
  ) {}

  async getNetworkStats(timeRange: string): Promise<any> {
    try {
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default: // 24h
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const bandwidthStats = await this.getBandwidthStats(startDate);
      const trafficStats = await this.getTrafficStats(startDate);
      const deviceStats = await this.getDeviceStatsList(startDate);

      return {
        bandwidth: bandwidthStats,
        traffic: trafficStats,
        devices: deviceStats
      };
    } catch (error) {
      this.logger.error(`Erreur recuperation stats: ${error.message}`);
      throw error;
    }
  }

  private async getBandwidthStats(startDate: Date): Promise<any> {
    try {
      const [download, upload] = await Promise.all([
        sequelize.query<BandwidthStats>(
          'SELECT AVG(download_speed) as avg_download FROM network_stats WHERE timestamp >= ?',
          {
            replacements: [startDate],
            type: QueryTypes.SELECT
          }
        ),
        sequelize.query<BandwidthStats>(
          'SELECT AVG(upload_speed) as avg_upload FROM network_stats WHERE timestamp >= ?',
          {
            replacements: [startDate],
            type: QueryTypes.SELECT
          }
        )
      ]);

      const latency = await this.measureLatency();
      const packetLoss = await this.measurePacketLoss();

      return {
        download: download[0]?.avg_download || 0,
        upload: upload[0]?.avg_upload || 0,
        latency,
        packetLoss
      };
    } catch (error) {
      this.logger.error(`Erreur stats bande passante: ${error.message}`);
      return {
        download: 0,
        upload: 0,
        latency: 0,
        packetLoss: 0
      };
    }
  }

  private async getTrafficStats(startDate: Date): Promise<any[]> {
    try {
      const traffic = await sequelize.query<TrafficStats>(
        `SELECT 
          protocol,
          port,
          SUM(bytes_sent + bytes_received) as total_bytes,
          COUNT(*) as connection_count
        FROM network_traffic 
        WHERE timestamp >= ?
        GROUP BY protocol, port
        ORDER BY total_bytes DESC
        LIMIT 10`,
        {
          replacements: [startDate],
          type: QueryTypes.SELECT
        }
      );

      const totalBytes = traffic.reduce((sum, item) => sum + Number(item.total_bytes), 0);

      return traffic.map(item => ({
        protocol: item.protocol,
        port: item.port,
        bytes: Number(item.total_bytes),
        percentage: totalBytes > 0 ? (Number(item.total_bytes) / totalBytes) * 100 : 0
      }));
    } catch (error) {
      this.logger.error(`Erreur stats trafic: ${error.message}`);
      return [];
    }
  }

  private async getDeviceStatsList(startDate: Date): Promise<any[]> {
    try {
      const devices = await sequelize.query<DeviceStatsResult>(
        `SELECT 
          a.*,
          COUNT(DISTINCT nt.id) as connection_count,
          SUM(nt.bytes_sent + nt.bytes_received) as total_traffic
        FROM appareils a
        LEFT JOIN network_traffic nt ON a.ip_address = nt.device_ip
        WHERE a.last_seen >= ?
        GROUP BY a.id
        ORDER BY total_traffic DESC`,
        {
          replacements: [startDate],
          type: QueryTypes.SELECT
        }
      );

      return devices.map(device => ({
        hostname: device.hostname,
        traffic: Number(device.total_traffic) || 0,
        connections: Number(device.connection_count) || 0,
        status: this.getDeviceStatus(device.last_seen)
      }));
    } catch (error) {
      this.logger.error(`Erreur stats appareils: ${error.message}`);
      return [];
    }
  }

  // Methode publique pour obtenir les stats d'un appareil specifique
  async getDeviceStats(deviceId: string, interval: string = '1h'): Promise<any[]> {
    try {
      const startDate = this.getStartDateFromInterval(interval);
      const stats = await sequelize.query(
        `SELECT * FROM statistiques_reseau 
         WHERE deviceId = ? AND timestamp >= ?
         ORDER BY timestamp DESC`,
        {
          replacements: [deviceId, startDate],
          type: QueryTypes.SELECT
        }
      );
      return stats;
    } catch (error) {
      this.logger.error(`Erreur recuperation stats appareil: ${error.message}`);
      return [];
    }
  }

  private getStartDateFromInterval(interval: string): Date {
    const now = new Date();
    switch (interval) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 60 * 60 * 1000);
    }
  }

  private async measureLatency(): Promise<number> {
    try {
      const gateway = await this.getDefaultGateway();
      if (!gateway) return 0;

      const { stdout } = await execAsync(`ping -n 4 ${gateway}`);
      const match = stdout.match(/Moyenne = (\d+)ms/);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      this.logger.error(`Erreur mesure latence: ${error.message}`);
      return 0;
    }
  }

  private async measurePacketLoss(): Promise<number> {
    try {
      const gateway = await this.getDefaultGateway();
      if (!gateway) return 100;

      const { stdout } = await execAsync(`ping -n 10 ${gateway}`);
      const match = stdout.match(/(\d+)% de perte/);
      return match ? parseInt(match[1]) : 100;
    } catch (error) {
      this.logger.error(`Erreur mesure perte paquets: ${error.message}`);
      return 100;
    }
  }

  private getDeviceStatus(lastSeen: Date): DeviceStatus {
    const now = new Date();
    const diffMinutes = (now.getTime() - new Date(lastSeen).getTime()) / (1000 * 60);
    
    if (diffMinutes < 5) return DeviceStatus.ACTIVE;
    if (diffMinutes < 30) return DeviceStatus.WARNING;
    return DeviceStatus.INACTIVE;
  }

  private async getDefaultGateway(): Promise<string> {
    try {
      if (os.platform() === 'win32') {
        const { stdout } = await execAsync('ipconfig | findstr /i "Default Gateway"');
        const match = stdout.match(/Default Gateway[^:]*:\s*([\d\.]+)/i);
        return match ? match[1] : '';
      } else {
        const { stdout } = await execAsync('ip route | grep default');
        const match = stdout.match(/default via ([\d\.]+)/);
        return match ? match[1] : '';
      }
    } catch (error) {
      this.logger.error(`Erreur recuperation passerelle: ${error.message}`);
      return '';
    }
  }

  // Methode pour lancer un scan complet du reseau
  async scanNetwork(target: string, userId?: string): Promise<{
    network: {
      startIP: string;
      endIP: string;
      gateway: string;
      netmask: string;
    };
    devices: Device[];
    topology: NetworkTopologyData;
  }> {
    try {
      this.logger.log('[SCAN] Debut scan reseau pour:', target);

      // Obtenir les informations du reseau
      const networkInfo = await this.getCurrentNetworkInfo();
      const broadcastAddress = this.calculateBroadcastAddress(networkInfo.startIP, networkInfo.netmask);

      // 1. Detection du reseau local
      const localDevices = await this.detectLocalDevices();
      this.logger.log(`[SCAN] ${localDevices.length} equipements locaux detectes`);

      // 3. Pour chaque equipement detecte
      const devices: Device[] = [];
      const connections: NetworkTopologyData['connections'] = [];
      
      for (const device of localDevices) {
        try {
          // Collecte des informations de base
          const deviceInfo: Device = {
            id: uuidv4(),
            hostname: device.hostname,
            ipAddress: device.ip,
            macAddress: device.mac,
            os: device.os,
            deviceType: await this.detectDeviceTypeFromMAC(device.mac),
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

          // Tentative de collecte des stats via SNMP
          try {
            const snmpStats = await this.collectNetworkStatsWithSNMP(device.ip);
            deviceInfo.stats = {
              cpu: snmpStats.cpuUsage,
              memory: snmpStats.memoryUsage,
              uptime: snmpStats.uptime || '0',
              status: snmpStats.status || DeviceStatus.ACTIVE,
              services: []
            };
          } catch (error) {
            this.logger.warn(`[SCAN] SNMP non disponible pour ${device.ip}, utilisation des stats de base`);
          }

          // Detection des connexions de l'equipement
          const deviceConnections = await this.detectDeviceConnections(device.ip);
          
          // Ajout des connexions a la topologie
          for (const localIP of deviceConnections.local) {
            if (localDevices.some(d => d.ip === localIP)) {
              const connectionMetrics = await this.measureConnectionMetrics(device.ip, localIP);
              connections.push({
                source: device.ip,
                target: localIP,
                type: 'LAN' as const,
                metrics: connectionMetrics
              });
            }
          }

          devices.push(deviceInfo);
          this.logger.log(`[SCAN] Informations collectees pour ${device.ip}:`, deviceInfo);

        } catch (error) {
          this.logger.error(`[SCAN] Erreur collecte infos pour ${device.ip}: ${error.message}`);
        }
      }

      // 4. Creation de la topologie
      const topology: NetworkTopologyData = {
        devices: devices.map(d => ({
          id: d.id,
          ip: d.ipAddress,
          type: d.deviceType as DeviceType,
          connections: connections
            .filter(c => c.source === d.ipAddress || c.target === d.ipAddress)
            .map(c => ({
              target: c.source === d.ipAddress ? c.target : c.source,
              type: c.type,
              metrics: c.metrics
            }))
        })),
        connections,
        stats: {
          totalDevices: devices.length,
          activeDevices: devices.filter(d => d.stats.status === DeviceStatus.ACTIVE).length,
          averageLatency: this.calculateAverageLatency(connections),
          averagePacketLoss: this.calculateAveragePacketLoss(connections),
          totalBandwidth: {
            download: connections.reduce((acc, conn) => acc + conn.metrics.bandwidth, 0),
            upload: connections.reduce((acc, conn) => acc + conn.metrics.bandwidth, 0)
          }
        }
      };

      // 5. Sauvegarde de la topologie
      const topologyRecord = {
        id: uuidv4(),
        name: `Topologie ${new Date().toISOString()}`,
        data: JSON.stringify(topology),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await sequelize.query(
        `INSERT INTO topologie_reseau (
          id, name, data, isActive, createdAt, updatedAt
        ) VALUES (
          :id, :name, :data, :isActive, :createdAt, :updatedAt
        )`,
        {
          replacements: topologyRecord,
          type: QueryTypes.INSERT,
        }
      );

      this.logger.log('[SCAN] Scan reseau termine avec succes');
      return {
        network: {
          startIP: networkInfo.startIP,
          endIP: broadcastAddress,
          gateway: networkInfo.gateway,
          netmask: networkInfo.netmask
        },
        devices,
        topology
      };

    } catch (error) {
      this.logger.error('[SCAN] Erreur scan reseau:', error);
      throw error;
    }
  }

  private async detectDeviceConnections(deviceIP: string): Promise<{ local: string[]; external: string[] }> {
    try {
      const connections = { local: [], external: [] };
      
      // Utilisation de netstat pour detecter les connexions
      const { stdout } = await execAsync(`netstat -n -b | findstr ${deviceIP}`);
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        const match = line.match(/TCP\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+\s+ESTABLISHED/);
        if (match) {
          const [_, localIP, remoteIP] = match;
          if (localIP === deviceIP) {
            if (this.isLocalIP(remoteIP)) {
              connections.local.push(remoteIP);
            } else {
              connections.external.push(remoteIP);
            }
          }
        }
      }
      
      return connections;
    } catch (error) {
      this.logger.error(`[CONNECTIONS] Erreur detection connexions pour ${deviceIP}: ${error.message}`);
      return { local: [], external: [] };
    }
  }

  private async measureConnectionMetrics(sourceIP: string, targetIP: string): Promise<{
    bandwidth: number;
    latency: number;
    packetLoss: number;
  }> {
    try {
      const { latency, packetLoss } = await this.testInterfaceConnectivity(targetIP);
      const bandwidth = await this.testBandwidth(targetIP);
      
      return {
        bandwidth: (bandwidth.download + bandwidth.upload) / 2,
        latency,
        packetLoss
      };
    } catch (error) {
      this.logger.error(`[METRICS] Erreur mesure metriques ${sourceIP} -> ${targetIP}: ${error.message}`);
      return {
        bandwidth: 0,
        latency: 999,
        packetLoss: 100
      };
    }
  }

  private calculateAverageLatency(connections: any[]): number {
    if (connections.length === 0) return 0;
    return connections.reduce((acc, conn) => acc + conn.metrics.latency, 0) / connections.length;
  }

  private calculateAveragePacketLoss(connections: any[]): number {
    if (connections.length === 0) return 0;
    return connections.reduce((acc, conn) => acc + conn.metrics.packetLoss, 0) / connections.length;
  }

  private async saveNetworkTopology(topology: NetworkTopologyData): Promise<void> {
    try {
      await sequelize.query(
        `INSERT INTO topologie_reseau (
          data, isActive, createdAt, updatedAt
        ) VALUES (
          :data, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`,
        {
          replacements: {
            data: JSON.stringify(topology)
          },
          type: QueryTypes.INSERT,
        }
      );
    } catch (error) {
      this.logger.error('[TOPOLOGY] Erreur sauvegarde topologie:', error);
      throw error;
    }
  }

  // Methode pour recuperer tous les appareils
  async getAllDevices(): Promise<Device[]> {
    try {
      const devices = await sequelize.query<Device>(
        'SELECT * FROM appareils ORDER BY lastSeen DESC',
        {
          type: QueryTypes.SELECT,
        }
      );

      return devices.map(device => {
        try {
          let stats: DeviceStats;
          if (typeof device.stats === 'string') {
            const parsedStats = JSON.parse(device.stats);
            stats = {
              cpu: parsedStats.cpu || 0,
              memory: parsedStats.memory || 0,
              uptime: parsedStats.uptime || '0',
              status: parsedStats.status || DeviceStatus.INACTIVE,
              services: (parsedStats.services || []).map((s: any): ServiceInfo => ({
                port: s.port || 0,
                protocol: s.protocol || 'tcp',
                service: s.service || '',
                version: s.version
              }))
            };
          } else if (device.stats && typeof device.stats === 'object') {
            const deviceStats = device.stats as any;
            stats = {
              cpu: deviceStats.cpu || 0,
              memory: deviceStats.memory || 0,
              uptime: deviceStats.uptime || '0',
              status: deviceStats.status || DeviceStatus.INACTIVE,
              services: (deviceStats.services || []).map((s: any): ServiceInfo => ({
                port: s.port || 0,
                protocol: s.protocol || 'tcp',
                service: s.service || '',
                version: s.version
              }))
            };
          } else {
            stats = {
              cpu: 0,
              memory: 0,
              uptime: '0',
              status: DeviceStatus.INACTIVE,
              services: []
            };
          }

          return {
            ...device,
            stats
          } as Device;
        } catch (err) {
          this.logger.warn(`[BACKEND] Erreur parsing stats pour l'appareil ${device.id}: ${err.message}`);
          return {
            ...device,
            stats: {
              cpu: 0,
              memory: 0,
              uptime: '0',
              status: DeviceStatus.INACTIVE,
              services: []
            }
          } as Device;
        }
      });
    } catch (error) {
      this.logger.error(`Erreur recuperation appareils: ${error.message}`);
      throw error;
    }
  }

  // Methode pour recuperer un appareil par son ID
  async getDeviceById(id: string): Promise<Device> {
    try {
      const devices = await sequelize.query<Device>(
        'SELECT * FROM appareils WHERE id = :id',
        {
          replacements: { id },
          type: QueryTypes.SELECT,
        }
      );

      if (devices.length === 0) {
        throw new Error('Appareil non trouve');
      }

      return {
        ...devices[0],
        stats: JSON.parse(devices[0].stats as unknown as string) as DeviceStats
      };
    } catch (error) {
      this.logger.error(`Erreur recuperation appareil: ${error.message}`);
      throw error;
    }
  }

  // Methode pour recuperer la derniere topologie
  async getLatestTopology(): Promise<NetworkTopologyRecord | null> {
    try {
      const results = await sequelize.query<NetworkTopologyRecord>(
        'SELECT * FROM topologie_reseau WHERE isActive = true ORDER BY createdAt DESC LIMIT 1',
        {
          type: QueryTypes.SELECT
        }
      );

      return results[0] || null;
    } catch (error) {
      this.logger.error(`[TOPOLOGY] Erreur recuperation topologie: ${error.message}`);
      throw error;
    }
  }

  // Nouvelle methode pour obtenir la table ARP
  private async getARPTable(): Promise<{ ip: string; mac: string }[]> {
    try {
      let command = '';
      let parseOutput: (output: string) => { ip: string; mac: string }[];

      if (os.platform() === 'win32') {
        command = 'arp -a';
        parseOutput = (output: string) => {
          const lines = output.split('\n');
          const devices: { ip: string; mac: string }[] = [];
          
          for (const line of lines) {
            // Format Windows: " 192.168.1.1   00-11-22-33-44-55     dynamique"
            const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+([0-9A-Fa-f-]+)/);
            if (match && match[1] !== '0.0.0.0') {
              devices.push({
                ip: match[1],
                mac: match[2].replace(/-/g, ':').toLowerCase()
              });
            }
          }
          return devices;
        };
      } else {
        command = 'arp -n';
        parseOutput = (output: string) => {
          const lines = output.split('\n');
          const devices: { ip: string; mac: string }[] = [];
          
          for (const line of lines) {
            // Format Linux: "192.168.1.1 ether 00:11:22:33:44:55 C eth0"
            const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+ether\s+([0-9a-f:]+)/i);
            if (match && match[1] !== '0.0.0.0') {
              devices.push({
                ip: match[1],
                mac: match[2].toLowerCase()
              });
            }
          }
          return devices;
        };
      }

      const { stdout } = await execAsync(command);
      this.logger.log('[ARP] Table ARP recuperee:', stdout);
      
      const devices = parseOutput(stdout);
      this.logger.log('[ARP] Appareils detectes:', devices);
      
      return devices;
    } catch (error) {
      this.logger.error(`[ARP] Erreur recuperation table ARP: ${error.message}`);
      throw error;
    }
  }

  private async testBandwidth(ip: string): Promise<{ download: number; upload: number }> {
    try {
      this.logger.log(`[BANDWIDTH] Debut test bande passante pour ${ip}`);
      
      // Test de latence d'abord pour verifier la connectivite
      const { latency, packetLoss } = await this.testInterfaceConnectivity(ip);
      if (packetLoss === 100 || latency > 1000) {
        this.logger.warn(`[BANDWIDTH] Connectivite insuffisante pour ${ip} (latence: ${latency}ms, perte: ${packetLoss}%)`);
        return { download: 0, upload: 0 };
      }

      // Test de download avec un fichier de test local
      const downloadStart = Date.now();
      const testFileSize = 1024 * 1024; // 1MB
      const testFilePath = 'test_bandwidth.tmp';
      
      try {
        // Creation d'un fichier de test
        await execAsync(`fsutil file createnew ${testFilePath} ${testFileSize}`);
        
        // Test de transfert local (simulation)
        const downloadTime = (Date.now() - downloadStart) / 1000; // en secondes
        const downloadSpeed = downloadTime > 0 ? (testFileSize * 8) / (downloadTime * 1000000) : 0; // Mbps
        
        // Nettoyage
        await execAsync(`del ${testFilePath}`);
        
        // Estimation de la bande passante reelle basee sur la latence
        const estimatedDownload = Math.max(0, 100 - (latency / 10)) * (downloadSpeed / 100);
        const estimatedUpload = estimatedDownload * 0.8; // Upload typiquement 80% du download
        
        this.logger.log(`[BANDWIDTH] Test complete pour ${ip}:`, {
          download: Math.round(estimatedDownload * 100) / 100,
          upload: Math.round(estimatedUpload * 100) / 100,
          latency,
          packetLoss
        });
        
        return {
          download: Math.round(estimatedDownload * 100) / 100,
          upload: Math.round(estimatedUpload * 100) / 100
        };
      } catch (error) {
        this.logger.error(`[BANDWIDTH] Erreur test transfert pour ${ip}: ${error.message}`);
        return { download: 0, upload: 0 };
      }
    } catch (error) {
      this.logger.error(`[BANDWIDTH] Erreur test bande passante pour ${ip}: ${error.message}`);
      return { download: 0, upload: 0 };
    }
  }

  private async testInterfaceConnectivity(ip: string): Promise<{ latency: number; packetLoss: number }> {
    try {
      this.logger.log(`[TEST] Debut test connectivite pour ${ip}`);
      
      // Test TCP en premier (plus fiable que ICMP)
      const tcpTest = await this.testTCPConnectivity(ip);
      if (tcpTest.success) {
        this.logger.log(`[TEST] Test TCP reussi pour ${ip} (latence: ${tcpTest.latency}ms)`);
        return {
          latency: tcpTest.latency,
          packetLoss: 0
        };
      }

      // Si TCP echoue, essayer ICMP comme fallback
      try {
        const { stdout } = await execAsync(`ping -n 4 ${ip}`, { timeout: 5000 });
        const latency = this.parsePingLatency(stdout);
        const packetLoss = this.parsePingPacketLoss(stdout);
        
        this.logger.log(`[TEST] Test ICMP pour ${ip}:`, { latency, packetLoss });
        return { latency, packetLoss };
      } catch (pingError) {
        this.logger.warn(`[TEST] Test ICMP echoue pour ${ip}, utilisation des valeurs TCP`);
        return {
          latency: tcpTest.latency || 999,
          packetLoss: 100
        };
      }
    } catch (error) {
      this.logger.error(`[TEST] Erreur test connectivite ${ip}: ${error.message}`);
      return { latency: 999, packetLoss: 100 };
    }
  }

  private async testTCPConnectivity(ip: string): Promise<{ success: boolean; latency: number }> {
    const ports = [80, 443, 22]; // Ports communs a tester
    const startTime = Date.now();
    
    for (const port of ports) {
      try {
        const socket = new net.Socket();
        const connectPromise = new Promise<boolean>((resolve) => {
          socket.setTimeout(2000);
          
          socket.on('connect', () => {
            const latency = Date.now() - startTime;
            socket.destroy();
            resolve(true);
          });
          
          socket.on('error', () => {
            socket.destroy();
            resolve(false);
          });
          
          socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
          });
        });

        socket.connect(port, ip);
        const success = await connectPromise;
        
        if (success) {
          const latency = Date.now() - startTime;
          this.logger.debug(`[TEST] Connexion TCP reussie sur ${ip}:${port} (${latency}ms)`);
          return { success: true, latency };
        }
      } catch (error) {
        this.logger.debug(`[TEST] Echec connexion TCP sur ${ip}:${port}`);
      }
    }
    
    return { success: false, latency: 999 };
  }

  private async detectConnectionType(localIP: string, remoteIP: string): Promise<'LAN' | 'WAN'> {
    try {
      // Analyse des plages d'adresses
      const isLocalRemote = this.isLocalIP(remoteIP);
      
      if (isLocalRemote) {
        const localSubnet = this.getSubnet(localIP);
        const remoteSubnet = this.getSubnet(remoteIP);
        
        if (localSubnet === remoteSubnet) {
          this.logger.log(`[CONNECTION] Connexion LAN detectee (meme sous-reseau): ${localIP} -> ${remoteIP}`);
          return 'LAN';
        }
      }

      // Test de connectivite avec timeout court
      const { latency } = await this.testInterfaceConnectivity(remoteIP);
      
      // Si latence < 10ms, probablement LAN
      if (latency < 10) {
        this.logger.log(`[CONNECTION] Connexion LAN detectee (latence basse): ${localIP} -> ${remoteIP}`);
        return 'LAN';
      }

      // Par defaut, considerer comme WAN
      this.logger.log(`[CONNECTION] Connexion WAN detectee: ${localIP} -> ${remoteIP}`);
      return 'WAN';
    } catch (error) {
      this.logger.warn(`[CONNECTION] Erreur detection type connexion pour ${remoteIP}, par defaut WAN`);
      return 'WAN';
    }
  }

  private getSubnet(ip: string): string {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }

  // Modification de detectActiveConnections pour inclure les nouvelles metriques
  private async detectActiveConnections(): Promise<NetworkConnection[]> {
    try {
      const connections: NetworkConnection[] = [];
      const { stdout } = await execAsync('netstat -n');
      const lines = stdout.split('\n');
      
      // Recuperer la table ARP pour les equipements locaux
      const arpTable = await this.getARPTable();
      const localDevices = new Set(arpTable.map(device => device.ip));
      
      for (const line of lines) {
        const match = line.match(/TCP\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+\s+ESTABLISHED/);
        if (match) {
          const [_, localIP, remoteIP] = match;
          
          // Ne garder que les connexions entre equipements locaux
          if (this.isLocalIP(localIP) && localDevices.has(remoteIP)) {
            try {
              // Determination du type d'interface
              let interfaceType: 'Wi-Fi' | 'Ethernet' = 'Ethernet';
              try {
                const { stdout: ipconfig } = await execAsync('ipconfig /all');
                const lines = ipconfig.split('\n');
                for (const line of lines) {
                  if (line.includes(localIP)) {
                    interfaceType = line.toLowerCase().includes('wi-fi') || 
                                  line.toLowerCase().includes('sans fil') 
                                  ? 'Wi-Fi' : 'Ethernet';
                    break;
                  }
                }
              } catch (error) {
                this.logger.warn(`[INTERFACE] Erreur detection type interface pour ${localIP}: ${error.message}`);
              }
              
              // Test de connectivite uniquement pour les connexions LAN
              const { latency, packetLoss } = await this.testInterfaceConnectivity(remoteIP);
              
              // Test de bande passante uniquement si la connexion est stable
              let bandwidth = { download: 0, upload: 0 };
              if (packetLoss < 100 && latency < 100) { // Seuil plus strict pour LAN
                bandwidth = await this.testBandwidth(remoteIP);
              }
              
              // Recuperation du nom de l'interface
              let interfaceName = 'Interface inconnue';
              try {
                const { stdout: ipconfig } = await execAsync('ipconfig /all');
                const lines = ipconfig.split('\n');
                let currentInterface = '';
                for (const line of lines) {
                  if (line.includes('Carte')) {
                    currentInterface = line;
                  }
                  if (line.includes(localIP)) {
                    interfaceName = currentInterface;
                    break;
                  }
                }
              } catch (error) {
                this.logger.warn(`[INTERFACE] Erreur detection nom interface pour ${localIP}: ${error.message}`);
              }
              
              const connection: NetworkConnection = {
                interface: interfaceName,
                localIP,
                remoteIP,
                type: interfaceType,
                connectionType: 'LAN', // Force en LAN car on filtre deja les connexions
                isActive: true,
                lastSeen: new Date(),
                metrics: {
                  bandwidth,
                  latency,
                  packetLoss
                }
              };

              this.logger.log(`[CONNECTIONS] Connexion LAN detectee:`, {
                interface: connection.interface,
                localIP,
                remoteIP,
                type: interfaceType,
                metrics: {
                  bandwidth,
                  latency,
                  packetLoss
                }
              });

              connections.push(connection);
            } catch (error) {
              this.logger.error(`[CONNECTIONS] Erreur analyse connexion LAN ${localIP} -> ${remoteIP}: ${error.message}`);
            }
          }
        }
      }

      this.logger.log(`[CONNECTIONS] ${connections.length} connexions LAN detectees`);
      return connections;
    } catch (error) {
      this.logger.error(`[CONNECTIONS] Erreur detection connexions LAN: ${error.message}`);
      return [];
    }
  }

  private isLocalIP(ip: string): boolean {
    try {
      // Ignorer les adresses invalides
      if (!this.isValidIP(ip) || this.isLocalhostIP(ip)) {
        return false;
      }

      const parts = ip.split('.');
      const firstOctet = parseInt(parts[0]);
      const secondOctet = parseInt(parts[1]);

      // Log pour debug
      this.logger.debug(`[LOCAL] Verification IP ${ip}:`, {
        firstOctet,
        secondOctet,
        isValidIP: this.isValidIP(ip),
        isLocalhost: this.isLocalhostIP(ip)
      });

      // Adresses privees standard
      if (firstOctet === 10) return true;
      if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) return true;
      if (firstOctet === 192 && secondOctet === 168) return true;

      // Adresses link-local
      if (firstOctet === 169 && secondOctet === 254) return true;

      // Adresses de documentation
      if (firstOctet === 192 && secondOctet === 0 && parts[2] === '2') return true;
      if (firstOctet === 198 && secondOctet === 51 && parts[2] === '100') return true;
      if (firstOctet === 203 && secondOctet === 0 && parts[2] === '113') return true;

      return false;
    } catch (error) {
      this.logger.error(`[LOCAL] Erreur verification IP ${ip}: ${error.message}`);
      return false;
    }
  }

  private ipToNumber(ip: string): number {
    return ip.split('.')
      .reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  private isValidMAC(mac: string): boolean {
    // Validation d'une adresse MAC
    // Format: xx:xx:xx:xx:xx:xx ou xx-xx-xx-xx-xx-xx
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac) && mac !== 'ff:ff:ff:ff:ff:ff' && mac !== '::::::';
  }

  private isPrivateIP(ip: string): boolean {
    try {
      const parts = ip.split('.');
      if (parts.length !== 4) return false;

      const firstOctet = parseInt(parts[0]);
      const secondOctet = parseInt(parts[1]);

      // Plages d'adresses privées
      return (
        // 10.0.0.0/8
        (firstOctet === 10) ||
        // 172.16.0.0/12
        (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
        // 192.168.0.0/16
        (firstOctet === 192 && secondOctet === 168)
      );
    } catch {
      return false;
    }
  }

  private async detectLocalDevices(): Promise<ExternalDevice[]> {
    try {
      const devices: ExternalDevice[] = [];
      const arpTable = await this.getARPTable();
      
      this.logger.log('[DEVICE] Table ARP complete:', arpTable);
      
      // Filtrage des appareils valides
      const validDevices = arpTable.filter(device => {
        // 1. Validation de l'IP
        const isValidIP = this.isValidIP(device.ip) && 
                         !this.isLocalhostIP(device.ip) && 
                         !this.isSpecialIP(device.ip) &&
                         this.isPrivateIP(device.ip);

        // 2. Validation de la MAC
        const isValidMAC = this.isValidMAC(device.mac);

        // 3. Log détaillé pour le debugging
        this.logger.debug(`[DEVICE] Analyse appareil:`, {
          ip: device.ip,
          mac: device.mac,
          isValidIP,
          isValidMAC,
          isPrivateIP: this.isPrivateIP(device.ip),
          isLocalhost: this.isLocalhostIP(device.ip),
          isSpecial: this.isSpecialIP(device.ip)
        });

        return isValidIP && isValidMAC;
      });

      this.logger.log(`[DEVICE] ${validDevices.length} appareils valides trouves`);
      
      // Traitement des appareils valides
      for (const device of validDevices) {
        try {
          // Creation d'un appareil basique
          const deviceInfo: ExternalDevice = {
            ip: device.ip,
            mac: device.mac,
            hostname: `device-${device.ip.replace(/\./g, '-')}`, // Nom par defaut
            vendor: 'Inconnu',
            os: 'Inconnu',
            services: [],
            connectionType: 'LAN',
            lastSeen: new Date(),
            metrics: {
              bandwidth: { download: 0, upload: 0 },
              latency: 0,
              packetLoss: 0
            }
          };

          // Test de connectivite avant d'essayer d'enrichir les infos
          const { latency, packetLoss } = await this.testInterfaceConnectivity(device.ip);
          if (packetLoss === 100 || latency > 1000) {
            this.logger.debug(`[DEVICE] Appareil ${device.ip} non accessible (latence: ${latency}ms, perte: ${packetLoss}%)`);
            continue; // Passer au suivant si non accessible
          }

          // Enrichissement des informations (en parallele)
          await Promise.all([
            // 1. Detection du vendeur
            (async () => {
              try {
                const vendor = await this.getVendorFromMAC(device.mac);
                if (vendor) deviceInfo.vendor = vendor;
              } catch (error) {
                this.logger.debug(`[DEVICE] Erreur detection vendeur pour ${device.ip}: ${error.message}`);
              }
            })(),

            // 2. Detection du hostname
            (async () => {
              try {
                const hostname = await this.getHostname(device.ip);
                if (hostname && hostname !== device.ip) {
                  deviceInfo.hostname = hostname;
                }
              } catch (error) {
                this.logger.debug(`[DEVICE] Erreur detection hostname pour ${device.ip}: ${error.message}`);
              }
            })(),

            // 3. Detection OS et services
            (async () => {
              try {
                const { os, services } = await this.detectOSAndServices(device.ip);
                if (os) deviceInfo.os = os;
                if (services) deviceInfo.services = services;
              } catch (error) {
                this.logger.debug(`[DEVICE] Erreur detection OS/services pour ${device.ip}: ${error.message}`);
              }
            })(),

            // 4. Test de bande passante
            (async () => {
              try {
                if (latency < 100) { // Seulement si la latence est acceptable
                  const bandwidth = await this.testBandwidth(device.ip);
                  deviceInfo.metrics.bandwidth = bandwidth;
                }
              } catch (error) {
                this.logger.debug(`[DEVICE] Erreur test bande passante pour ${device.ip}: ${error.message}`);
              }
            })()
          ]);

          // Mise a jour des metriques
          deviceInfo.metrics.latency = latency;
          deviceInfo.metrics.packetLoss = packetLoss;

          devices.push(deviceInfo);
          this.logger.log(`[DEVICE] Equipement detecte:`, {
            ip: deviceInfo.ip,
            mac: deviceInfo.mac,
            hostname: deviceInfo.hostname,
            vendor: deviceInfo.vendor,
            os: deviceInfo.os,
            services: deviceInfo.services.length,
            metrics: deviceInfo.metrics
          });

        } catch (error) {
          this.logger.error(`[DEVICE] Erreur traitement appareil ${device.ip}: ${error.message}`);
          continue;
        }
      }

      if (devices.length === 0) {
        this.logger.warn('[DEVICE] Aucun equipement local detecte apres analyse complete');
        this.logger.debug('[DEVICE] Etat de la detection:', {
          arpTableLength: arpTable.length,
          validDevicesLength: validDevices.length,
          devicesDetected: devices.length
        });
      } else {
        this.logger.log(`[DEVICE] ${devices.length} equipements locaux detectes avec succes`);
      }

      return devices;
    } catch (error) {
      this.logger.error(`[DEVICE] Erreur detection equipements locaux: ${error.message}`);
      return [];
    }
  }

  private async detectExternalDevices(): Promise<ExternalDevice[]> {
    try {
      const devices: ExternalDevice[] = [];
      const activeConnections = await this.detectActiveConnections();
      
      // Pour chaque connexion active, on enrichit les informations
      for (const conn of activeConnections) {
        try {
          // 1. Recuperation de l'adresse MAC
          const mac = await this.getMACAddress(conn.remoteIP);
          
          // 2. Detection du vendeur via l'adresse MAC
          const vendor = await this.getVendorFromMAC(mac);
          
          // 3. Detection du hostname
          const hostname = await this.getHostname(conn.remoteIP);
          
          // 4. Detection de l'OS et des services
          const { os, services } = await this.detectOSAndServices(conn.remoteIP);
          
          // 5. Test des metriques
          const { latency, packetLoss } = await this.testInterfaceConnectivity(conn.remoteIP);
          const bandwidth = await this.testBandwidth(conn.remoteIP);
          
          devices.push({
            ip: conn.remoteIP,
            mac,
            hostname,
            vendor,
            os,
            services,
            connectionType: conn.connectionType,
            lastSeen: new Date(),
            metrics: {
              bandwidth,
              latency,
              packetLoss
            }
          });

          this.logger.log(`[DEVICE] Equipement detecte:`, {
            ip: conn.remoteIP,
            mac,
            hostname,
            vendor,
            os,
            services: services.length,
            connectionType: conn.connectionType
          });

        } catch (error) {
          this.logger.error(`[DEVICE] Erreur detection equipement ${conn.remoteIP}: ${error.message}`);
        }
      }

      return devices;
    } catch (error) {
      this.logger.error(`[DEVICE] Erreur detection equipements: ${error.message}`);
      return [];
    }
  }

  private async getVendorFromMAC(mac: string): Promise<string> {
    try {
      // Utilisation de l'API macaddress.io ou d'une base locale
      const macPrefix = mac.substring(0, 8).toUpperCase();
      
      // Base de donnees locale des prefixes MAC courants
      const commonVendors: { [key: string]: string } = {
        '00:50:56': 'VMware',
        '00:0C:29': 'VMware',
        'B8:27:EB': 'Raspberry Pi',
        'DC:A6:32': 'Raspberry Pi',
        '00:1A:79': 'Router',
        '00:1B:63': 'Switch',
        '00:1C:B3': 'Switch',
        '00:1A:2B': 'Access Point',
        '00:1C:0E': 'Access Point',
        '00:1E:8C': 'Laptop',
        '00:1F:3F': 'Laptop',
        '00:1D:7D': 'Desktop',
        '00:1F:5B': 'Desktop'
      };

      return commonVendors[macPrefix] || 'Unknown Vendor';
    } catch (error) {
      this.logger.error(`[VENDOR] Erreur detection vendeur: ${error.message}`);
      return 'Unknown Vendor';
    }
  }

  private async detectOSAndServices(ip: string): Promise<{ os: string; services: any[] }> {
    try {
      // Utilisation de nmap pour la detection OS et services
      const { stdout } = await execAsync(
        `nmap -O -sV -T4 --max-retries 1 --host-timeout 30s ${ip}`
      );

      const os = this.parseNmapOS(stdout);
      const services = this.parseNmapServices(stdout);

      return { os, services };
    } catch (error) {
      this.logger.error(`[OS] Erreur detection OS/services ${ip}: ${error.message}`);
      return { os: 'Unknown', services: [] };
    }
  }

  private parseNmapOS(nmapOutput: string): string {
    try {
      // Detection de l'OS
      const osMatch = nmapOutput.match(/OS details: (.+)/);
      if (osMatch) {
        return osMatch[1].trim();
      }

      // Detection basique
      if (nmapOutput.includes('Windows')) return 'Windows';
      if (nmapOutput.includes('Linux')) return 'Linux';
      if (nmapOutput.includes('Mac OS')) return 'MacOS';
      if (nmapOutput.includes('iOS')) return 'iOS';
      if (nmapOutput.includes('Android')) return 'Android';

      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  private parseNmapServices(nmapOutput: string): any[] {
    const services: any[] = [];
    const lines = nmapOutput.split('\n');

    for (const line of lines) {
      // Format: "80/tcp open http Apache httpd 2.4.41"
      const match = line.match(/(\d+)\/(tcp|udp)\s+(\w+)\s+(\w+)(?:\s+(.+))?/);
      if (match) {
        const [_, port, protocol, state, service, version] = match;
        services.push({
          port: parseInt(port),
          protocol,
          service,
          version: version?.trim() || undefined
        });
      }
    }

    return services;
  }

  private async getMACAddress(ip: string): Promise<string> {
    try {
      const arpTable = await this.getARPTable();
      const mac = arpTable.find(item => item.ip === ip)?.mac;
      if (mac) {
        return mac;
      }
      throw new Error('MAC address not found');
    } catch (error) {
      this.logger.error(`[MAC] Erreur recuperation MAC address: ${error.message}`);
      throw error;
    }
  }

  private sanitizeIP(ip: string): string {
    // Validation basique du format IP
    if (!this.isValidIP(ip)) {
      throw new Error('Adresse IP invalide');
    }
    // Escape des caracteres speciaux pour la securite
    return ip.replace(/[^0-9.]/g, '');
  }

  private async getHostname(ip: string): Promise<string> {
    try {
      // Sanitization de l'IP
      const sanitizedIP = this.sanitizeIP(ip);

      // Ignorer les adresses spéciales
      if (this.isSpecialIP(sanitizedIP)) {
        this.logger.debug(`[HOSTNAME] IP speciale detectee: ${sanitizedIP}`);
        return `special-${sanitizedIP.replace(/\./g, '-')}`;
      }

      // 1. Essayer d'abord avec DNS inverse (plus fiable)
      try {
        const hostnames = await promisify(dns.reverse)(sanitizedIP);
        if (hostnames && hostnames.length > 0) {
          // Validation du hostname retourne
          const hostname = hostnames[0].toLowerCase();
          if (this.isValidHostname(hostname)) {
            this.logger.debug(`[HOSTNAME] DNS inverse reussi pour ${sanitizedIP}: ${hostname}`);
            return hostname;
          }
        }
      } catch (error) {
        this.logger.debug(`[HOSTNAME] DNS inverse echoue pour ${sanitizedIP}: ${error.message}`);
      }

      // 2. Essayer avec nmap (plus fiable que ping/nslookup)
      try {
        // Utilisation de --max-retries 1 et --host-timeout 5s pour limiter le temps d'execution
        const { stdout } = await execAsync(`nmap -sn -PR --max-retries 1 --host-timeout 5s ${sanitizedIP}`);
        const hostnameMatch = stdout.match(/Host is up.*?\((.*?)\)/);
        if (hostnameMatch && hostnameMatch[1] !== sanitizedIP) {
          const hostname = hostnameMatch[1].trim().toLowerCase();
          if (this.isValidHostname(hostname)) {
            this.logger.debug(`[HOSTNAME] Nmap reussi pour ${sanitizedIP}: ${hostname}`);
            return hostname;
          }
        }
      } catch (error) {
        this.logger.debug(`[HOSTNAME] Nmap echoue pour ${sanitizedIP}: ${error.message}`);
      }

      // 3. Essayer avec ping -a (Windows uniquement)
      if (os.platform() === 'win32') {
        try {
          // Limitation du nombre de tentatives et du timeout
          const { stdout } = await execAsync(`ping -a -n 1 -w 1000 ${sanitizedIP}`);
          const hostnameMatch = stdout.match(/Ping statistics for ([^:]+)/);
          if (hostnameMatch && hostnameMatch[1] !== sanitizedIP) {
            const hostname = hostnameMatch[1].trim().toLowerCase();
            if (this.isValidHostname(hostname)) {
              this.logger.debug(`[HOSTNAME] Ping -a reussi pour ${sanitizedIP}: ${hostname}`);
              return hostname;
            }
          }
        } catch (error) {
          this.logger.debug(`[HOSTNAME] Ping -a echoue pour ${sanitizedIP}: ${error.message}`);
        }
      }

      // 4. Essayer avec nslookup (dernier recours)
      try {
        // Limitation du timeout
        const { stdout } = await execAsync(`nslookup -timeout=2 ${sanitizedIP}`);
        const hostnameMatch = stdout.match(/Name:\s+(.+)/);
        if (hostnameMatch) {
          const hostname = hostnameMatch[1].trim().toLowerCase();
          if (this.isValidHostname(hostname)) {
            this.logger.debug(`[HOSTNAME] Nslookup reussi pour ${sanitizedIP}: ${hostname}`);
            return hostname;
          }
        }
      } catch (error) {
        this.logger.debug(`[HOSTNAME] Nslookup echoue pour ${sanitizedIP}: ${error.message}`);
      }

      // Si aucun hostname n'est trouvé, retourner l'IP avec un format plus lisible
      this.logger.debug(`[HOSTNAME] Aucun hostname trouve pour ${sanitizedIP}, utilisation de l'IP formatee`);
      return `device-${sanitizedIP.replace(/\./g, '-')}`;
    } catch (error) {
      this.logger.error(`[HOSTNAME] Erreur recuperation hostname pour ${ip}: ${error.message}`);
      return `device-${ip.replace(/\./g, '-')}`;
    }
  }

  private isValidHostname(hostname: string): boolean {
    // Validation basique d'un hostname
    // - Longueur entre 1 et 63 caracteres
    // - Caracteres alphanumeriques, tirets et points
    // - Ne commence et ne finit pas par un tiret
    // - Pas de points consecutifs
    const hostnameRegex = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*$/;
    return hostnameRegex.test(hostname);
  }

  private isSpecialIP(ip: string): boolean {
    // Liste des adresses spéciales à ignorer
    const specialIPs = [
      '255.255.255.255', // Broadcast global
      '224.0.0.0',       // Multicast
      '224.0.0.22',
      '224.0.0.251',
      '224.0.0.252',
      '239.255.255.250'
    ];

    // Vérifier si l'IP est dans la liste des adresses spéciales
    if (specialIPs.includes(ip)) {
      return true;
    }

    // Vérifier si c'est une adresse broadcast locale
    const parts = ip.split('.');
    if (parts.length === 4 && parts[3] === '255') {
      return true;
    }

    // Vérifier si c'est une adresse multicast
    const firstOctet = parseInt(parts[0]);
    if (firstOctet >= 224 && firstOctet <= 239) {
      return true;
    }

    return false;
  }

  private async detectDeviceTypeFromMAC(mac: string): Promise<DeviceType> {
    const macPrefix = mac.substring(0, 8).toUpperCase();
    
    const macPrefixes: { [key: string]: DeviceType } = {
      '00:50:56': DeviceType.SERVER,
      '00:0C:29': DeviceType.SERVER,
      'B8:27:EB': DeviceType.SERVER,
      'DC:A6:32': DeviceType.SERVER,
      '00:1A:79': DeviceType.ROUTER,
      '00:1B:63': DeviceType.SWITCH,
      '00:1C:B3': DeviceType.SWITCH,
      '00:1A:2B': DeviceType.AP,
      '00:1C:0E': DeviceType.AP,
      '00:1E:8C': DeviceType.LAPTOP,
      '00:1F:3F': DeviceType.LAPTOP,
      '00:1D:7D': DeviceType.DESKTOP,
      '00:1F:5B': DeviceType.DESKTOP
    };

    return macPrefixes[macPrefix] || DeviceType.OTHER;
  }

  // Methode pour creer un nouvel appareil
  async createDevice(createDeviceDto: CreateDeviceDto): Promise<Device> {
    try {
      this.logger.log(`[DEVICE] Creation d'un nouvel appareil: ${JSON.stringify(createDeviceDto)}`);

      const result = await sequelize.query(
        `INSERT INTO appareils (
          id, hostname, ip_address, mac_address, os, device_type,
          stats, last_seen, first_discovered, created_at, updated_at
        ) VALUES (
          :id, :hostname, :ipAddress, :macAddress, :os, :deviceType,
          :stats, :lastSeen, :firstDiscovered, :createdAt, :updatedAt
        ) RETURNING *`,
        {
          replacements: {
            id: uuidv4(),
            hostname: createDeviceDto.hostname,
            ipAddress: createDeviceDto.ipAddress,
            macAddress: createDeviceDto.macAddress,
            os: createDeviceDto.os,
            deviceType: createDeviceDto.deviceType,
            stats: JSON.stringify({
              cpu: 0,
              memory: 0,
              uptime: '0',
              status: DeviceStatus.ACTIVE,
              services: []
            }),
            lastSeen: new Date(),
            firstDiscovered: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          },
          type: QueryTypes.RAW
        }
      );

      const [device] = result[0] as Device[];
      if (!device) {
        throw new Error('Erreur lors de la creation de l\'appareil');
      }

      await this.initializeDeviceStats(device.id);
      this.logger.log(`[DEVICE] Appareil cree avec succes: ${device.id}`);
      return this.formatDeviceResponse(device);
    } catch (error) {
      this.logger.error(`[DEVICE] Erreur creation appareil: ${error.message}`);
      throw error;
    }
  }

  // Methode pour mettre a jour un appareil
  async updateDevice(id: string, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
    try {
      this.logger.log(`[DEVICE] Mise a jour de l'appareil ${id}: ${JSON.stringify(updateDeviceDto)}`);

      const existingDevice = await this.getDeviceById(id);
      if (!existingDevice) {
        throw new Error('Appareil non trouve');
      }

      const updateFields: any = {};
      if (updateDeviceDto.hostname) updateFields.hostname = updateDeviceDto.hostname;
      if (updateDeviceDto.ipAddress) updateFields.ip_address = updateDeviceDto.ipAddress;
      if (updateDeviceDto.macAddress) updateFields.mac_address = updateDeviceDto.macAddress;
      if (updateDeviceDto.os) updateFields.os = updateDeviceDto.os;
      if (updateDeviceDto.deviceType) updateFields.device_type = updateDeviceDto.deviceType;
      if (updateDeviceDto.status) {
        const stats = JSON.parse(existingDevice.stats as unknown as string);
        stats.status = updateDeviceDto.status;
        updateFields.stats = JSON.stringify(stats);
      }
      updateFields.updated_at = new Date();

      const result = await sequelize.query(
        `UPDATE appareils 
         SET ${Object.keys(updateFields).map(key => `${key} = :${key}`).join(', ')}
         WHERE id = :id
         RETURNING *`,
        {
          replacements: { id, ...updateFields },
          type: QueryTypes.RAW
        }
      );

      const [device] = result[0] as Device[];
      if (!device) {
        throw new Error('Erreur lors de la mise a jour de l\'appareil');
      }

      this.logger.log(`[DEVICE] Appareil ${id} mis a jour avec succes`);
      return this.formatDeviceResponse(device);
    } catch (error) {
      this.logger.error(`[DEVICE] Erreur mise a jour appareil ${id}: ${error.message}`);
      throw error;
    }
  }

  // Methode pour supprimer un appareil
  async deleteDevice(id: string): Promise<void> {
    try {
      this.logger.log(`[DEVICE] Suppression de l'appareil ${id}`);

      // Verification de l'existence de l'appareil
      const existingDevice = await this.getDeviceById(id);
      if (!existingDevice) {
        throw new Error('Appareil non trouve');
      }

      // Suppression de l'appareil
      await sequelize.query(
        'DELETE FROM appareils WHERE id = :id',
        {
          replacements: { id },
          type: QueryTypes.DELETE
        }
      );

      this.logger.log(`[DEVICE] Appareil ${id} supprime avec succes`);
    } catch (error) {
      this.logger.error(`[DEVICE] Erreur suppression appareil ${id}: ${error.message}`);
      throw error;
    }
  }

  // Methode pour supprimer les statistiques d'un appareil
  async deleteDeviceStats(deviceId: string): Promise<void> {
    try {
      this.logger.log(`[DEVICE] Suppression des statistiques de l'appareil ${deviceId}`);

      // Suppression des statistiques
      await sequelize.query(
        'DELETE FROM statistiques_reseau WHERE device_id = :deviceId',
        {
          replacements: { deviceId },
          type: QueryTypes.DELETE
        }
      );

      // Suppression du trafic reseau
      await sequelize.query(
        'DELETE FROM network_traffic WHERE device_ip = (SELECT ip_address FROM appareils WHERE id = :deviceId)',
        {
          replacements: { deviceId },
          type: QueryTypes.DELETE
        }
      );

      this.logger.log(`[DEVICE] Statistiques de l'appareil ${deviceId} supprimees avec succes`);
    } catch (error) {
      this.logger.error(`[DEVICE] Erreur suppression statistiques appareil ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  // Methode pour recuperer un appareil par son adresse IP
  async getDeviceByIP(ipAddress: string): Promise<Device | null> {
    try {
      const [device] = await sequelize.query<Device>(
        'SELECT * FROM appareils WHERE ip_address = :ipAddress',
        {
          replacements: { ipAddress },
          type: QueryTypes.SELECT
        }
      );

      return device ? this.formatDeviceResponse(device) : null;
    } catch (error) {
      this.logger.error(`[DEVICE] Erreur recuperation appareil par IP ${ipAddress}: ${error.message}`);
      throw error;
    }
  }

  // Methode pour recuperer un appareil par son adresse MAC
  async getDeviceByMAC(macAddress: string): Promise<Device | null> {
    try {
      const [device] = await sequelize.query<Device>(
        'SELECT * FROM appareils WHERE mac_address = :macAddress',
        {
          replacements: { macAddress },
          type: QueryTypes.SELECT
        }
      );

      return device ? this.formatDeviceResponse(device) : null;
    } catch (error) {
      this.logger.error(`[DEVICE] Erreur recuperation appareil par MAC ${macAddress}: ${error.message}`);
      throw error;
    }
  }

  // Methode pour initialiser les statistiques d'un appareil
  private async initializeDeviceStats(deviceId: string): Promise<void> {
    try {
      const device = await this.getDeviceById(deviceId);
      if (!device) throw new Error('Appareil non trouve');

      // Creation d'une entree de statistiques initiale
      await sequelize.query(
        `INSERT INTO statistiques_reseau (
          id, device_id, cpu_usage, memory_usage, bandwidth,
          latency, packet_loss, timestamp
        ) VALUES (
          :id, :deviceId, 0, 0, 0, 0, 0, :timestamp
        )`,
        {
          replacements: {
            id: uuidv4(),
            deviceId,
            timestamp: new Date()
          },
          type: QueryTypes.INSERT
        }
      );

      this.logger.log(`[DEVICE] Statistiques de l'appareil ${deviceId} initialisees avec succes`);
    } catch (error) {
      this.logger.error(`[DEVICE] Erreur initialisation statistiques appareil ${deviceId}: ${error.message}`);
      throw error;
    }
  }

  private formatDeviceResponse(device: any): Device {
    try {
      const stats = typeof device.stats === 'string' 
        ? JSON.parse(device.stats) 
        : device.stats;

      return {
        ...device,
        stats: {
          cpu: stats.cpu || 0,
          memory: stats.memory || 0,
          uptime: stats.uptime || '0',
          status: stats.status || DeviceStatus.INACTIVE,
          services: (stats.services || []).map((s: any): ServiceInfo => ({
            port: s.port || 0,
            protocol: s.protocol || 'tcp',
            service: s.service || '',
            version: s.version
          }))
        },
        lastSeen: new Date(device.last_seen),
        firstDiscovered: new Date(device.first_discovered),
        createdAt: device.created_at ? new Date(device.created_at) : undefined,
        updatedAt: device.updated_at ? new Date(device.updated_at) : undefined
      } as Device;
    } catch (error) {
      this.logger.error(`[FORMAT] Erreur formatage appareil: ${error.message}`);
      throw error;
    }
  }

  private async collectNetworkStatsWithSNMP(ipAddress: string): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    uptime: string;
    status: DeviceStatus;
  }> {
    try {
      // Implementation de base pour SNMP
      // TODO: Implementer la vraie collecte SNMP
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        uptime: '0',
        status: DeviceStatus.ACTIVE
      };
    } catch (error) {
      this.logger.error(`[SNMP] Erreur collecte stats pour ${ipAddress}: ${error.message}`);
      throw error;
    }
  }

  private isValidIP(ip: string): boolean {
    if (!ip) return false;
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  }

  private isLocalhostIP(ip: string): boolean {
    return ip === '127.0.0.1' || 
           ip === '::1' || 
           ip.startsWith('169.254.') || // Link-local
           ip.startsWith('0.0.0.0');
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

  private async execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = require('child_process').exec(command, {
        windowsHide: true,
        shell: true
      }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          this.logger.error('[EXEC] Erreur execution:', error);
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  async detectLocalNetwork(): Promise<{
    startIP: string;
    endIP: string;
    gateway: string;
    netmask: string;
    activeConnections: NetworkConnection[];
    externalDevices: ExternalDevice[];
  }> {
    try {
      this.logger.log('[DETECT] Debut detection reseau local');
      
      const networkInfo = await this.getCurrentNetworkInfo();
      this.logger.log('[DETECT] Informations reseau:', networkInfo);

      const localDevicesInfo = await this.detectLocalDevices();
      this.logger.log('[DETECT] Equipements locaux detectes:', localDevicesInfo);

      const activeConnections = await this.detectActiveConnections();
      this.logger.log('[DETECT] Connexions actives:', activeConnections);

      const externalDevices = await this.detectExternalDevices();
      this.logger.log('[DETECT] Equipements externes:', externalDevices);

      const broadcastAddress = this.calculateBroadcastAddress(networkInfo.startIP, networkInfo.netmask);

      return {
        startIP: networkInfo.startIP,
        endIP: broadcastAddress,
        gateway: networkInfo.gateway,
        netmask: networkInfo.netmask,
        activeConnections,
        externalDevices: [...localDevicesInfo, ...externalDevices]
      };
    } catch (error) {
      this.logger.error('[DETECT] Erreur complete:', error);
      throw error;
    }
  }

  private async getCurrentNetworkInfo(): Promise<{ startIP: string; gateway: string; netmask: string }> {
    try {
      this.logger.debug('[NETWORK] Debut recuperation infos reseau');
      
      // 1. Essayer d'abord avec os.networkInterfaces()
      const interfaces = os.networkInterfaces();
      this.logger.debug('[NETWORK] Interfaces trouvees:', JSON.stringify(interfaces, null, 2));

      // Chercher une interface active non-interne
      for (const [name, ifaces] of Object.entries(interfaces)) {
        if (!ifaces) continue;
        
        for (const iface of ifaces) {
          if (iface.family === 'IPv4' && !iface.internal) {
            this.logger.debug(`[NETWORK] Interface active trouvee: ${name}`, iface);
            
            // Si on a une netmask, on peut l'utiliser
            if (iface.netmask) {
              // Essayer de trouver la gateway
              try {
                const { stdout } = await execAsync('ipconfig /all');
                const gatewayMatch = stdout.match(/Default Gateway[^:]*:\s*([\d\.]+)/i);
                const gateway = gatewayMatch ? gatewayMatch[1] : 
                  iface.address.split('.').slice(0, 3).join('.') + '.1';
                
                this.logger.debug('[NETWORK] Gateway trouvee:', gateway);
                return {
                  startIP: iface.address,
                  gateway,
                  netmask: iface.netmask
                };
              } catch (error) {
                this.logger.warn('[NETWORK] Erreur recuperation gateway, utilisation par defaut:', error);
                return {
                  startIP: iface.address,
                  gateway: iface.address.split('.').slice(0, 3).join('.') + '.1',
                  netmask: iface.netmask
                };
              }
            }
          }
        }
      }

      // 2. Si os.networkInterfaces() echoue, essayer avec ipconfig
      this.logger.debug('[NETWORK] Tentative avec ipconfig');
      const { stdout } = await execAsync('ipconfig /all');
      this.logger.debug('[NETWORK] Sortie ipconfig:', stdout);

      // Recherche de l'interface Wi-Fi
      const wifiMatch = stdout.match(/Wireless LAN adapter Wi-Fi:[\s\S]*?IPv4 Address[^:]*: ([0-9.]+)[\s\S]*?Subnet Mask[^:]*: ([0-9.]+)[\s\S]*?Default Gateway[^:]*: ([0-9.]+)/i);
      if (wifiMatch) {
        const [, ip, netmask, gateway] = wifiMatch;
        this.logger.debug('[NETWORK] Interface Wi-Fi trouvee:', { ip, netmask, gateway });
        return { startIP: ip, netmask, gateway };
      }

      // Si pas de Wi-Fi, recherche de l'interface Ethernet
      const ethernetMatch = stdout.match(/Ethernet adapter Ethernet:[\s\S]*?IPv4 Address[^:]*: ([0-9.]+)[\s\S]*?Subnet Mask[^:]*: ([0-9.]+)[\s\S]*?Default Gateway[^:]*: ([0-9.]+)/i);
      if (ethernetMatch) {
        const [, ip, netmask, gateway] = ethernetMatch;
        this.logger.debug('[NETWORK] Interface Ethernet trouvee:', { ip, netmask, gateway });
        return { startIP: ip, netmask, gateway };
      }

      // Si aucune interface specifique n'est trouvee, prendre la premiere interface active
      const anyInterfaceMatch = stdout.match(/IPv4 Address[^:]*: ([0-9.]+)[\s\S]*?Subnet Mask[^:]*: ([0-9.]+)[\s\S]*?Default Gateway[^:]*: ([0-9.]+)/i);
      if (anyInterfaceMatch) {
        const [, ip, netmask, gateway] = anyInterfaceMatch;
        this.logger.debug('[NETWORK] Interface generique trouvee:', { ip, netmask, gateway });
        return { startIP: ip, netmask, gateway };
      }

      // 3. Si tout echoue, essayer de recuperer au moins l'IP locale
      const localIP = Object.values(interfaces)
        .flat()
        .find(iface => iface?.family === 'IPv4' && !iface?.internal)?.address;

      if (localIP) {
        this.logger.warn('[NETWORK] Utilisation IP locale comme fallback:', localIP);
        return {
          startIP: localIP,
          gateway: localIP.split('.').slice(0, 3).join('.') + '.1',
          netmask: '255.255.255.0'
        };
      }

      this.logger.error('[NETWORK] Aucune interface active trouvee');
      throw new Error('Aucune interface active trouvee');
    } catch (error) {
      this.logger.error('[NETWORK] Erreur obtention infos reseau:', error);
      throw new Error('Impossible de trouver les informations reseau');
    }
  }

  private calculateBroadcastAddress(ip: string, mask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    
    return ipParts
      .map((part, i) => part | (~maskParts[i] & 255))
      .join('.');
  }
}
import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Device, NmapScanConfig, DeviceStats } from './device.model';
import { sequelize } from '../../database';
import { QueryTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as net from 'net';
import { execAsync } from '../../utils/exec-async';
import { NmapAgentService } from './agents/nmap.service';
import { TracerouteAgentService } from './agents/traceroute.service';
import { NetstatAgentService } from './agents/netstat.service';

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

  private getDeviceStatus(lastSeen: Date): string {
    const now = new Date();
    const diffMinutes = (now.getTime() - new Date(lastSeen).getTime()) / (1000 * 60);
    
    if (diffMinutes < 5) return 'active';
    if (diffMinutes < 30) return 'warning';
    return 'inactive';
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
  async scanNetwork(target: string): Promise<Device[]> {
    try {
      this.logger.log(`[BACKEND] Formatage de la cible pour nmap: ${target}`);
      
      // Formatage de la plage d'adresses pour nmap
      let formattedTarget = target;
      if (target.includes('-')) {
        const [startIP, endIP] = target.split('-');
        // Nmap utilise le format CIDR ou une liste d'adresses
        // On va scanner chaque adresse individuellement pour plus de fiabilité
        formattedTarget = `${startIP}/24`; // On commence par scanner le sous-réseau /24
        this.logger.log(`[BACKEND] Plage d'adresses reformatee pour nmap: ${formattedTarget}`);
      }

      // 1. Scan des appareils avec nmap
      const scanResult = await this.nmapAgent.execute({
        target: formattedTarget,
        osDetection: true,
        serviceDetection: true
      });

      if (!scanResult.success) {
        this.logger.error(`[BACKEND] Erreur scan nmap: ${scanResult.error}`);
        throw new Error(scanResult.error || 'Erreur lors du scan nmap');
      }

      this.logger.log(`[BACKEND] ${scanResult.devices.length} appareils detectes par nmap`);

      // 2. Pour chaque appareil detecte
      for (const device of scanResult.devices) {
        this.logger.log(`[BACKEND] Traitement de l'appareil: ${device.ipAddress}`);
        // Verifier si l'appareil existe deja
        const existingDevices = await sequelize.query<Device>(
          'SELECT * FROM appareils WHERE ipAddress = :ipAddress',
          {
            replacements: { ipAddress: device.ipAddress },
            type: QueryTypes.SELECT,
          }
        );

        if (existingDevices.length > 0) {
          // Mise a jour de l'appareil existant
          await sequelize.query(
            `UPDATE appareils SET 
              hostname = :hostname,
              macAddress = :macAddress,
              os = :os,
              deviceType = :deviceType,
              stats = :stats,
              lastSeen = CURRENT_TIMESTAMP
            WHERE ipAddress = :ipAddress`,
            {
              replacements: {
                hostname: device.hostname,
                macAddress: device.macAddress,
                os: device.os,
                deviceType: device.deviceType,
                stats: JSON.stringify(device.stats),
                ipAddress: device.ipAddress
              },
              type: QueryTypes.UPDATE,
            }
          );
        } else {
          // Creation d'un nouvel appareil
          await sequelize.query(
            `INSERT INTO appareils (
              id, hostname, ipAddress, macAddress, os, deviceType, 
              stats, lastSeen, firstDiscovered
            ) VALUES (
              :id, :hostname, :ipAddress, :macAddress, :os, :deviceType,
              :stats, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )`,
            {
              replacements: {
                id: device.id,
                hostname: device.hostname,
                ipAddress: device.ipAddress,
                macAddress: device.macAddress,
                os: device.os,
                deviceType: device.deviceType,
                stats: JSON.stringify(device.stats)
              },
              type: QueryTypes.INSERT,
            }
          );
        }

        // 3. Collecte des statistiques
        const updatedDevice = await this.netstatAgent.execute(device);
        
        // Mise a jour des statistiques dans la base
        await sequelize.query(
          `UPDATE appareils SET 
            stats = :stats,
            lastSeen = CURRENT_TIMESTAMP
          WHERE id = :id`,
          {
            replacements: {
              id: device.id,
              stats: JSON.stringify(updatedDevice.stats)
            },
            type: QueryTypes.UPDATE,
          }
        );

        // 4. Enregistrement des statistiques historiques
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
              deviceId: device.id,
              bandwidth: 0, // A implementer
              latency: 0,   // A implementer
              packetLoss: 0, // A implementer
              cpuUsage: updatedDevice.stats.cpu,
              memoryUsage: updatedDevice.stats.memory
            },
            type: QueryTypes.INSERT,
          }
        );
      }

      // 5. Mise a jour de la topologie
      const devices = await this.getAllDevices();
      const tracerouteResults = await Promise.all(
        devices.map(device => 
          this.tracerouteAgent.execute({ target: device.ipAddress })
        )
      );

      const topology = this.tracerouteAgent.generateTopology(devices, tracerouteResults);

      // Sauvegarde de la topologie
      await sequelize.query(
        `INSERT INTO topologie_reseau (
          id, name, data, isActive, createdAt, updatedAt
        ) VALUES (
          :id, :name, :data, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`,
        {
          replacements: {
            id: uuidv4(),
            name: `Topologie ${new Date().toISOString()}`,
            data: JSON.stringify(topology as unknown as object)
          },
          type: QueryTypes.INSERT,
        }
      );

      return devices;

    } catch (error) {
      this.logger.error(`Erreur scan reseau: ${error.message}`);
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
          // Gestion sécurisée du parsing des stats
          let stats: DeviceStats;
          if (typeof device.stats === 'string') {
            stats = JSON.parse(device.stats);
          } else if (device.stats && typeof device.stats === 'object') {
            stats = device.stats as DeviceStats;
          } else {
            // Stats par défaut si invalides
            stats = {
              cpu: 0,
              memory: 0,
              uptime: '0',
              status: 'inactive'
            };
          }

          return {
            ...device,
            stats
          };
        } catch (err) {
          this.logger.warn(`[BACKEND] Erreur parsing stats pour l'appareil ${device.id}: ${err.message}`);
          // Retourne l'appareil avec des stats par défaut en cas d'erreur
          return {
            ...device,
            stats: {
              cpu: 0,
              memory: 0,
              uptime: '0',
              status: 'inactive'
            }
          };
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
  async getLatestTopology(): Promise<any> {
    try {
      const [topology] = await sequelize.query(
        'SELECT * FROM topologie_reseau WHERE isActive = true ORDER BY createdAt DESC LIMIT 1',
        {
          type: QueryTypes.SELECT,
          plain: true
        }
      );

      if (!topology) {
        this.logger.debug('[TOPOLOGY] Aucune topologie active trouvee');
        return null;
      }

      // La colonne data est déjà un objet JavaScript car Sequelize la traite comme JSON
      return {
        id: topology.id,
        name: topology.name,
        isActive: topology.isActive,
        createdAt: topology.createdAt,
        updatedAt: topology.updatedAt,
        data: topology.data // Pas besoin de JSON.parse car c'est déjà un objet
      };
    } catch (error) {
      this.logger.error(`[TOPOLOGY] Erreur recuperation topologie: ${error.message}`);
      throw error;
    }
  }

  // Methode pour detecter le reseau local
  async detectLocalNetwork(): Promise<{ startIP: string; endIP: string }> {
    try {
      // Recuperation des interfaces reseau
      const interfaces = os.networkInterfaces();
      let localIP = '';
      let subnetMask = '';

      // Recherche de l'interface principale (non loopback)
      for (const [name, iface] of Object.entries(interfaces)) {
        if (!iface) continue;
        
        const ipv4 = iface.find(addr => addr.family === 'IPv4' && !addr.internal);
        if (ipv4) {
          localIP = ipv4.address;
          subnetMask = ipv4.netmask;
          break;
        }
      }

      if (!localIP || !subnetMask) {
        throw new Error('Impossible de detecter l\'interface reseau principale');
      }

      // Calcul de la plage d'adresses IP
      const startIP = this.calculateNetworkAddress(localIP, subnetMask);
      const endIP = this.calculateBroadcastAddress(localIP, subnetMask);

      this.logger.log(`Reseau detecte: ${startIP} - ${endIP}`);

      return {
        startIP: this.incrementIP(startIP),
        endIP: this.decrementIP(endIP)
      };
    } catch (error) {
      this.logger.error(`Erreur detection reseau: ${error.message}`);
      throw error;
    }
  }

  // Methode utilitaire pour calculer l'adresse reseau
  private calculateNetworkAddress(ip: string, mask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    
    return ipParts
      .map((part, i) => part & maskParts[i])
      .join('.');
  }

  // Methode utilitaire pour calculer l'adresse de broadcast
  private calculateBroadcastAddress(ip: string, mask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    
    return ipParts
      .map((part, i) => part | (~maskParts[i] & 255))
      .join('.');
  }

  // Methode utilitaire pour incrementer une adresse IP
  private incrementIP(ip: string): string {
    const parts = ip.split('.').map(Number);
    parts[3]++;
    for (let i = 3; i > 0; i--) {
      if (parts[i] > 255) {
        parts[i] = 0;
        parts[i - 1]++;
      }
    }
    return parts.join('.');
  }

  // Methode utilitaire pour decrementer une adresse IP
  private decrementIP(ip: string): string {
    const parts = ip.split('.').map(Number);
    parts[3]--;
    for (let i = 3; i > 0; i--) {
      if (parts[i] < 0) {
        parts[i] = 255;
        parts[i - 1]--;
      }
    }
    return parts.join('.');
  }
} 
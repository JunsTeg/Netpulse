import { Injectable, Logger } from '@nestjs/common';
import { execAsync } from '../../utils/exec-async';
import * as os from 'os';
import * as net from 'net';
import { promisify } from 'util';
import * as dns from 'dns';
import { NmapAgentService } from './agents/nmap.service';
import { v4 as uuidv4 } from 'uuid';
import { Device, DeviceStatus } from './device.model';

// Interface pour les resultats du scan nmap
interface NmapDevice {
  ipAddress: string;
  macAddress: string;
  hostname?: string;
  os?: string;
  vendor?: string;
  status?: string;
}

// Interface pour les resultats du scan
interface NmapScanResult {
  success: boolean;
  devices: NmapDevice[];
  error?: string;
}

// Interface pour le resultat de detection reseau
interface NetworkDetectionResult {
  gateway: string;
  startIP: string;
  netmask: string;
  devices: NmapDevice[];
}

// Interface correspondant au schema de la table appareils
interface DeviceRecord {
  id: string;
  hostname: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  os: string | null;
  deviceType: string | null;
  stats: any | null;
  lastSeen: Date;
  firstDiscovered: Date;
}

@Injectable()
export class NetworkDetectorService {
  private readonly logger = new Logger(NetworkDetectorService.name);

  constructor(private readonly nmapAgent: NmapAgentService) {}

  async detectCurrentNetwork(): Promise<NetworkDetectionResult> {
    try {
      // Recuperation des infos reseau
      const networkInfo = await this.getNetworkInfo();
      this.logger.log(`[DETECT] Infos reseau: ${JSON.stringify(networkInfo)}`);

      // Scan du reseau
      const scanResult = await this.scanNetworkViaRouter(networkInfo);
      
      // Enrichissement des donnees
      const enrichedDevices = await this.enrichDevicesInfo(scanResult);

      // Conversion en format NmapDevice pour le retour
      const nmapDevices: NmapDevice[] = enrichedDevices.map(device => ({
        ipAddress: device.ipAddress || '',
        macAddress: device.macAddress || '',
        hostname: device.hostname || undefined,
        os: device.os || undefined,
        vendor: device.deviceType || undefined,
        status: device.stats?.status || undefined
      }));

      return {
        gateway: networkInfo.gateway,
        startIP: networkInfo.startIP,
        netmask: networkInfo.netmask,
        devices: nmapDevices
      };

    } catch (error) {
      this.logger.error(`[DETECT] Erreur: ${error.message}`);
      throw error;
    }
  }

  private async scanNetworkViaRouter(networkInfo: { gateway: string; startIP: string; netmask: string }): Promise<DeviceRecord[]> {
    try {
      const networkRange = this.calculateNetworkRange(networkInfo.startIP, networkInfo.netmask);
      this.logger.log(`[SCAN] Plage reseau detectee: ${networkRange}`);

      const scanConfig = {
        target: networkRange,
        osDetection: true,
        serviceDetection: true,
        macAddressDetection: true,
        vendorDetection: true,
        quick: false
      };

      const scanResult = await this.nmapAgent.execute(scanConfig) as NmapScanResult;
      
      if (!scanResult.success) {
        throw new Error(`Erreur scan nmap: ${scanResult.error}`);
      }

      // Conversion en format Device conforme au schema BD
      return scanResult.devices.map(device => ({
        id: uuidv4(),
        hostname: device.hostname || null,
        ipAddress: device.ipAddress || null,
        macAddress: device.macAddress || null,
        os: device.os || null,
        deviceType: this.determineDeviceType(device.vendor, device.os),
        stats: null, // Sera mis a jour plus tard
        lastSeen: new Date(),
        firstDiscovered: new Date()
      }));

    } catch (error) {
      this.logger.error(`[SCAN] Erreur: ${error.message}`);
      throw error;
    }
  }

  private calculateNetworkRange(ip: string, netmask: string): string {
    // Conversion du masque en notation CIDR
    const maskParts = netmask.split('.').map(Number);
    const cidr = maskParts.reduce((acc, octet) => {
      return acc + octet.toString(2).split('1').length - 1;
    }, 0);

    // Retourne la plage au format CIDR
    return `${ip}/${cidr}`;
  }

  private async getNetworkInfo(): Promise<{ gateway: string; startIP: string; netmask: string }> {
    try {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'ipconfig /all' : 'ip route | grep default';
      const { stdout } = await execAsync(command);

      if (isWindows) {
        // Parse Windows ipconfig output
        const adapterMatch = stdout.match(/Wireless LAN adapter Wi-Fi:[\s\S]*?IPv4 Address[^:]*: ([0-9.]+)[\s\S]*?Default Gateway[^:]*: ([0-9.]+)[\s\S]*?Subnet Mask[^:]*: ([0-9.]+)/i);
        if (!adapterMatch) {
          throw new Error('Impossible de trouver les informations reseau');
        }

        const [, ip, gateway, netmask] = adapterMatch;
        return {
          startIP: ip,
          gateway: gateway || '',
          netmask: netmask || ''
        };
      } else {
        // Parse Linux ip route output
        const match = stdout.match(/default via ([0-9.]+) dev \w+ src ([0-9.]+)/);
        if (!match) {
          throw new Error('Impossible de trouver les informations reseau');
        }

        const [, gateway, ip] = match;
        // Pour Linux, on utilise une netmask par defaut
        const netmask = '255.255.255.0';
        return {
          startIP: ip,
          gateway,
          netmask
        };
      }
    } catch (error) {
      this.logger.error('[NETWORK] Erreur obtention infos reseau:', error);
      throw error;
    }
  }

  private cidrToNetmask(cidr: string): string {
    const parts = cidr.split('.');
    return parts.map(part => parseInt(part).toString(2).padStart(8, '0')).join('');
  }

  private async getLocalARPTable(): Promise<{ ip: string; mac: string }[]> {
    try {
      let command = '';
      let parseOutput: (output: string) => { ip: string; mac: string }[];

      if (os.platform() === 'win32') {
        command = 'arp -a';
        parseOutput = (output: string) => {
          const lines = output.split('\n');
          const devices: { ip: string; mac: string }[] = [];
          
          for (const line of lines) {
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
      return parseOutput(stdout);
    } catch (error) {
      this.logger.error(`[ARP] Erreur: ${error.message}`);
      throw error;
    }
  }

  private determineDeviceType(vendor?: string, os?: string): string | null {
    if (!vendor && !os) return null;

    const vendorLower = vendor?.toLowerCase() || '';
    const osLower = os?.toLowerCase() || '';

    // Detection du type d'appareil basee sur le vendeur et l'OS
    if (vendorLower.includes('cisco')) {
      if (vendorLower.includes('router')) return 'Router';
      if (vendorLower.includes('switch')) return 'Switch';
      if (vendorLower.includes('firewall')) return 'Firewall';
      return 'Switch'; // Par defaut pour Cisco
    }

    if (vendorLower.includes('juniper')) {
      if (vendorLower.includes('router')) return 'Router';
      if (vendorLower.includes('switch')) return 'Switch';
      if (vendorLower.includes('firewall')) return 'Firewall';
      return 'Router'; // Par defaut pour Juniper
    }

    if (vendorLower.includes('mikrotik')) return 'Router';
    if (vendorLower.includes('ubiquiti')) return 'Access Point';
    if (vendorLower.includes('aruba')) return 'Access Point';
    if (vendorLower.includes('fortinet')) return 'Firewall';

    // Detection basee sur l'OS
    if (osLower.includes('windows')) return 'Serveur';
    if (osLower.includes('linux')) return 'Serveur';
    if (osLower.includes('android')) return 'Mobile';
    if (osLower.includes('ios')) return 'Mobile';

    return null;
  }

  private async enrichDevicesInfo(devices: DeviceRecord[]): Promise<DeviceRecord[]> {
    const enrichedDevices = await Promise.all(devices.map(async (device) => {
      try {
        // Resolution DNS si pas de hostname
        if (!device.hostname && device.ipAddress) {
          try {
            const hostnames = await promisify(dns.reverse)(device.ipAddress);
            if (hostnames && hostnames.length > 0) {
              device.hostname = hostnames[0];
            }
          } catch (error) {
            this.logger.debug(`[ENRICH] Erreur resolution DNS pour ${device.ipAddress}: ${error.message}`);
          }
        }

        // Test de connectivite et mise a jour des stats
        if (device.ipAddress) {
          const isOnline = await this.checkDeviceStatus(device.ipAddress);
          device.stats = {
            status: isOnline,
            lastCheck: new Date()
          };
          device.lastSeen = new Date();
        }

        return device;
      } catch (error) {
        this.logger.debug(`[ENRICH] Erreur pour ${device.ipAddress}: ${error.message}`);
        return device;
      }
    }));

    return enrichedDevices;
  }

  private async checkDeviceStatus(ip: string): Promise<DeviceStatus> {
    try {
      const { stdout } = await execAsync(`ping -n 1 -w 1000 ${ip}`);
      if (stdout.includes('TTL=')) {
        return DeviceStatus.ACTIVE;
      }
      return DeviceStatus.INACTIVE;
    } catch (error) {
      return DeviceStatus.INACTIVE;
    }
  }

  private prefixToNetmask(prefix: number): string {
    const mask = [];
    for (let i = 0; i < 4; i++) {
      const bits = Math.min(8, Math.max(0, prefix - i * 8));
      mask.push(256 - Math.pow(2, 8 - bits));
    }
    return mask.join('.');
  }

  // Methode publique pour tester la detection reseau
  async testNetworkSetup(): Promise<{
    networkInfo: {
      gateway: string;
      startIP: string;
      netmask: string;
    };
    devices: {
      total: number;
      online: number;
      offline: number;
      vendors: { [key: string]: number };
    };
  }> {
    try {
      // 1. Recuperation des informations reseau
      const networkInfo = await this.getNetworkInfo();
      this.logger.log('[TEST] Informations reseau:', networkInfo);

      // 2. Scan et analyse des appareils
      const devices = await this.scanNetworkViaRouter(networkInfo);
      const enrichedDevices = await this.enrichDevicesInfo(devices);
      
      // Statistiques des vendeurs
      const vendors = enrichedDevices.reduce((acc, device) => {
        if (device.deviceType) {
          acc[device.deviceType] = (acc[device.deviceType] || 0) + 1;
        }
        return acc;
      }, {} as { [key: string]: number });

      const stats = {
        total: enrichedDevices.length,
        online: enrichedDevices.filter(d => d.stats?.status === 'online').length,
        offline: enrichedDevices.filter(d => d.stats?.status === 'offline').length,
        vendors
      };

      return {
        networkInfo,
        devices: stats
      };
    } catch (error) {
      this.logger.error(`[TEST] Erreur: ${error.message}`);
      throw error;
    }
  }
} 
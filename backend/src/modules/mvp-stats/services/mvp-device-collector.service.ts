import { Injectable, Logger } from '@nestjs/common';
import { execAsync } from '../../../utils/exec-async';
import { Device } from '../../network/device.model';
import { 
  MvpDeviceStats, 
  MvpSystemStats, 
  MvpNetworkStats, 
  MvpCollectionConfig,
  MvpToolsAvailability 
} from '../mvp-stats.types';

@Injectable()
export class MvpDeviceCollector {
  private readonly logger = new Logger(MvpDeviceCollector.name);
  private toolsAvailability: MvpToolsAvailability | null = null;

  /**
   * Collecte les statistiques pour un appareil spécifique
   */
  async collectDeviceStats(
    device: Device, 
    config: MvpCollectionConfig
  ): Promise<MvpDeviceStats> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Début collecte pour ${device.hostname} (${device.ipAddress})`);

      // Vérifier la disponibilité des outils si pas encore fait
      if (!this.toolsAvailability) {
        this.toolsAvailability = await this.checkToolsAvailability();
      }

      // Collecte parallèle des statistiques système et réseau
      const [systemStats, networkStats] = await Promise.all([
        this.collectSystemStats(device, config),
        this.collectNetworkStats(device, config)
      ]);

      const collectionTime = Date.now() - startTime;

      // Déterminer le statut de collecte
      const collectionStatus = this.determineCollectionStatus(systemStats, networkStats);

      const deviceStats: MvpDeviceStats = {
        deviceId: device.id,
        hostname: device.hostname,
        ipAddress: device.ipAddress,
        deviceType: device.deviceType,
        system: systemStats,
        network: networkStats,
        anomalies: [], // Sera rempli par le détecteur d'anomalies
        collectionStatus,
        collectionTime
      };

      this.logger.log(`Collecte terminée pour ${device.hostname} en ${collectionTime}ms (${collectionStatus})`);
      return deviceStats;

    } catch (error) {
      const collectionTime = Date.now() - startTime;
      this.logger.error(`Erreur collecte pour ${device.hostname}: ${error.message}`);

      return {
        deviceId: device.id,
        hostname: device.hostname,
        ipAddress: device.ipAddress,
        deviceType: device.deviceType,
        system: { cpu: 0, memory: 0, source: 'fallback', timestamp: new Date(), error: error.message },
        network: { 
          bandwidth: { download: 0, upload: 0 }, 
          latency: 0, 
          source: 'fallback', 
          success: false, 
          error: error.message 
        },
        anomalies: [],
        collectionStatus: 'failed',
        collectionTime,
        error: error.message
      };
    }
  }

  /**
   * Collecte les statistiques système
   */
  private async collectSystemStats(
    device: Device, 
    config: MvpCollectionConfig
  ): Promise<MvpSystemStats> {
    try {
      // Essayer d'abord la collecte via SNMP si c'est un équipement réseau
      if (this.isNetworkDevice(device.deviceType)) {
        const snmpStats = await this.collectSystemStatsViaSNMP(device);
        if (snmpStats.success) {
          return snmpStats;
        }
      }

      // Fallback sur la collecte native Windows
      return await this.collectSystemStatsNative();

    } catch (error) {
      this.logger.error(`Erreur collecte système pour ${device.hostname}: ${error.message}`);
      return {
        cpu: 0,
        memory: 0,
        source: 'fallback',
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Collecte des statistiques système via SNMP
   */
  private async collectSystemStatsViaSNMP(device: Device): Promise<MvpSystemStats> {
    try {
      // Commande SNMP pour récupérer CPU et mémoire
      const cpuCmd = `snmpwalk -v2c -c public ${device.ipAddress} 1.3.6.1.4.1.9.9.109.1.1.1.1.3.1`;
      const memoryCmd = `snmpwalk -v2c -c public ${device.ipAddress} 1.3.6.1.4.1.9.9.48.1.1.1.6.1`;

      const [cpuResult, memoryResult] = await Promise.all([
        execAsync(cpuCmd).catch(() => null),
        execAsync(memoryCmd).catch(() => null)
      ]);

      if (cpuResult && memoryResult) {
        const cpu = this.parseSNMPValue(cpuResult.stdout);
        const memory = this.parseSNMPValue(memoryResult.stdout);

        return {
          cpu: cpu || 0,
          memory: memory || 0,
          source: 'nmap',
          timestamp: new Date(),
          success: true
        };
      }

      return { 
        cpu: 0,
        memory: 0,
        source: 'fallback',
        timestamp: new Date(),
        success: false 
      };

    } catch (error) {
      this.logger.warn(`SNMP non disponible pour ${device.hostname}: ${error.message}`);
      return { success: false } as any;
    }
  }

  /**
   * Collecte des statistiques système natives Windows
   */
  private async collectSystemStatsNative(): Promise<MvpSystemStats> {
    try {
      const cpuCmd = 'Get-Counter "\\Processor(_Total)\\% Processor Time" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue';
      const memoryCmd = 'Get-Counter "\\Memory\\Available MBytes" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue';
      
      const [cpu, memory] = await Promise.all([
        execAsync(`powershell -Command "${cpuCmd}"`),
        execAsync(`powershell -Command "${memoryCmd}"`)
      ]);

      return {
        cpu: parseFloat(cpu.stdout.trim()) || 0,
        memory: parseFloat(memory.stdout.trim()) || 0,
        source: 'windows-native',
        timestamp: new Date(),
        success: true
      };

    } catch (error) {
      this.logger.error(`Erreur collecte système native: ${error.message}`);
      throw error;
    }
  }

  /**
   * Collecte des statistiques réseau
   */
  private async collectNetworkStats(
    device: Device, 
    config: MvpCollectionConfig
  ): Promise<MvpNetworkStats> {
    try {
      // Essayer d'abord Iperf3 si disponible et configuré
      if (config.useIperf3 && this.toolsAvailability?.iperf3) {
        const iperfStats = await this.collectNetworkStatsViaIperf3(device);
        if (iperfStats.success) {
          return iperfStats;
        }
      }

      // Essayer Nmap si disponible et configuré
      if (config.useNmap && this.toolsAvailability?.nmap) {
        const nmapStats = await this.collectNetworkStatsViaNmap(device);
        if (nmapStats.success) {
          return nmapStats;
        }
      }

      // Fallback sur la collecte native Windows
      return await this.collectNetworkStatsNative(device);

    } catch (error) {
      this.logger.error(`Erreur collecte réseau pour ${device.hostname}: ${error.message}`);
      return {
        bandwidth: { download: 0, upload: 0 },
        latency: 0,
        source: 'fallback',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Collecte des statistiques réseau via Iperf3
   */
  private async collectNetworkStatsViaIperf3(device: Device): Promise<MvpNetworkStats> {
    try {
      // Test de bande passante vers l'appareil (3 secondes max pour MVP)
      const result = await execAsync(`iperf3 -c ${device.ipAddress} -t 3 -J`);
      const data = JSON.parse(result.stdout);
      
      return {
        bandwidth: {
          download: data.end.sum_received.bits_per_second / 1000000, // Mbps
          upload: data.end.sum_sent.bits_per_second / 1000000
        },
        latency: data.end.sum_rtt / 1000, // ms
        jitter: data.end.sum_rtt / 1000,
        source: 'iperf3',
        success: true
      };

    } catch (error) {
      this.logger.warn(`Iperf3 échoué pour ${device.hostname}: ${error.message}`);
      return { success: false } as any;
    }
  }

  /**
   * Collecte des statistiques réseau via Nmap
   */
  private async collectNetworkStatsViaNmap(device: Device): Promise<MvpNetworkStats> {
    try {
      // Scan rapide pour déterminer la latence
      const result = await execAsync(`nmap -sn ${device.ipAddress}`);
      
      // Extraire la latence du résultat (approximatif)
      const latencyMatch = result.stdout.match(/Host is up \((\d+\.?\d*)s latency\)/);
      const latency = latencyMatch ? parseFloat(latencyMatch[1]) * 1000 : 0;

      return {
        bandwidth: { download: 0, upload: 0 }, // Nmap ne mesure pas la bande passante
        latency,
        source: 'nmap',
        success: true
      };

    } catch (error) {
      this.logger.warn(`Nmap échoué pour ${device.hostname}: ${error.message}`);
      return { success: false } as any;
    }
  }

  /**
   * Collecte des statistiques réseau natives Windows
   */
  private async collectNetworkStatsNative(device: Device): Promise<MvpNetworkStats> {
    try {
      // Mesurer la latence via ping
      const latency = await this.measureLatency(device.ipAddress);

      // Récupérer les statistiques des adaptateurs réseau
      const adapters = await this.getNetworkAdaptersStats();

      // Calculer la bande passante approximative
      const totalReceived = adapters.reduce((sum, adapter) => sum + adapter.receivedBytes, 0);
      const totalSent = adapters.reduce((sum, adapter) => sum + adapter.sentBytes, 0);

      return {
        bandwidth: {
          download: (totalReceived * 8) / 1000000, // Approximation en Mbps
          upload: (totalSent * 8) / 1000000
        },
        latency,
        adapters,
        source: 'windows-native',
        success: true
      };

    } catch (error) {
      this.logger.error(`Erreur collecte réseau native: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mesure la latence vers un appareil
   */
  private async measureLatency(ipAddress: string): Promise<number> {
    try {
      const result = await execAsync(`ping -n 1 ${ipAddress}`);
      const match = result.stdout.match(/temps[=<](\d+)ms/i);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Récupère les statistiques des adaptateurs réseau
   */
  private async getNetworkAdaptersStats(): Promise<Array<{
    name: string;
    receivedBytes: number;
    sentBytes: number;
    receivedPackets: number;
    sentPackets: number;
  }>> {
    try {
      const cmd = `
        $adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" }
        $stats = @()
        foreach ($adapter in $adapters) {
          $interfaceStats = Get-NetAdapterStatistics -Name $adapter.Name
          $stats += @{
            name = $adapter.Name
            receivedBytes = $interfaceStats.ReceivedBytes
            sentBytes = $interfaceStats.SentBytes
            receivedPackets = $interfaceStats.ReceivedUnicastPackets
            sentPackets = $interfaceStats.SentUnicastPackets
          }
        }
        ConvertTo-Json -Compress $stats
      `;

      const result = await execAsync(`powershell -Command "${cmd}"`);
      return JSON.parse(result.stdout);

    } catch (error) {
      this.logger.error(`Erreur récupération adaptateurs: ${error.message}`);
      return [];
    }
  }

  /**
   * Vérifie la disponibilité des outils tiers
   */
  public async checkToolsAvailability(): Promise<MvpToolsAvailability> {
    const tools = {
      iperf3: false,
      nmap: false,
      tshark: false,
      powershell: false,
      ping: false
    };

    try {
      await execAsync('iperf3 --version');
      tools.iperf3 = true;
    } catch (error) {
      this.logger.warn('Iperf3 non disponible');
    }

    try {
      await execAsync('nmap --version');
      tools.nmap = true;
    } catch (error) {
      this.logger.warn('Nmap non disponible');
    }

    try {
      await execAsync('tshark --version');
      tools.tshark = true;
    } catch (error) {
      this.logger.warn('Tshark non disponible');
    }

    try {
      await execAsync('powershell -Command "Get-Command"');
      tools.powershell = true;
    } catch (error) {
      this.logger.warn('PowerShell non disponible');
    }

    try {
      await execAsync('ping -n 1 127.0.0.1');
      tools.ping = true;
    } catch (error) {
      this.logger.warn('Ping non disponible');
    }

    return tools;
  }

  /**
   * Détermine si un appareil est un équipement réseau
   */
  private isNetworkDevice(deviceType: string): boolean {
    return ['router', 'switch', 'ap'].includes(deviceType);
  }

  /**
   * Parse une valeur SNMP
   */
  private parseSNMPValue(snmpOutput: string): number {
    try {
      const match = snmpOutput.match(/INTEGER: (\d+)/);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Détermine le statut de collecte basé sur les résultats
   */
  private determineCollectionStatus(
    systemStats: MvpSystemStats, 
    networkStats: MvpNetworkStats
  ): 'success' | 'partial' | 'failed' {
    const systemSuccess = !systemStats.error && systemStats.cpu >= 0;
    const networkSuccess = networkStats.success;

    if (systemSuccess && networkSuccess) {
      return 'success';
    } else if (systemSuccess || networkSuccess) {
      return 'partial';
    } else {
      return 'failed';
    }
  }
} 
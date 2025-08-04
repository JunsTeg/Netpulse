import { Injectable, Logger } from '@nestjs/common';
import { execAsync } from '../../utils/exec-async';

@Injectable()
export class MvpCollectorService {
  private readonly logger = new Logger(MvpCollectorService.name);

  /**
   * Collecte hybride optimisée : Windows natif + outils tiers
   */
  async collectHybridStats(): Promise<any> {
    const stats = {
      timestamp: new Date(),
      system: await this.getSystemStats(),
      network: await this.getNetworkStats(),
      anomalies: await this.detectAnomalies()
    };

    return stats;
  }

  /**
   * Statistiques système natives Windows (toujours disponibles)
   */
  private async getSystemStats(): Promise<any> {
    try {
      // CPU et mémoire - toujours disponibles
      const cpuCmd = 'Get-Counter "\\Processor(_Total)\\% Processor Time" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue';
      const memoryCmd = 'Get-Counter "\\Memory\\Available MBytes" | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue';
      
      const [cpu, memory] = await Promise.all([
        execAsync(`powershell -Command "${cpuCmd}"`),
        execAsync(`powershell -Command "${memoryCmd}"`)
      ]);

      return {
        cpu: parseFloat(cpu.stdout.trim()),
        memory: parseFloat(memory.stdout.trim()),
        source: 'windows-native'
      };
    } catch (error) {
      this.logger.error(`Erreur collecte système: ${error.message}`);
      return { error: 'collecte-systeme-echouee' };
    }
  }

  /**
   * Statistiques réseau avec fallback intelligent
   */
  private async getNetworkStats(): Promise<any> {
    try {
      // 1. Essayer d'abord les outils tiers (plus précis)
      const iperfStats = await this.getIperfStats();
      if (iperfStats.success) {
        return { ...iperfStats, source: 'iperf3' };
      }

      // 2. Fallback sur Windows natif
      const nativeStats = await this.getNativeNetworkStats();
      return { ...nativeStats, source: 'windows-native' };

    } catch (error) {
      this.logger.error(`Erreur collecte réseau: ${error.message}`);
      return { error: 'collecte-reseau-echouee' };
    }
  }

  /**
   * Test de bande passante avec Iperf3 (outil tiers)
   */
  private async getIperfStats(): Promise<any> {
    try {
      // Vérifier si iperf3 est disponible
      await execAsync('iperf3 --version');
      
      // Test de bande passante (5 secondes max pour MVP)
      const result = await execAsync('iperf3 -c 8.8.8.8 -t 5 -J');
      const data = JSON.parse(result.stdout);
      
      return {
        success: true,
        bandwidth: {
          download: data.end.sum_received.bits_per_second / 1000000, // Mbps
          upload: data.end.sum_sent.bits_per_second / 1000000
        },
        latency: data.end.sum_rtt / 1000, // ms
        jitter: data.end.sum_rtt / 1000
      };
    } catch (error) {
      this.logger.warn(`Iperf3 non disponible: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Statistiques réseau natives Windows (fallback)
   */
  private async getNativeNetworkStats(): Promise<any> {
    try {
      // Utiliser les commandes PowerShell natives
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
      const adapters = JSON.parse(result.stdout);

      // Calculer la bande passante approximative
      const totalReceived = adapters.reduce((sum, adapter) => sum + adapter.receivedBytes, 0);
      const totalSent = adapters.reduce((sum, adapter) => sum + adapter.sentBytes, 0);

      return {
        success: true,
        bandwidth: {
          download: (totalReceived * 8) / 1000000, // Approximation en Mbps
          upload: (totalSent * 8) / 1000000
        },
        adapters: adapters,
        latency: await this.getNativeLatency()
      };
    } catch (error) {
      this.logger.error(`Erreur stats natives: ${error.message}`);
      return { success: false };
    }
  }

  /**
   * Latence native Windows
   */
  private async getNativeLatency(): Promise<number> {
    try {
      const result = await execAsync('ping -n 1 8.8.8.8');
      const match = result.stdout.match(/temps[=<](\d+)ms/i);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Détection d'anomalies simple mais efficace
   */
  private async detectAnomalies(): Promise<any> {
    try {
      const currentStats = await this.getSystemStats();
      const networkStats = await this.getNetworkStats();

      const anomalies = [];

      // Seuils de base pour MVP
      if (currentStats.cpu > 80) {
        anomalies.push({
          type: 'high-cpu',
          severity: 'warning',
          message: `CPU élevé: ${currentStats.cpu.toFixed(1)}%`,
          threshold: 80
        });
      }

      if (currentStats.memory < 1000) { // Mo
        anomalies.push({
          type: 'low-memory',
          severity: 'critical',
          message: `Mémoire faible: ${currentStats.memory.toFixed(0)} MB`,
          threshold: 1000
        });
      }

      if (networkStats.bandwidth?.download < 1) { // Mbps
        anomalies.push({
          type: 'low-bandwidth',
          severity: 'warning',
          message: `Bande passante faible: ${networkStats.bandwidth.download.toFixed(2)} Mbps`,
          threshold: 1
        });
      }

      if (networkStats.latency > 100) { // ms
        anomalies.push({
          type: 'high-latency',
          severity: 'warning',
          message: `Latence élevée: ${networkStats.latency}ms`,
          threshold: 100
        });
      }

      return {
        count: anomalies.length,
        anomalies: anomalies,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur détection anomalies: ${error.message}`);
      return { count: 0, anomalies: [], error: 'detection-echouee' };
    }
  }

  /**
   * Vérification de la disponibilité des outils tiers
   */
  async checkToolsAvailability(): Promise<any> {
    const tools = {
      iperf3: false,
      nmap: false,
      tshark: false
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

    return tools;
  }
} 
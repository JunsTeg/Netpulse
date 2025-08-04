import { Injectable, Logger } from '@nestjs/common';
import { 
  MvpAnomaly, 
  MvpAnomalyReport, 
  MvpDeviceStats, 
  MvpAnomalyThresholds 
} from '../mvp-stats.types';

@Injectable()
export class MvpAnomalyDetector {
  private readonly logger = new Logger(MvpAnomalyDetector.name);

  // Seuils par défaut pour MVP
  private readonly defaultThresholds: MvpAnomalyThresholds = {
    cpu: {
      warning: 70,
      critical: 90
    },
    memory: {
      warning: 2000, // MB
      critical: 1000
    },
    bandwidth: {
      warning: 5, // Mbps
      critical: 1
    },
    latency: {
      warning: 100, // ms
      critical: 200
    },
    packetLoss: {
      warning: 5, // %
      critical: 10
    }
  };

  /**
   * Détecte les anomalies pour un appareil spécifique
   */
  async detectDeviceAnomalies(
    deviceStats: MvpDeviceStats,
    customThresholds?: Partial<MvpAnomalyThresholds>
  ): Promise<MvpAnomaly[]> {
    const thresholds = { ...this.defaultThresholds, ...customThresholds };
    const anomalies: MvpAnomaly[] = [];

    try {
      // Détection d'anomalies système
      const systemAnomalies = this.detectSystemAnomalies(deviceStats, thresholds);
      anomalies.push(...systemAnomalies);

      // Détection d'anomalies réseau
      const networkAnomalies = this.detectNetworkAnomalies(deviceStats, thresholds);
      anomalies.push(...networkAnomalies);

      // Détection d'anomalies de connectivité
      const connectivityAnomalies = this.detectConnectivityAnomalies(deviceStats);
      anomalies.push(...connectivityAnomalies);

      // Ajouter l'ID de l'appareil à toutes les anomalies
      anomalies.forEach(anomaly => {
        anomaly.deviceId = deviceStats.deviceId;
      });

      this.logger.log(`Détecté ${anomalies.length} anomalies pour ${deviceStats.hostname}`);

    } catch (error) {
      this.logger.error(`Erreur détection anomalies pour ${deviceStats.hostname}: ${error.message}`);
    }

    return anomalies;
  }

  /**
   * Détecte les anomalies système (CPU, mémoire)
   */
  private detectSystemAnomalies(
    deviceStats: MvpDeviceStats,
    thresholds: MvpAnomalyThresholds
  ): MvpAnomaly[] {
    const anomalies: MvpAnomaly[] = [];

    // Vérification CPU
    if (deviceStats.system.cpu > thresholds.cpu.critical) {
      anomalies.push({
        type: 'high-cpu',
        severity: 'critical',
        message: `CPU critique: ${deviceStats.system.cpu.toFixed(1)}%`,
        threshold: thresholds.cpu.critical,
        currentValue: deviceStats.system.cpu,
        timestamp: new Date()
      });
    } else if (deviceStats.system.cpu > thresholds.cpu.warning) {
      anomalies.push({
        type: 'high-cpu',
        severity: 'warning',
        message: `CPU élevé: ${deviceStats.system.cpu.toFixed(1)}%`,
        threshold: thresholds.cpu.warning,
        currentValue: deviceStats.system.cpu,
        timestamp: new Date()
      });
    }

    // Vérification mémoire
    if (deviceStats.system.memory < thresholds.memory.critical) {
      anomalies.push({
        type: 'low-memory',
        severity: 'critical',
        message: `Mémoire critique: ${deviceStats.system.memory.toFixed(0)} MB`,
        threshold: thresholds.memory.critical,
        currentValue: deviceStats.system.memory,
        timestamp: new Date()
      });
    } else if (deviceStats.system.memory < thresholds.memory.warning) {
      anomalies.push({
        type: 'low-memory',
        severity: 'warning',
        message: `Mémoire faible: ${deviceStats.system.memory.toFixed(0)} MB`,
        threshold: thresholds.memory.warning,
        currentValue: deviceStats.system.memory,
        timestamp: new Date()
      });
    }

    return anomalies;
  }

  /**
   * Détecte les anomalies réseau (bande passante, latence)
   */
  private detectNetworkAnomalies(
    deviceStats: MvpDeviceStats,
    thresholds: MvpAnomalyThresholds
  ): MvpAnomaly[] {
    const anomalies: MvpAnomaly[] = [];

    // Vérification bande passante download
    if (deviceStats.network.bandwidth.download < thresholds.bandwidth.critical) {
      anomalies.push({
        type: 'low-bandwidth',
        severity: 'critical',
        message: `Bande passante critique: ${deviceStats.network.bandwidth.download.toFixed(2)} Mbps`,
        threshold: thresholds.bandwidth.critical,
        currentValue: deviceStats.network.bandwidth.download,
        timestamp: new Date()
      });
    } else if (deviceStats.network.bandwidth.download < thresholds.bandwidth.warning) {
      anomalies.push({
        type: 'low-bandwidth',
        severity: 'warning',
        message: `Bande passante faible: ${deviceStats.network.bandwidth.download.toFixed(2)} Mbps`,
        threshold: thresholds.bandwidth.warning,
        currentValue: deviceStats.network.bandwidth.download,
        timestamp: new Date()
      });
    }

    // Vérification bande passante upload
    if (deviceStats.network.bandwidth.upload < thresholds.bandwidth.critical) {
      anomalies.push({
        type: 'low-bandwidth',
        severity: 'critical',
        message: `Bande passante upload critique: ${deviceStats.network.bandwidth.upload.toFixed(2)} Mbps`,
        threshold: thresholds.bandwidth.critical,
        currentValue: deviceStats.network.bandwidth.upload,
        timestamp: new Date()
      });
    } else if (deviceStats.network.bandwidth.upload < thresholds.bandwidth.warning) {
      anomalies.push({
        type: 'low-bandwidth',
        severity: 'warning',
        message: `Bande passante upload faible: ${deviceStats.network.bandwidth.upload.toFixed(2)} Mbps`,
        threshold: thresholds.bandwidth.warning,
        currentValue: deviceStats.network.bandwidth.upload,
        timestamp: new Date()
      });
    }

    // Vérification latence
    if (deviceStats.network.latency > thresholds.latency.critical) {
      anomalies.push({
        type: 'high-latency',
        severity: 'critical',
        message: `Latence critique: ${deviceStats.network.latency}ms`,
        threshold: thresholds.latency.critical,
        currentValue: deviceStats.network.latency,
        timestamp: new Date()
      });
    } else if (deviceStats.network.latency > thresholds.latency.warning) {
      anomalies.push({
        type: 'high-latency',
        severity: 'warning',
        message: `Latence élevée: ${deviceStats.network.latency}ms`,
        threshold: thresholds.latency.warning,
        currentValue: deviceStats.network.latency,
        timestamp: new Date()
      });
    }

    // Vérification perte de paquets si disponible
    if (deviceStats.network.packetLoss !== undefined) {
      if (deviceStats.network.packetLoss > thresholds.packetLoss.critical) {
        anomalies.push({
          type: 'packet-loss',
          severity: 'critical',
          message: `Perte de paquets critique: ${deviceStats.network.packetLoss}%`,
          threshold: thresholds.packetLoss.critical,
          currentValue: deviceStats.network.packetLoss,
          timestamp: new Date()
        });
      } else if (deviceStats.network.packetLoss > thresholds.packetLoss.warning) {
        anomalies.push({
          type: 'packet-loss',
          severity: 'warning',
          message: `Perte de paquets élevée: ${deviceStats.network.packetLoss}%`,
          threshold: thresholds.packetLoss.warning,
          currentValue: deviceStats.network.packetLoss,
          timestamp: new Date()
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecte les anomalies de connectivité
   */
  private detectConnectivityAnomalies(deviceStats: MvpDeviceStats): MvpAnomaly[] {
    const anomalies: MvpAnomaly[] = [];

    // Vérification du statut de collecte
    if (deviceStats.collectionStatus === 'failed') {
      anomalies.push({
        type: 'service-down',
        severity: 'critical',
        message: `Impossible de collecter les statistiques de l'appareil`,
        threshold: 0,
        currentValue: 0,
        timestamp: new Date()
      });
    } else if (deviceStats.collectionStatus === 'partial') {
      anomalies.push({
        type: 'service-down',
        severity: 'warning',
        message: `Collecte partielle des statistiques`,
        threshold: 0,
        currentValue: 0,
        timestamp: new Date()
      });
    }

    // Vérification des erreurs de collecte
    if (deviceStats.system.error) {
      anomalies.push({
        type: 'service-down',
        severity: 'warning',
        message: `Erreur collecte système: ${deviceStats.system.error}`,
        threshold: 0,
        currentValue: 0,
        timestamp: new Date()
      });
    }

    if (deviceStats.network.error) {
      anomalies.push({
        type: 'service-down',
        severity: 'warning',
        message: `Erreur collecte réseau: ${deviceStats.network.error}`,
        threshold: 0,
        currentValue: 0,
        timestamp: new Date()
      });
    }

    return anomalies;
  }

  /**
   * Détecte les anomalies globales pour tous les appareils
   */
  async detectGlobalAnomalies(
    allDeviceStats: MvpDeviceStats[],
    customThresholds?: Partial<MvpAnomalyThresholds>
  ): Promise<MvpAnomalyReport> {
    const thresholds = { ...this.defaultThresholds, ...customThresholds };
    const allAnomalies: MvpAnomaly[] = [];

    try {
      // Détecter les anomalies pour chaque appareil
      for (const deviceStats of allDeviceStats) {
        const deviceAnomalies = await this.detectDeviceAnomalies(deviceStats, thresholds);
        allAnomalies.push(...deviceAnomalies);
      }

      // Détecter les anomalies globales (patterns sur l'ensemble du réseau)
      const globalAnomalies = this.detectNetworkWideAnomalies(allDeviceStats, thresholds);
      allAnomalies.push(...globalAnomalies);

      const report: MvpAnomalyReport = {
        count: allAnomalies.length,
        anomalies: allAnomalies,
        timestamp: new Date()
      };

      this.logger.log(`Détecté ${allAnomalies.length} anomalies globales`);

      return report;

    } catch (error) {
      this.logger.error(`Erreur détection anomalies globales: ${error.message}`);
      return {
        count: 0,
        anomalies: [],
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  /**
   * Détecte les anomalies à l'échelle du réseau
   */
  private detectNetworkWideAnomalies(
    allDeviceStats: MvpDeviceStats[],
    thresholds: MvpAnomalyThresholds
  ): MvpAnomaly[] {
    const anomalies: MvpAnomaly[] = [];

    try {
      // Calculer les moyennes globales
      const validDevices = allDeviceStats.filter(d => d.collectionStatus !== 'failed');
      
      if (validDevices.length === 0) {
        return anomalies;
      }

      const avgCpu = validDevices.reduce((sum, d) => sum + d.system.cpu, 0) / validDevices.length;
      const avgMemory = validDevices.reduce((sum, d) => sum + d.system.memory, 0) / validDevices.length;
      const avgLatency = validDevices.reduce((sum, d) => sum + d.network.latency, 0) / validDevices.length;
      const avgBandwidth = validDevices.reduce((sum, d) => sum + d.network.bandwidth.download, 0) / validDevices.length;

      // Détecter les problèmes globaux
      if (avgCpu > thresholds.cpu.warning) {
        anomalies.push({
          type: 'high-cpu',
          severity: 'warning',
          message: `CPU moyen élevé sur le réseau: ${avgCpu.toFixed(1)}%`,
          threshold: thresholds.cpu.warning,
          currentValue: avgCpu,
          timestamp: new Date()
        });
      }

      if (avgMemory < thresholds.memory.warning) {
        anomalies.push({
          type: 'low-memory',
          severity: 'warning',
          message: `Mémoire moyenne faible sur le réseau: ${avgMemory.toFixed(0)} MB`,
          threshold: thresholds.memory.warning,
          currentValue: avgMemory,
          timestamp: new Date()
        });
      }

      if (avgLatency > thresholds.latency.warning) {
        anomalies.push({
          type: 'high-latency',
          severity: 'warning',
          message: `Latence moyenne élevée sur le réseau: ${avgLatency.toFixed(0)}ms`,
          threshold: thresholds.latency.warning,
          currentValue: avgLatency,
          timestamp: new Date()
        });
      }

      if (avgBandwidth < thresholds.bandwidth.warning) {
        anomalies.push({
          type: 'low-bandwidth',
          severity: 'warning',
          message: `Bande passante moyenne faible sur le réseau: ${avgBandwidth.toFixed(2)} Mbps`,
          threshold: thresholds.bandwidth.warning,
          currentValue: avgBandwidth,
          timestamp: new Date()
        });
      }

      // Détecter les appareils défaillants
      const failedDevices = allDeviceStats.filter(d => d.collectionStatus === 'failed');
      if (failedDevices.length > 0) {
        const failureRate = (failedDevices.length / allDeviceStats.length) * 100;
        
        if (failureRate > 20) { // Plus de 20% d'échecs
          anomalies.push({
            type: 'service-down',
            severity: 'critical',
            message: `Taux d'échec élevé: ${failureRate.toFixed(1)}% des appareils non accessibles`,
            threshold: 20,
            currentValue: failureRate,
            timestamp: new Date()
          });
        } else if (failureRate > 10) { // Plus de 10% d'échecs
          anomalies.push({
            type: 'service-down',
            severity: 'warning',
            message: `Taux d'échec modéré: ${failureRate.toFixed(1)}% des appareils non accessibles`,
            threshold: 10,
            currentValue: failureRate,
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      this.logger.error(`Erreur détection anomalies réseau: ${error.message}`);
    }

    return anomalies;
  }

  /**
   * Met à jour les seuils d'anomalies
   */
  updateThresholds(newThresholds: Partial<MvpAnomalyThresholds>): void {
    // Créer un nouvel objet au lieu de modifier l'existant
    Object.assign(this.defaultThresholds, newThresholds);
    this.logger.log('Seuils d\'anomalies mis à jour');
  }

  /**
   * Récupère les seuils actuels
   */
  getCurrentThresholds(): MvpAnomalyThresholds {
    return { ...this.defaultThresholds };
  }
} 
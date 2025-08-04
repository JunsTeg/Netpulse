import { Injectable, Logger } from '@nestjs/common';
import { 
  MvpGlobalStats, 
  MvpApiResponse, 
  MvpToolsAvailability,
  MvpDeviceStats 
} from '../mvp-stats.types';

@Injectable()
export class MvpResponseFormatter {
  private readonly logger = new Logger(MvpResponseFormatter.name);

  /**
   * Formate la réponse finale pour l'API
   */
  formatApiResponse(
    globalStats: MvpGlobalStats,
    toolsAvailable: MvpToolsAvailability,
    errors: string[] = [],
    warnings: string[] = []
  ): MvpApiResponse {
    try {
      // Déterminer le statut de succès
      const success = errors.length === 0 && globalStats.activeDevices > 0;

      // Créer le message principal
      const message = this.generateMainMessage(globalStats, success);

      // Formater les données pour l'API
      const formattedData = this.formatGlobalStats(globalStats);

      const response: MvpApiResponse = {
        success,
        data: formattedData,
        message,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          version: '1.0.0',
          collectionTime: new Date(),
          toolsAvailable
        }
      };

      this.logger.log(`Réponse formatée: ${globalStats.activeDevices}/${globalStats.totalDevices} appareils actifs`);

      return response;

    } catch (error) {
      this.logger.error(`Erreur formatage réponse: ${error.message}`);
      
      return {
        success: false,
        data: null as any,
        message: 'Erreur lors du formatage de la réponse',
        errors: [error.message],
        metadata: {
          version: '1.0.0',
          collectionTime: new Date(),
          toolsAvailable: {
            iperf3: false,
            nmap: false,
            tshark: false
          }
        }
      };
    }
  }

  /**
   * Formate les statistiques globales pour l'API
   */
  private formatGlobalStats(globalStats: MvpGlobalStats): MvpGlobalStats {
    return {
      ...globalStats,
      // Formater les données des appareils
      devices: globalStats.devices.map(device => this.formatDeviceStats(device)),
      // Formater les anomalies
      globalAnomalies: this.formatAnomalyReport(globalStats.globalAnomalies),
      // Formater le résumé
      summary: this.formatSummary(globalStats.summary)
    };
  }

  /**
   * Formate les statistiques d'un appareil
   */
  private formatDeviceStats(device: MvpDeviceStats): MvpDeviceStats {
    return {
      ...device,
      // Arrondir les valeurs numériques
      system: {
        ...device.system,
        cpu: Math.round(device.system.cpu * 100) / 100, // 2 décimales
        memory: Math.round(device.system.memory)
      },
      network: {
        ...device.network,
        bandwidth: {
          download: Math.round(device.network.bandwidth.download * 100) / 100, // 2 décimales
          upload: Math.round(device.network.bandwidth.upload * 100) / 100
        },
        latency: Math.round(device.network.latency),
        jitter: device.network.jitter ? Math.round(device.network.jitter) : undefined,
        packetLoss: device.network.packetLoss ? Math.round(device.network.packetLoss * 100) / 100 : undefined
      },
      // Formater les anomalies
      anomalies: device.anomalies.map(anomaly => ({
        ...anomaly,
        currentValue: Math.round(anomaly.currentValue * 100) / 100,
        threshold: Math.round(anomaly.threshold * 100) / 100
      }))
    };
  }

  /**
   * Formate le rapport d'anomalies
   */
  private formatAnomalyReport(anomalyReport: any): any {
    return {
      ...anomalyReport,
      anomalies: anomalyReport.anomalies.map((anomaly: any) => ({
        ...anomaly,
        currentValue: Math.round(anomaly.currentValue * 100) / 100,
        threshold: Math.round(anomaly.threshold * 100) / 100
      }))
    };
  }

  /**
   * Formate le résumé
   */
  private formatSummary(summary: any): any {
    return {
      avgCpu: Math.round(summary.avgCpu * 100) / 100,
      avgMemory: Math.round(summary.avgMemory),
      avgBandwidth: Math.round(summary.avgBandwidth * 100) / 100,
      avgLatency: Math.round(summary.avgLatency),
      totalAnomalies: summary.totalAnomalies
    };
  }

  /**
   * Génère le message principal de la réponse
   */
  private generateMainMessage(globalStats: MvpGlobalStats, success: boolean): string {
    if (!success) {
      return `Échec de la collecte: ${globalStats.failedDevices}/${globalStats.totalDevices} appareils non accessibles`;
    }

    const successRate = ((globalStats.activeDevices / globalStats.totalDevices) * 100).toFixed(1);
    const anomalyCount = globalStats.globalAnomalies.count;

    if (anomalyCount === 0) {
      return `Collecte réussie: ${globalStats.activeDevices}/${globalStats.totalDevices} appareils actifs (${successRate}%), aucune anomalie détectée`;
    } else {
      return `Collecte réussie: ${globalStats.activeDevices}/${globalStats.totalDevices} appareils actifs (${successRate}%), ${anomalyCount} anomalie(s) détectée(s)`;
    }
  }

  /**
   * Formate une réponse d'erreur
   */
  formatErrorResponse(
    error: string,
    toolsAvailable: MvpToolsAvailability
  ): MvpApiResponse {
    return {
      success: false,
      data: {
        timestamp: new Date(),
        totalDevices: 0,
        activeDevices: 0,
        failedDevices: 0,
        devices: [],
        globalAnomalies: {
          count: 0,
          anomalies: [],
          timestamp: new Date()
        },
        summary: {
          avgCpu: 0,
          avgMemory: 0,
          avgBandwidth: 0,
          avgLatency: 0,
          totalAnomalies: 0
        },
        collectionDuration: 0
      },
      message: `Erreur: ${error}`,
      errors: [error],
      metadata: {
        version: '1.0.0',
        collectionTime: new Date(),
        toolsAvailable
      }
    };
  }

  /**
   * Formate une réponse de succès partiel
   */
  formatPartialSuccessResponse(
    globalStats: MvpGlobalStats,
    toolsAvailable: MvpToolsAvailability,
    warnings: string[]
  ): MvpApiResponse {
    return {
      success: true,
      data: this.formatGlobalStats(globalStats),
      message: `Collecte partielle: ${globalStats.activeDevices}/${globalStats.totalDevices} appareils actifs`,
      warnings,
      metadata: {
        version: '1.0.0',
        collectionTime: new Date(),
        toolsAvailable
      }
    };
  }

  /**
   * Formate les données pour l'export CSV
   */
  formatForCsvExport(globalStats: MvpGlobalStats): string {
    try {
      const headers = [
        'Device ID',
        'Hostname',
        'IP Address',
        'Device Type',
        'CPU (%)',
        'Memory (MB)',
        'Bandwidth Download (Mbps)',
        'Bandwidth Upload (Mbps)',
        'Latency (ms)',
        'Collection Status',
        'Collection Time (ms)',
        'Anomalies Count'
      ];

      const rows = globalStats.devices.map(device => [
        device.deviceId,
        device.hostname,
        device.ipAddress,
        device.deviceType,
        device.system.cpu.toFixed(2),
        device.system.memory.toFixed(0),
        device.network.bandwidth.download.toFixed(2),
        device.network.bandwidth.upload.toFixed(2),
        device.network.latency.toFixed(0),
        device.collectionStatus,
        device.collectionTime.toString(),
        device.anomalies.length.toString()
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      return csvContent;

    } catch (error) {
      this.logger.error(`Erreur formatage CSV: ${error.message}`);
      return '';
    }
  }

  /**
   * Formate les données pour l'export JSON
   */
  formatForJsonExport(globalStats: MvpGlobalStats): string {
    try {
      const exportData = {
        exportInfo: {
          timestamp: new Date(),
          version: '1.0.0',
          totalDevices: globalStats.totalDevices,
          activeDevices: globalStats.activeDevices,
          failedDevices: globalStats.failedDevices
        },
        summary: globalStats.summary,
        devices: globalStats.devices.map(device => ({
          id: device.deviceId,
          hostname: device.hostname,
          ipAddress: device.ipAddress,
          deviceType: device.deviceType,
          metrics: {
            cpu: device.system.cpu,
            memory: device.system.memory,
            bandwidth: device.network.bandwidth,
            latency: device.network.latency
          },
          status: device.collectionStatus,
          anomalies: device.anomalies.length
        })),
        anomalies: globalStats.globalAnomalies.anomalies.map(anomaly => ({
          type: anomaly.type,
          severity: anomaly.severity,
          message: anomaly.message,
          deviceId: anomaly.deviceId,
          timestamp: anomaly.timestamp
        }))
      };

      return JSON.stringify(exportData, null, 2);

    } catch (error) {
      this.logger.error(`Erreur formatage JSON: ${error.message}`);
      return '{}';
    }
  }

  /**
   * Formate les données pour un tableau de bord
   */
  formatForDashboard(globalStats: MvpGlobalStats): any {
    try {
      return {
        overview: {
          totalDevices: globalStats.totalDevices,
          activeDevices: globalStats.activeDevices,
          failedDevices: globalStats.failedDevices,
          successRate: globalStats.totalDevices > 0 
            ? ((globalStats.activeDevices / globalStats.totalDevices) * 100).toFixed(1)
            : '0.0'
        },
        metrics: {
          avgCpu: globalStats.summary.avgCpu,
          avgMemory: globalStats.summary.avgMemory,
          avgBandwidth: globalStats.summary.avgBandwidth,
          avgLatency: globalStats.summary.avgLatency
        },
        alerts: {
          totalAnomalies: globalStats.globalAnomalies.count,
          criticalAnomalies: globalStats.globalAnomalies.anomalies.filter(a => a.severity === 'critical').length,
          warningAnomalies: globalStats.globalAnomalies.anomalies.filter(a => a.severity === 'warning').length
        },
        topDevices: {
          highCpu: this.getTopDevices(globalStats.devices, 'cpu', 'desc', 5),
          lowMemory: this.getTopDevices(globalStats.devices, 'memory', 'asc', 5),
          highLatency: this.getTopDevices(globalStats.devices, 'latency', 'desc', 5),
          lowBandwidth: this.getTopDevices(globalStats.devices, 'bandwidth', 'asc', 5)
        },
        recentAnomalies: globalStats.globalAnomalies.anomalies
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10)
      };

    } catch (error) {
      this.logger.error(`Erreur formatage dashboard: ${error.message}`);
      return {};
    }
  }

  /**
   * Obtient les appareils les plus performants selon un critère
   */
  private getTopDevices(
    devices: MvpDeviceStats[],
    metric: 'cpu' | 'memory' | 'latency' | 'bandwidth',
    order: 'asc' | 'desc',
    limit: number
  ): any[] {
    const sorted = [...devices].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (metric) {
        case 'cpu':
          aValue = a.system.cpu;
          bValue = b.system.cpu;
          break;
        case 'memory':
          aValue = a.system.memory;
          bValue = b.system.memory;
          break;
        case 'latency':
          aValue = a.network.latency;
          bValue = b.network.latency;
          break;
        case 'bandwidth':
          aValue = a.network.bandwidth.download;
          bValue = b.network.bandwidth.download;
          break;
        default:
          return 0;
      }

      return order === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted.slice(0, limit).map(device => ({
      hostname: device.hostname,
      ipAddress: device.ipAddress,
      value: this.getMetricValue(device, metric),
      status: device.collectionStatus
    }));
  }

  /**
   * Obtient la valeur d'une métrique pour un appareil
   */
  private getMetricValue(device: MvpDeviceStats, metric: string): number {
    switch (metric) {
      case 'cpu':
        return device.system.cpu;
      case 'memory':
        return device.system.memory;
      case 'latency':
        return device.network.latency;
      case 'bandwidth':
        return device.network.bandwidth.download;
      default:
        return 0;
    }
  }
} 
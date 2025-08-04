import { Injectable, Logger } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../database';
import { MvpGlobalStats, MvpDeviceStats } from '../mvp-stats.types';

@Injectable()
export class MvpStatsRepository {
  private readonly logger = new Logger(MvpStatsRepository.name);

  /**
   * Parse JSON de manière sécurisée avec gestion d'erreurs
   */
  private safeJsonParse(jsonString: string, fallback: any = null): any {
    try {
      if (!jsonString || typeof jsonString !== 'string') {
        this.logger.warn('Données JSON invalides ou nulles');
        return fallback;
      }

      // Nettoyer les caractères problématiques
      let cleanedJson = jsonString
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Supprimer les caractères de contrôle
        .replace(/[^\x20-\x7E]/g, '?') // Remplacer les caractères non-ASCII par ?
        .trim();

      // Vérifier si c'est un objet déjà parsé
      if (cleanedJson === '[object Object]') {
        this.logger.warn('Données JSON invalides: [object Object]');
        return fallback;
      }

      const parsed = JSON.parse(cleanedJson);
      return parsed;
    } catch (error) {
      this.logger.error(`Erreur parsing JSON: ${error.message}`);
      this.logger.debug(`JSON problématique: ${jsonString.substring(0, 200)}...`);
      return fallback;
    }
  }

  /**
   * Sauvegarde les statistiques globales
   */
  async saveGlobalStats(globalStats: MvpGlobalStats): Promise<string> {
    try {
      const statsId = this.generateStatsId();
      
      // Nettoyer et valider les données avant sauvegarde
      const cleanGlobalStats = this.cleanStatsData(globalStats);
      
      const query = `
        INSERT INTO mvp_stats_collection (
          id, timestamp, total_devices, active_devices, failed_devices,
          avg_cpu, avg_memory, avg_bandwidth, avg_latency, total_anomalies,
          collection_duration, raw_data, created_at
        ) VALUES (
          :id, :timestamp, :totalDevices, :activeDevices, :failedDevices,
          :avgCpu, :avgMemory, :avgBandwidth, :avgLatency, :totalAnomalies,
          :collectionDuration, :rawData, NOW()
        )
      `;

      await sequelize.query(query, {
        replacements: {
          id: statsId,
          timestamp: new Date(cleanGlobalStats.timestamp).toISOString().slice(0, 19).replace('T', ' '),
          totalDevices: cleanGlobalStats.totalDevices,
          activeDevices: cleanGlobalStats.activeDevices,
          failedDevices: cleanGlobalStats.failedDevices,
          avgCpu: cleanGlobalStats.summary.avgCpu,
          avgMemory: cleanGlobalStats.summary.avgMemory,
          avgBandwidth: cleanGlobalStats.summary.avgBandwidth,
          avgLatency: cleanGlobalStats.summary.avgLatency,
          totalAnomalies: cleanGlobalStats.globalAnomalies.count,
          collectionDuration: cleanGlobalStats.collectionDuration,
          rawData: JSON.stringify(cleanGlobalStats)
        },
        type: QueryTypes.INSERT
      });

      // Sauvegarder les données détaillées des appareils
      await this.saveDeviceStats(statsId, cleanGlobalStats.devices);

      // Sauvegarder les anomalies
      await this.saveAnomalies(statsId, cleanGlobalStats.globalAnomalies.anomalies);

      this.logger.log(`Statistiques sauvegardées avec l'ID: ${statsId}`);
      return statsId;

    } catch (error) {
      this.logger.error(`Erreur sauvegarde statistiques: ${error.message}`);
      throw error;
    }
  }

  /**
   * Nettoie les données de statistiques avant sauvegarde
   */
  private cleanStatsData(stats: any): any {
    try {
      // Créer une copie propre des données
      const cleaned = JSON.parse(JSON.stringify(stats));
      
      // Nettoyer les messages d'erreur dans les anomalies
      if (cleaned.globalAnomalies && cleaned.globalAnomalies.anomalies) {
        cleaned.globalAnomalies.anomalies = cleaned.globalAnomalies.anomalies.map(anomaly => ({
          ...anomaly,
          message: this.cleanErrorMessage(anomaly.message || '')
        }));
      }

      // Nettoyer les données des appareils
      if (cleaned.devices) {
        cleaned.devices = cleaned.devices.map(device => ({
          ...device,
          anomalies: (device.anomalies || []).map(anomaly => ({
            ...anomaly,
            message: this.cleanErrorMessage(anomaly.message || '')
          }))
        }));
      }

      return cleaned;
    } catch (error) {
      this.logger.error(`Erreur nettoyage données: ${error.message}`);
      return stats;
    }
  }

  /**
   * Nettoie les messages d'erreur
   */
  private cleanErrorMessage(message: string): string {
    if (!message) return '';
    
    return message
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Supprimer les caractères de contrôle
      .replace(/[^\x20-\x7E]/g, '?') // Remplacer les caractères non-ASCII
      .substring(0, 500); // Limiter la longueur
  }

  /**
   * Sauvegarde les statistiques détaillées des appareils
   */
  private async saveDeviceStats(statsId: string, devices: MvpDeviceStats[]): Promise<void> {
    try {
      for (const device of devices) {
        const deviceStatsId = this.generateStatsId();
        const query = `
          INSERT INTO mvp_device_stats (
            id, stats_id, device_id, hostname, ip_address, device_type,
            cpu_usage, memory_usage, bandwidth_download, bandwidth_upload,
            latency, jitter, packet_loss, collection_status, collection_time,
            anomalies_count, raw_data, created_at
          ) VALUES (
            :id, :statsId, :deviceId, :hostname, :ipAddress, :deviceType,
            :cpuUsage, :memoryUsage, :bandwidthDownload, :bandwidthUpload,
            :latency, :jitter, :packetLoss, :collectionStatus, :collectionTime,
            :anomaliesCount, :rawData, NOW()
          )
        `;

        await sequelize.query(query, {
          replacements: {
            id: deviceStatsId,
            statsId,
            deviceId: device.deviceId,
            hostname: device.hostname,
            ipAddress: device.ipAddress,
            deviceType: device.deviceType,
            cpuUsage: device.system.cpu,
            memoryUsage: device.system.memory,
            bandwidthDownload: device.network.bandwidth.download,
            bandwidthUpload: device.network.bandwidth.upload,
            latency: device.network.latency,
            jitter: device.network.jitter || null,
            packetLoss: device.network.packetLoss || null,
            collectionStatus: device.collectionStatus,
            collectionTime: device.collectionTime,
            anomaliesCount: device.anomalies.length,
            rawData: JSON.stringify(device)
          },
          type: QueryTypes.INSERT
        });
      }

      this.logger.log(`${devices.length} appareils sauvegardés`);
    } catch (error) {
      this.logger.error(`Erreur sauvegarde appareils: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sauvegarde les anomalies
   */
  private async saveAnomalies(statsId: string, anomalies: any[]): Promise<void> {
    try {
      for (const anomaly of anomalies) {
        const anomalyId = this.generateStatsId();
        const query = `
          INSERT INTO mvp_anomalies (
            id, stats_id, device_id, type, severity, message,
            threshold, current_value, timestamp, created_at
          ) VALUES (
            :id, :statsId, :deviceId, :type, :severity, :message,
            :threshold, :currentValue, :timestamp, NOW()
          )
        `;

        await sequelize.query(query, {
          replacements: {
            id: anomalyId,
            statsId,
            deviceId: anomaly.deviceId || null,
            type: anomaly.type,
            severity: anomaly.severity,
            message: anomaly.message,
            threshold: anomaly.threshold,
            currentValue: anomaly.currentValue,
            timestamp: new Date(anomaly.timestamp).toISOString().slice(0, 19).replace('T', ' ')
          },
          type: QueryTypes.INSERT
        });
      }

      this.logger.log(`${anomalies.length} anomalies sauvegardées`);
    } catch (error) {
      this.logger.error(`Erreur sauvegarde anomalies: ${error.message}`);
      throw error;
    }
  }

  /**
   * Récupère les statistiques récentes
   */
  async getRecentStats(limit: number = 10): Promise<MvpGlobalStats[]> {
    try {
      const query = `
        SELECT * FROM mvp_stats_collection 
        ORDER BY created_at DESC 
        LIMIT :limit
      `;

      const results = await sequelize.query(query, {
        replacements: { limit },
        type: QueryTypes.SELECT
      });

      return results.map((row: any) => {
        const rawData = this.safeJsonParse(row.raw_data, {
          totalDevices: 0,
          activeDevices: 0,
          failedDevices: 0,
          summary: { avgCpu: 0, avgMemory: 0, avgBandwidth: 0, avgLatency: 0 },
          globalAnomalies: { count: 0, anomalies: [] },
          devices: []
        });
        
        return {
          ...rawData,
          id: row.id,
          timestamp: new Date(row.timestamp || row.created_at)
        };
      }).filter(stats => stats !== null);

    } catch (error) {
      this.logger.error(`Erreur récupération statistiques: ${error.message}`);
      return [];
    }
  }

  /**
   * Récupère les statistiques par période
   */
  async getStatsByPeriod(startDate: Date, endDate: Date): Promise<MvpGlobalStats[]> {
    try {
      const query = `
        SELECT * FROM mvp_stats_collection 
        WHERE created_at BETWEEN :startDate AND :endDate
        ORDER BY created_at DESC
      `;

      const results = await sequelize.query(query, {
        replacements: { 
          startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
          endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
        },
        type: QueryTypes.SELECT
      });

      return results.map((row: any) => {
        const rawData = this.safeJsonParse(row.raw_data, {
          totalDevices: 0,
          activeDevices: 0,
          failedDevices: 0,
          summary: { avgCpu: 0, avgMemory: 0, avgBandwidth: 0, avgLatency: 0 },
          globalAnomalies: { count: 0, anomalies: [] },
          devices: []
        });
        
        return {
          ...rawData,
          id: row.id,
          timestamp: new Date(row.timestamp || row.created_at)
        };
      }).filter(stats => stats !== null);

    } catch (error) {
      this.logger.error(`Erreur récupération statistiques par période: ${error.message}`);
      return [];
    }
  }

  /**
   * Récupère les statistiques d'un appareil spécifique
   */
  async getDeviceStats(deviceId: string, limit: number = 50): Promise<MvpDeviceStats[]> {
    try {
      const query = `
        SELECT * FROM mvp_device_stats 
        WHERE device_id = :deviceId 
        ORDER BY created_at DESC 
        LIMIT :limit
      `;

      const results = await sequelize.query(query, {
        replacements: { deviceId, limit },
        type: QueryTypes.SELECT
      });

      return results.map((row: any) => {
        const rawData = this.safeJsonParse(row.raw_data, {
          deviceId: row.device_id,
          hostname: row.hostname,
          ipAddress: row.ip_address,
          deviceType: row.device_type,
          system: { cpu: 0, memory: 0 },
          network: { bandwidth: { download: 0, upload: 0 }, latency: 0 },
          anomalies: []
        });
        
        return {
          ...rawData,
          timestamp: new Date(row.created_at)
        };
      }).filter(stats => stats !== null);

    } catch (error) {
      this.logger.error(`Erreur récupération statistiques appareil: ${error.message}`);
      return [];
    }
  }

  /**
   * Récupère les anomalies récentes
   */
  async getRecentAnomalies(limit: number = 100): Promise<any[]> {
    try {
      const query = `
        SELECT a.*, d.hostname, d.ip_address 
        FROM mvp_anomalies a
        LEFT JOIN mvp_device_stats d ON a.device_id = d.device_id
        ORDER BY a.created_at DESC 
        LIMIT :limit
      `;

      const results = await sequelize.query(query, {
        replacements: { limit },
        type: QueryTypes.SELECT
      });

      return results.map((row: any) => ({
        id: row.id,
        statsId: row.stats_id,
        deviceId: row.device_id,
        hostname: row.hostname,
        ipAddress: row.ip_address,
        type: row.type,
        severity: row.severity,
        message: row.message,
        threshold: row.threshold,
        currentValue: row.current_value,
        timestamp: new Date(row.timestamp),
        createdAt: new Date(row.created_at)
      }));

    } catch (error) {
      this.logger.error(`Erreur récupération anomalies: ${error.message}`);
      return [];
    }
  }

  /**
   * Récupère les statistiques de performance
   */
  async getPerformanceStats(): Promise<any> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_collections,
          AVG(collection_duration) as avg_collection_time,
          AVG(active_devices) as avg_active_devices,
          AVG(failed_devices) as avg_failed_devices,
          AVG(avg_cpu) as avg_cpu_overall,
          AVG(avg_memory) as avg_memory_overall,
          AVG(avg_bandwidth) as avg_bandwidth_overall,
          AVG(avg_latency) as avg_latency_overall,
          SUM(total_anomalies) as total_anomalies_overall,
          MIN(created_at) as first_collection,
          MAX(created_at) as last_collection
        FROM mvp_stats_collection
      `;

      const results = await sequelize.query(query, {
        type: QueryTypes.SELECT
      });

      return results[0] || {};

    } catch (error) {
      this.logger.error(`Erreur récupération statistiques performance: ${error.message}`);
      return {};
    }
  }

  /**
   * Nettoie les anciennes données
   */
  async cleanupOldData(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Supprimer les anciennes collections
      const deleteCollectionsQuery = `
        DELETE FROM mvp_stats_collection 
        WHERE created_at < :cutoffDate
      `;

      const deleteCollectionsResult = await sequelize.query(deleteCollectionsQuery, {
        replacements: { cutoffDate: cutoffDate.toISOString().slice(0, 19).replace('T', ' ') },
        type: QueryTypes.DELETE
      });

      // Supprimer les anciennes statistiques d'appareils
      const deleteDeviceStatsQuery = `
        DELETE FROM mvp_device_stats 
        WHERE created_at < :cutoffDate
      `;

      const deleteDeviceStatsResult = await sequelize.query(deleteDeviceStatsQuery, {
        replacements: { cutoffDate: cutoffDate.toISOString().slice(0, 19).replace('T', ' ') },
        type: QueryTypes.DELETE
      });

      // Supprimer les anciennes anomalies
      const deleteAnomaliesQuery = `
        DELETE FROM mvp_anomalies 
        WHERE created_at < :cutoffDate
      `;

      const deleteAnomaliesResult = await sequelize.query(deleteAnomaliesQuery, {
        replacements: { cutoffDate: cutoffDate.toISOString().slice(0, 19).replace('T', ' ') },
        type: QueryTypes.DELETE
      });

      const totalDeleted = (deleteCollectionsResult as any)[1] + 
                          (deleteDeviceStatsResult as any)[1] + 
                          (deleteAnomaliesResult as any)[1];

      this.logger.log(`Nettoyage terminé: ${totalDeleted} enregistrements supprimés`);
      return totalDeleted;

    } catch (error) {
      this.logger.error(`Erreur nettoyage données: ${error.message}`);
      return 0;
    }
  }

  /**
   * Nettoie les données JSON corrompues dans la base de données
   */
  async cleanupCorruptedData(): Promise<number> {
    try {
      this.logger.log('Début nettoyage des données JSON corrompues...');
      
      let cleanedCount = 0;

      // Récupérer toutes les collections avec des données JSON potentiellement corrompues
      const collectionsQuery = `
        SELECT id, raw_data FROM mvp_stats_collection 
        WHERE raw_data IS NOT NULL
      `;

      const collections = await sequelize.query(collectionsQuery, {
        type: QueryTypes.SELECT
      });

      for (const collection of collections as any[]) {
        try {
          // Tester le parsing JSON
          JSON.parse(collection.raw_data);
        } catch (error) {
          // Si le parsing échoue, supprimer l'enregistrement
          this.logger.warn(`Suppression collection corrompue: ${collection.id}`);
          
          await sequelize.query(
            'DELETE FROM mvp_stats_collection WHERE id = :id',
            {
              replacements: { id: collection.id },
              type: QueryTypes.DELETE
            }
          );

          // Supprimer les données associées
          await sequelize.query(
            'DELETE FROM mvp_device_stats WHERE stats_id = :statsId',
            {
              replacements: { statsId: collection.id },
              type: QueryTypes.DELETE
            }
          );

          await sequelize.query(
            'DELETE FROM mvp_anomalies WHERE stats_id = :statsId',
            {
              replacements: { statsId: collection.id },
              type: QueryTypes.DELETE
            }
          );

          cleanedCount++;
        }
      }

      this.logger.log(`Nettoyage terminé: ${cleanedCount} enregistrements corrompus supprimés`);
      return cleanedCount;

    } catch (error) {
      this.logger.error(`Erreur nettoyage données corrompues: ${error.message}`);
      return 0;
    }
  }

  /**
   * Génère un ID unique pour les statistiques
   */
  private generateStatsId(): string {
    return `mvp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Crée les tables nécessaires si elles n'existent pas
   */
  async createTablesIfNotExist(): Promise<void> {
    try {
      // Table des collections de statistiques
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS mvp_stats_collection (
          id VARCHAR(255) PRIMARY KEY,
          timestamp DATETIME NOT NULL,
          total_devices INT NOT NULL,
          active_devices INT NOT NULL,
          failed_devices INT NOT NULL,
          avg_cpu DECIMAL(5,2) NOT NULL,
          avg_memory DECIMAL(10,2) NOT NULL,
          avg_bandwidth DECIMAL(10,2) NOT NULL,
          avg_latency DECIMAL(10,2) NOT NULL,
          total_anomalies INT NOT NULL,
          collection_duration INT NOT NULL,
          raw_data JSON NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_created_at (created_at),
          INDEX idx_timestamp (timestamp)
        )
      `);

      // Table des statistiques d'appareils
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS mvp_device_stats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          stats_id VARCHAR(255) NOT NULL,
          device_id VARCHAR(255) NOT NULL,
          hostname VARCHAR(255) NOT NULL,
          ip_address VARCHAR(45) NOT NULL,
          device_type VARCHAR(50) NOT NULL,
          cpu_usage DECIMAL(5,2) NOT NULL,
          memory_usage DECIMAL(10,2) NOT NULL,
          bandwidth_download DECIMAL(10,2) NOT NULL,
          bandwidth_upload DECIMAL(10,2) NOT NULL,
          latency DECIMAL(10,2) NOT NULL,
          jitter DECIMAL(10,2),
          packet_loss DECIMAL(5,2),
          collection_status VARCHAR(20) NOT NULL,
          collection_time INT NOT NULL,
          anomalies_count INT NOT NULL,
          raw_data JSON NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_stats_id (stats_id),
          INDEX idx_device_id (device_id),
          INDEX idx_created_at (created_at),
          FOREIGN KEY (stats_id) REFERENCES mvp_stats_collection(id) ON DELETE CASCADE
        )
      `);

      // Table des anomalies
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS mvp_anomalies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          stats_id VARCHAR(255) NOT NULL,
          device_id VARCHAR(255),
          type VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          threshold DECIMAL(10,2) NOT NULL,
          current_value DECIMAL(10,2) NOT NULL,
          timestamp DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_stats_id (stats_id),
          INDEX idx_device_id (device_id),
          INDEX idx_type (type),
          INDEX idx_severity (severity),
          INDEX idx_created_at (created_at),
          FOREIGN KEY (stats_id) REFERENCES mvp_stats_collection(id) ON DELETE CASCADE
        )
      `);

      this.logger.log('Tables MVP créées avec succès');

    } catch (error) {
      this.logger.error(`Erreur création tables: ${error.message}`);
      throw error;
    }
  }
} 
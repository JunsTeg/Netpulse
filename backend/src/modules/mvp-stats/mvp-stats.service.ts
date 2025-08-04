import { Injectable, Logger } from '@nestjs/common';
import { AppareilRepository } from '../network/appareil.repository';
import { MvpDeviceCollector } from './services/mvp-device-collector.service';
import { MvpDataProcessor } from './services/mvp-data-processor.service';
import { MvpAnomalyDetector } from './services/mvp-anomaly-detector.service';
import { MvpResponseFormatter } from './services/mvp-response-formatter.service';
import { MvpStatsRepository } from './repositories/mvp-stats.repository';
import { 
  MvpGlobalStats, 
  MvpApiResponse, 
  MvpCollectionConfig,
  MvpToolsAvailability 
} from './mvp-stats.types';
import { Device } from '../network/device.model';

@Injectable()
export class MvpStatsService {
  private readonly logger = new Logger(MvpStatsService.name);

  // Configuration par défaut pour MVP
  private readonly defaultConfig: MvpCollectionConfig = {
    timeout: 30000, // 30 secondes
    retries: 2,
    parallelCollectors: 5,
    useIperf3: true,
    useNmap: true,
    anomalyThresholds: {
      cpu: 80,
      memory: 1000,
      bandwidth: 1,
      latency: 100
    }
  };

  constructor(
    private readonly appareilRepository: AppareilRepository,
    private readonly deviceCollector: MvpDeviceCollector,
    private readonly dataProcessor: MvpDataProcessor,
    private readonly anomalyDetector: MvpAnomalyDetector,
    private readonly responseFormatter: MvpResponseFormatter,
    private readonly statsRepository: MvpStatsRepository
  ) {}

  /**
   * Point d'entrée principal pour la collecte de statistiques
   */
  async collectAllStats(customConfig?: Partial<MvpCollectionConfig>): Promise<MvpApiResponse> {
    const startTime = Date.now();
    const config = { ...this.defaultConfig, ...customConfig };
    
    try {
      this.logger.log('=== DÉBUT COLLECTE MVP ===');

      // 1. Initialisation et vérification des prérequis
      await this.initializeSystem();

      // 2. Récupération des appareils depuis la base de données
      const devices = await this.getDevicesFromDatabase();
      if (devices.length === 0) {
        return this.responseFormatter.formatErrorResponse(
          'Aucun appareil trouvé dans la base de données',
          await this.getToolsAvailability()
        );
      }

      // 3. Collecte des statistiques pour tous les appareils
      const deviceStats = await this.collectStatsFromDevices(devices, config);

      // 4. Traitement et validation des données
      const processingResult = await this.dataProcessor.processCollectedData(deviceStats);
      if (!processingResult.processed) {
        return this.responseFormatter.formatErrorResponse(
          `Erreur traitement données: ${processingResult.errors.join(', ')}`,
          await this.getToolsAvailability()
        );
      }

      // 5. Détection d'anomalies
      const globalStats = await this.detectAnomalies(processingResult.data);

      // 6. Sauvegarde en base de données
      await this.saveStatsToDatabase(globalStats);

      // 7. Formatage de la réponse finale
      const response = this.responseFormatter.formatApiResponse(
        globalStats,
        await this.getToolsAvailability(),
        processingResult.errors,
        processingResult.warnings
      );

      const totalTime = Date.now() - startTime;
      this.logger.log(`=== COLLECTE MVP TERMINÉE EN ${totalTime}ms ===`);

      return response;

    } catch (error) {
      const totalTime = Date.now() - startTime;
      this.logger.error(`Erreur collecte MVP après ${totalTime}ms: ${error.message}`);
      
      return this.responseFormatter.formatErrorResponse(
        `Erreur système: ${error.message}`,
        await this.getToolsAvailability()
      );
    }
  }

  /**
   * Initialise le système MVP
   */
  private async initializeSystem(): Promise<void> {
    try {
      // Créer les tables si elles n'existent pas
      await this.statsRepository.createTablesIfNotExist();
      
      // Vérifier la disponibilité des outils
      const tools = await this.getToolsAvailability();
      this.logger.log(`Outils disponibles: ${JSON.stringify(tools)}`);

    } catch (error) {
      this.logger.error(`Erreur initialisation système: ${error.message}`);
      throw error;
    }
  }

  /**
   * Récupère les appareils depuis la base de données
   */
  private async getDevicesFromDatabase(): Promise<Device[]> {
    try {
      const devices = await this.appareilRepository.findAllDevices();
      this.logger.log(`${devices.length} appareils récupérés de la base de données`);
      return devices;
    } catch (error) {
      this.logger.error(`Erreur récupération appareils: ${error.message}`);
      throw error;
    }
  }

  /**
   * Collecte les statistiques de tous les appareils
   */
  private async collectStatsFromDevices(
    devices: Device[], 
    config: MvpCollectionConfig
  ): Promise<any[]> {
    const deviceStats: any[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.logger.log(`Début collecte pour ${devices.length} appareils`);

      // Collecte parallèle avec limitation
      const chunks = this.chunkArray(devices, config.parallelCollectors);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        this.logger.log(`Traitement du chunk ${i + 1}/${chunks.length} (${chunk.length} appareils)`);

        const chunkPromises = chunk.map(async (device) => {
          try {
            return await this.deviceCollector.collectDeviceStats(device, config);
          } catch (error) {
            this.logger.error(`Erreur collecte ${device.hostname}: ${error.message}`);
            errors.push(`${device.hostname}: ${error.message}`);
            return null;
          }
        });

        const chunkResults = await Promise.allSettled(chunkPromises);
        
        chunkResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            deviceStats.push(result.value);
          } else if (result.status === 'rejected') {
            errors.push(`Appareil ${index}: ${result.reason}`);
          }
        });

        // Pause entre les chunks pour éviter la surcharge
        if (i < chunks.length - 1) {
          await this.sleep(1000);
        }
      }

      this.logger.log(`Collecte terminée: ${deviceStats.length}/${devices.length} appareils traités`);
      
      if (errors.length > 0) {
        this.logger.warn(`${errors.length} erreurs lors de la collecte`);
      }

      return deviceStats;

    } catch (error) {
      this.logger.error(`Erreur collecte appareils: ${error.message}`);
      throw error;
    }
  }

  /**
   * Détecte les anomalies sur les données collectées
   */
  private async detectAnomalies(globalStats: MvpGlobalStats): Promise<MvpGlobalStats> {
    try {
      // Détecter les anomalies pour chaque appareil
      for (const device of globalStats.devices) {
        const anomalies = await this.anomalyDetector.detectDeviceAnomalies(device);
        device.anomalies = anomalies;
      }

      // Détecter les anomalies globales
      const globalAnomalies = await this.anomalyDetector.detectGlobalAnomalies(globalStats.devices);
      globalStats.globalAnomalies = globalAnomalies;
      globalStats.summary.totalAnomalies = globalAnomalies.count;

      this.logger.log(`${globalAnomalies.count} anomalies détectées au total`);

      return globalStats;

    } catch (error) {
      this.logger.error(`Erreur détection anomalies: ${error.message}`);
      return globalStats;
    }
  }

  /**
   * Sauvegarde les statistiques en base de données
   */
  private async saveStatsToDatabase(globalStats: MvpGlobalStats): Promise<void> {
    try {
      const statsId = await this.statsRepository.saveGlobalStats(globalStats);
      this.logger.log(`Statistiques sauvegardées avec l'ID: ${statsId}`);
    } catch (error) {
      this.logger.error(`Erreur sauvegarde base de données: ${error.message}`);
      // Ne pas faire échouer la collecte si la sauvegarde échoue
    }
  }

  /**
   * Récupère la disponibilité des outils
   */
  private async getToolsAvailability(): Promise<MvpToolsAvailability> {
    try {
      return await this.deviceCollector.checkToolsAvailability();
    } catch (error) {
      this.logger.error(`Erreur vérification outils: ${error.message}`);
      return {
        iperf3: false,
        nmap: false,
        tshark: false,
        powershell: true,
        ping: true
      };
    }
  }

  /**
   * Divise un tableau en chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Pause asynchrone
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Récupère les statistiques récentes
   */
  async getRecentStats(limit: number = 10): Promise<MvpGlobalStats[]> {
    try {
      return await this.statsRepository.getRecentStats(limit);
    } catch (error) {
      this.logger.error(`Erreur récupération statistiques récentes: ${error.message}`);
      return [];
    }
  }

  /**
   * Récupère les statistiques par période
   */
  async getStatsByPeriod(startDate: Date, endDate: Date): Promise<MvpGlobalStats[]> {
    try {
      return await this.statsRepository.getStatsByPeriod(startDate, endDate);
    } catch (error) {
      this.logger.error(`Erreur récupération statistiques par période: ${error.message}`);
      return [];
    }
  }

  /**
   * Récupère les statistiques d'un appareil spécifique
   */
  async getDeviceStats(deviceId: string, limit: number = 50): Promise<any[]> {
    try {
      return await this.statsRepository.getDeviceStats(deviceId, limit);
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
      return await this.statsRepository.getRecentAnomalies(limit);
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
      return await this.statsRepository.getPerformanceStats();
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
      return await this.statsRepository.cleanupOldData(daysToKeep);
    } catch (error) {
      this.logger.error(`Erreur nettoyage données: ${error.message}`);
      return 0;
    }
  }

  /**
   * Nettoie les données JSON corrompues
   */
  async cleanupCorruptedData(): Promise<number> {
    try {
      return await this.statsRepository.cleanupCorruptedData();
    } catch (error) {
      this.logger.error(`Erreur nettoyage données corrompues: ${error.message}`);
      return 0;
    }
  }

  /**
   * Met à jour la configuration de collecte
   */
  updateCollectionConfig(newConfig: Partial<MvpCollectionConfig>): void {
    Object.assign(this.defaultConfig, newConfig);
    this.logger.log('Configuration de collecte mise à jour');
  }

  /**
   * Récupère la configuration actuelle
   */
  getCurrentConfig(): MvpCollectionConfig {
    return { ...this.defaultConfig };
  }

  /**
   * Test de connectivité vers un appareil spécifique
   */
  async testDeviceConnectivity(deviceId: string): Promise<any> {
    try {
      const devices = await this.appareilRepository.findAllDevices();
      const device = devices.find(d => d.id === deviceId);
      
      if (!device) {
        throw new Error(`Appareil ${deviceId} non trouvé`);
      }

      const deviceStats = await this.deviceCollector.collectDeviceStats(device, this.defaultConfig);
      const anomalies = await this.anomalyDetector.detectDeviceAnomalies(deviceStats);

      return {
        device: {
          id: device.id,
          hostname: device.hostname,
          ipAddress: device.ipAddress,
          deviceType: device.deviceType
        },
        stats: deviceStats,
        anomalies,
        connectivity: {
          status: deviceStats.collectionStatus,
          responseTime: deviceStats.collectionTime,
          timestamp: new Date()
        }
      };

    } catch (error) {
      this.logger.error(`Erreur test connectivité ${deviceId}: ${error.message}`);
      throw error;
    }
  }
} 
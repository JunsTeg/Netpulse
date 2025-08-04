import { 
  Controller, 
  Get, 
  Post, 
  Query, 
  Param, 
  Body, 
  Logger,
  HttpStatus,
  HttpException
} from '@nestjs/common';
import { MvpStatsService } from './mvp-stats.service';
import { MvpCollectionConfig } from './mvp-stats.types';

@Controller('mvp-stats')
export class MvpStatsController {
  private readonly logger = new Logger(MvpStatsController.name);

  constructor(private readonly mvpStatsService: MvpStatsService) {}

  /**
   * Collecte les statistiques de tous les appareils
   */
  @Post('collect')
  async collectStats(@Body() config?: Partial<MvpCollectionConfig>) {
    try {
      this.logger.log('Début collecte de statistiques MVP');
      const result = await this.mvpStatsService.collectAllStats(config);
      
      if (!result.success) {
        throw new HttpException(
          result.message || 'Erreur lors de la collecte',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      return {
        status: 'success',
        data: result,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur endpoint collecte: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupère les statistiques récentes
   */
  @Get('recent')
  async getRecentStats(@Query('limit') limit?: string) {
    try {
      const limitNumber = limit ? parseInt(limit, 10) : 10;
      
      if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
        throw new HttpException(
          'Le paramètre limit doit être un nombre entre 1 et 100',
          HttpStatus.BAD_REQUEST
        );
      }

      const stats = await this.mvpStatsService.getRecentStats(limitNumber);
      
      return {
        status: 'success',
        data: stats,
        count: stats.length,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur récupération statistiques récentes: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupère les statistiques par période
   */
  @Get('period')
  async getStatsByPeriod(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    try {
      if (!startDate || !endDate) {
        throw new HttpException(
          'Les paramètres startDate et endDate sont requis',
          HttpStatus.BAD_REQUEST
        );
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new HttpException(
          'Les dates doivent être au format ISO 8601',
          HttpStatus.BAD_REQUEST
        );
      }

      if (start >= end) {
        throw new HttpException(
          'La date de début doit être antérieure à la date de fin',
          HttpStatus.BAD_REQUEST
        );
      }

      const stats = await this.mvpStatsService.getStatsByPeriod(start, end);
      
      return {
        status: 'success',
        data: stats,
        count: stats.length,
        period: {
          startDate: start,
          endDate: end
        },
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur récupération statistiques par période: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupère les statistiques d'un appareil spécifique
   */
  @Get('device/:deviceId')
  async getDeviceStats(
    @Param('deviceId') deviceId: string,
    @Query('limit') limit?: string
  ) {
    try {
      if (!deviceId) {
        throw new HttpException(
          'L\'ID de l\'appareil est requis',
          HttpStatus.BAD_REQUEST
        );
      }

      const limitNumber = limit ? parseInt(limit, 10) : 50;
      
      if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 200) {
        throw new HttpException(
          'Le paramètre limit doit être un nombre entre 1 et 200',
          HttpStatus.BAD_REQUEST
        );
      }

      const stats = await this.mvpStatsService.getDeviceStats(deviceId, limitNumber);
      
      return {
        status: 'success',
        data: stats,
        count: stats.length,
        deviceId,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur récupération statistiques appareil: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupère les anomalies récentes
   */
  @Get('anomalies')
  async getRecentAnomalies(@Query('limit') limit?: string) {
    try {
      const limitNumber = limit ? parseInt(limit, 10) : 100;
      
      if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 500) {
        throw new HttpException(
          'Le paramètre limit doit être un nombre entre 1 et 500',
          HttpStatus.BAD_REQUEST
        );
      }

      const anomalies = await this.mvpStatsService.getRecentAnomalies(limitNumber);
      
      // Grouper par sévérité
      const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
      const warningAnomalies = anomalies.filter(a => a.severity === 'warning');
      const infoAnomalies = anomalies.filter(a => a.severity === 'info');

      return {
        status: 'success',
        data: anomalies,
        count: anomalies.length,
        summary: {
          critical: criticalAnomalies.length,
          warning: warningAnomalies.length,
          info: infoAnomalies.length
        },
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur récupération anomalies: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupère les statistiques de performance du système
   */
  @Get('performance')
  async getPerformanceStats() {
    try {
      const stats = await this.mvpStatsService.getPerformanceStats();
      
      return {
        status: 'success',
        data: stats,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur récupération statistiques performance: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Test de connectivité vers un appareil spécifique
   */
  @Get('test-connectivity/:deviceId')
  async testDeviceConnectivity(@Param('deviceId') deviceId: string) {
    try {
      if (!deviceId) {
        throw new HttpException(
          'L\'ID de l\'appareil est requis',
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.mvpStatsService.testDeviceConnectivity(deviceId);
      
      return {
        status: 'success',
        data: result,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur test connectivité: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Test de récupération des anomalies de la table mvp_anomalies
   */
  @Get('test-anomalies')
  async testAnomaliesRetrieval() {
    try {
      this.logger.log('[TEST] Test de récupération des anomalies de la table mvp_anomalies');
      
      // Récupérer les 3 dernières anomalies
      const anomalies = await this.mvpStatsService.getRecentAnomalies(3);
      
      // Vérifier la structure des données
      const validatedAnomalies = anomalies.map(anomaly => ({
        id: anomaly.id,
        type: anomaly.type,
        severity: anomaly.severity,
        message: anomaly.message,
        device: anomaly.hostname || anomaly.ipAddress || 'Inconnu',
        timestamp: anomaly.timestamp,
        threshold: anomaly.threshold,
        currentValue: anomaly.currentValue
      }));
      
      return {
        status: 'success',
        data: {
          anomalies: validatedAnomalies,
          count: validatedAnomalies.length,
          source: 'mvp_anomalies table',
          query: 'SELECT a.*, d.hostname, d.ip_address FROM mvp_anomalies a LEFT JOIN mvp_device_stats d ON a.device_id = d.device_id ORDER BY a.created_at DESC LIMIT 3'
        },
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`[TEST] Erreur test anomalies: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Récupère la configuration actuelle
   */
  @Get('config')
  async getConfig() {
    try {
      const config = this.mvpStatsService.getCurrentConfig();
      
      return {
        status: 'success',
        data: config,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur récupération configuration: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Met à jour la configuration
   */
  @Post('config')
  async updateConfig(@Body() config: Partial<MvpCollectionConfig>) {
    try {
      this.mvpStatsService.updateCollectionConfig(config);
      
      return {
        status: 'success',
        message: 'Configuration mise à jour avec succès',
        data: this.mvpStatsService.getCurrentConfig(),
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur mise à jour configuration: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Nettoie les anciennes données
   */
  @Post('cleanup')
  async cleanupOldData(@Query('daysToKeep') daysToKeep?: string) {
    try {
      const days = daysToKeep ? parseInt(daysToKeep, 10) : 30;
      
      if (isNaN(days) || days < 1 || days > 365) {
        throw new HttpException(
          'Le paramètre daysToKeep doit être un nombre entre 1 et 365',
          HttpStatus.BAD_REQUEST
        );
      }

      const deletedCount = await this.mvpStatsService.cleanupOldData(days);
      
      return {
        status: 'success',
        message: `Nettoyage terminé: ${deletedCount} enregistrements supprimés`,
        data: {
          deletedCount,
          daysToKeep: days
        },
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur nettoyage données: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Nettoie les données JSON corrompues
   */
  @Post('cleanup-corrupted')
  async cleanupCorruptedData() {
    try {
      this.logger.log('Début nettoyage des données JSON corrompues...');
      
      const cleanedCount = await this.mvpStatsService.cleanupCorruptedData();
      
      return {
        status: 'success',
        message: `Nettoyage des données corrompues terminé: ${cleanedCount} enregistrements supprimés`,
        data: {
          cleanedCount
        },
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur nettoyage données corrompues: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Endpoint de santé du module MVP
   */
  @Get('health')
  async healthCheck() {
    try {
      const config = this.mvpStatsService.getCurrentConfig();
      const performanceStats = await this.mvpStatsService.getPerformanceStats();
      
      return {
        status: 'healthy',
        module: 'mvp-stats',
        version: '1.0.0',
        config: {
          timeout: config.timeout,
          parallelCollectors: config.parallelCollectors,
          useIperf3: config.useIperf3,
          useNmap: config.useNmap
        },
        performance: {
          totalCollections: performanceStats.total_collections || 0,
          avgCollectionTime: performanceStats.avg_collection_time || 0
        },
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur health check: ${error.message}`);
      return {
        status: 'unhealthy',
        module: 'mvp-stats',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Récupère un résumé des statistiques pour le tableau de bord
   */
  @Get('dashboard')
  async getDashboardData() {
    try {
      const [recentStats, recentAnomalies, performanceStats] = await Promise.all([
        this.mvpStatsService.getRecentStats(1),
        this.mvpStatsService.getRecentAnomalies(50),
        this.mvpStatsService.getPerformanceStats()
      ]);

      const latestStats = recentStats[0];
      
      return {
        status: 'success',
        data: {
          overview: latestStats ? {
            totalDevices: latestStats.totalDevices,
            activeDevices: latestStats.activeDevices,
            failedDevices: latestStats.failedDevices,
            successRate: latestStats.totalDevices > 0 
              ? ((latestStats.activeDevices / latestStats.totalDevices) * 100).toFixed(1)
              : '0.0'
          } : null,
          metrics: latestStats ? latestStats.summary : null,
          alerts: {
            totalAnomalies: recentAnomalies.length,
            criticalAnomalies: recentAnomalies.filter(a => a.severity === 'critical').length,
            warningAnomalies: recentAnomalies.filter(a => a.severity === 'warning').length
          },
          performance: {
            totalCollections: performanceStats.total_collections || 0,
            avgCollectionTime: performanceStats.avg_collection_time || 0,
            lastCollection: performanceStats.last_collection
          }
        },
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Erreur récupération données dashboard: ${error.message}`);
      throw new HttpException(
        error.message || 'Erreur interne du serveur',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 
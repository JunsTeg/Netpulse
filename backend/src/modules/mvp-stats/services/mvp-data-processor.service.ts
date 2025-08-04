import { Injectable, Logger } from '@nestjs/common';
import { 
  MvpDeviceStats, 
  MvpGlobalStats, 
  MvpDataProcessingResult,
  MvpValidationResult,
  MvpPerformanceMetrics 
} from '../mvp-stats.types';

@Injectable()
export class MvpDataProcessor {
  private readonly logger = new Logger(MvpDataProcessor.name);

  /**
   * Traite et valide les données collectées
   */
  async processCollectedData(
    deviceStats: MvpDeviceStats[]
  ): Promise<MvpDataProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.logger.log(`Début traitement de ${deviceStats.length} appareils`);

      // 1. Validation des données
      const validationResult = this.validateDeviceStats(deviceStats);
      errors.push(...validationResult.errors);
      warnings.push(...validationResult.warnings);

      if (!validationResult.valid) {
        this.logger.error(`Validation échouée: ${validationResult.errors.join(', ')}`);
        return {
          processed: false,
          data: null,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        };
      }

      // 2. Nettoyage et normalisation des données
      const cleanedStats = this.cleanAndNormalizeData(deviceStats);

      // 3. Agrégation des données
      const aggregatedStats = this.aggregateData(cleanedStats);

      // 4. Calcul des métriques de performance
      const processingTime = Date.now() - startTime;
      const performanceMetrics: MvpPerformanceMetrics = {
        collectionTime: this.calculateAverageCollectionTime(deviceStats),
        processingTime,
        totalTime: processingTime + this.calculateAverageCollectionTime(deviceStats),
        memoryUsage: this.getCurrentMemoryUsage(),
        cpuUsage: 0 // Sera calculé si nécessaire
      };

      // 5. Ajout des métriques de performance aux données
      const finalData: MvpGlobalStats = {
        ...aggregatedStats,
        performanceMetrics: performanceMetrics
      };

      this.logger.log(`Traitement terminé en ${processingTime}ms`);

      return {
        processed: true,
        data: finalData,
        errors,
        warnings
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Erreur traitement données: ${error.message}`);
      
      return {
        processed: false,
        data: null,
        errors: [error.message, ...errors],
        warnings
      };
    }
  }

  /**
   * Valide les données des appareils
   */
  private validateDeviceStats(deviceStats: MvpDeviceStats[]): MvpValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Vérification de base
      if (!Array.isArray(deviceStats)) {
        errors.push('Les données ne sont pas un tableau');
        return { valid: false, errors, warnings };
      }

      if (deviceStats.length === 0) {
        errors.push('Aucune donnée d\'appareil à traiter');
        return { valid: false, errors, warnings };
      }

      // Validation de chaque appareil
      for (let i = 0; i < deviceStats.length; i++) {
        const device = deviceStats[i];
        const deviceErrors = this.validateSingleDevice(device, i);
        errors.push(...deviceErrors);
      }

      // Vérifications globales
      const duplicateIds = this.findDuplicateDeviceIds(deviceStats);
      if (duplicateIds.length > 0) {
        warnings.push(`Appareils en double détectés: ${duplicateIds.join(', ')}`);
      }

      const invalidIps = this.findInvalidIpAddresses(deviceStats);
      if (invalidIps.length > 0) {
        warnings.push(`Adresses IP invalides: ${invalidIps.join(', ')}`);
      }

      const valid = errors.length === 0;
      return { valid, errors, warnings };

    } catch (error) {
      errors.push(`Erreur validation: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Valide un appareil individuel
   */
  private validateSingleDevice(device: MvpDeviceStats, index: number): string[] {
    const errors: string[] = [];

    // Vérifications obligatoires
    if (!device.deviceId) {
      errors.push(`Appareil ${index}: ID manquant`);
    }

    if (!device.hostname) {
      errors.push(`Appareil ${index}: Hostname manquant`);
    }

    if (!device.ipAddress) {
      errors.push(`Appareil ${index}: Adresse IP manquante`);
    }

    // Validation des statistiques système
    if (device.system) {
      if (typeof device.system.cpu !== 'number' || device.system.cpu < 0 || device.system.cpu > 100) {
        errors.push(`Appareil ${index}: CPU invalide (${device.system.cpu})`);
      }

      if (typeof device.system.memory !== 'number' || device.system.memory < 0) {
        errors.push(`Appareil ${index}: Mémoire invalide (${device.system.memory})`);
      }
    } else {
      errors.push(`Appareil ${index}: Statistiques système manquantes`);
    }

    // Validation des statistiques réseau
    if (device.network) {
      if (!device.network.bandwidth || typeof device.network.bandwidth.download !== 'number') {
        errors.push(`Appareil ${index}: Bande passante download invalide`);
      }

      if (!device.network.bandwidth || typeof device.network.bandwidth.upload !== 'number') {
        errors.push(`Appareil ${index}: Bande passante upload invalide`);
      }

      if (typeof device.network.latency !== 'number' || device.network.latency < 0) {
        errors.push(`Appareil ${index}: Latence invalide (${device.network.latency})`);
      }
    } else {
      errors.push(`Appareil ${index}: Statistiques réseau manquantes`);
    }

    return errors;
  }

  /**
   * Nettoie et normalise les données
   */
  private cleanAndNormalizeData(deviceStats: MvpDeviceStats[]): MvpDeviceStats[] {
    return deviceStats.map(device => {
      const cleaned = { ...device };

      // Normalisation des valeurs numériques
      if (cleaned.system) {
        cleaned.system.cpu = this.normalizePercentage(cleaned.system.cpu);
        cleaned.system.memory = Math.max(0, cleaned.system.memory);
      }

      if (cleaned.network) {
        cleaned.network.bandwidth.download = Math.max(0, cleaned.network.bandwidth.download);
        cleaned.network.bandwidth.upload = Math.max(0, cleaned.network.bandwidth.upload);
        cleaned.network.latency = Math.max(0, cleaned.network.latency);
        
        if (cleaned.network.packetLoss !== undefined) {
          cleaned.network.packetLoss = this.normalizePercentage(cleaned.network.packetLoss);
        }
      }

      // Normalisation des chaînes
      cleaned.hostname = cleaned.hostname?.trim() || 'Unknown';
      cleaned.ipAddress = cleaned.ipAddress?.trim() || '0.0.0.0';
      cleaned.deviceType = cleaned.deviceType?.trim() || 'other';

      // Normalisation des timestamps
      if (cleaned.system.timestamp) {
        cleaned.system.timestamp = new Date(cleaned.system.timestamp);
      }

      return cleaned;
    });
  }

  /**
   * Agrège les données de tous les appareils
   */
  private aggregateData(deviceStats: MvpDeviceStats[]): MvpGlobalStats {
    const validDevices = deviceStats.filter(d => d.collectionStatus !== 'failed');
    const failedDevices = deviceStats.filter(d => d.collectionStatus === 'failed');

    // Calcul des moyennes
    const avgCpu = validDevices.length > 0 
      ? validDevices.reduce((sum, d) => sum + d.system.cpu, 0) / validDevices.length 
      : 0;

    const avgMemory = validDevices.length > 0 
      ? validDevices.reduce((sum, d) => sum + d.system.memory, 0) / validDevices.length 
      : 0;

    const avgBandwidth = validDevices.length > 0 
      ? validDevices.reduce((sum, d) => sum + d.network.bandwidth.download, 0) / validDevices.length 
      : 0;

    const avgLatency = validDevices.length > 0 
      ? validDevices.reduce((sum, d) => sum + d.network.latency, 0) / validDevices.length 
      : 0;

    // Calcul du temps de collecte total
    const totalCollectionTime = deviceStats.reduce((sum, d) => sum + d.collectionTime, 0);

    return {
      timestamp: new Date(),
      totalDevices: deviceStats.length,
      activeDevices: validDevices.length,
      failedDevices: failedDevices.length,
      devices: deviceStats,
      globalAnomalies: {
        count: 0, // Sera rempli par le détecteur d'anomalies
        anomalies: [],
        timestamp: new Date()
      },
      summary: {
        avgCpu,
        avgMemory,
        avgBandwidth,
        avgLatency,
        totalAnomalies: 0 // Sera rempli par le détecteur d'anomalies
      },
      collectionDuration: totalCollectionTime
    };
  }

  /**
   * Normalise une valeur de pourcentage
   */
  private normalizePercentage(value: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return 0;
    }
    return Math.max(0, Math.min(100, value));
  }

  /**
   * Trouve les IDs d'appareils en double
   */
  private findDuplicateDeviceIds(deviceStats: MvpDeviceStats[]): string[] {
    const ids = deviceStats.map(d => d.deviceId);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    return [...new Set(duplicates)];
  }

  /**
   * Trouve les adresses IP invalides
   */
  private findInvalidIpAddresses(deviceStats: MvpDeviceStats[]): string[] {
    const invalidIps: string[] = [];
    
    for (const device of deviceStats) {
      if (!this.isValidIpAddress(device.ipAddress)) {
        invalidIps.push(device.ipAddress);
      }
    }

    return [...new Set(invalidIps)];
  }

  /**
   * Valide une adresse IP
   */
  private isValidIpAddress(ip: string): boolean {
    if (!ip) return false;
    
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Calcule le temps de collecte moyen
   */
  private calculateAverageCollectionTime(deviceStats: MvpDeviceStats[]): number {
    if (deviceStats.length === 0) return 0;
    
    const totalTime = deviceStats.reduce((sum, d) => sum + d.collectionTime, 0);
    return totalTime / deviceStats.length;
  }

  /**
   * Récupère l'utilisation mémoire actuelle
   */
  private getCurrentMemoryUsage(): number {
    try {
      const memUsage = process.memoryUsage();
      return Math.round(memUsage.heapUsed / 1024 / 1024); // MB
    } catch (error) {
      return 0;
    }
  }

  /**
   * Applique des filtres sur les données
   */
  applyFilters(
    deviceStats: MvpDeviceStats[],
    filters: {
      deviceType?: string;
      minCpu?: number;
      maxCpu?: number;
      minMemory?: number;
      maxMemory?: number;
      minBandwidth?: number;
      maxLatency?: number;
      collectionStatus?: string;
    }
  ): MvpDeviceStats[] {
    return deviceStats.filter(device => {
      // Filtre par type d'appareil
      if (filters.deviceType && device.deviceType !== filters.deviceType) {
        return false;
      }

      // Filtre par CPU
      if (filters.minCpu !== undefined && device.system.cpu < filters.minCpu) {
        return false;
      }
      if (filters.maxCpu !== undefined && device.system.cpu > filters.maxCpu) {
        return false;
      }

      // Filtre par mémoire
      if (filters.minMemory !== undefined && device.system.memory < filters.minMemory) {
        return false;
      }
      if (filters.maxMemory !== undefined && device.system.memory > filters.maxMemory) {
        return false;
      }

      // Filtre par bande passante
      if (filters.minBandwidth !== undefined && device.network.bandwidth.download < filters.minBandwidth) {
        return false;
      }

      // Filtre par latence
      if (filters.maxLatency !== undefined && device.network.latency > filters.maxLatency) {
        return false;
      }

      // Filtre par statut de collecte
      if (filters.collectionStatus && device.collectionStatus !== filters.collectionStatus) {
        return false;
      }

      return true;
    });
  }

  /**
   * Trie les données selon différents critères
   */
  sortData(
    deviceStats: MvpDeviceStats[],
    sortBy: 'hostname' | 'cpu' | 'memory' | 'bandwidth' | 'latency' | 'collectionTime',
    order: 'asc' | 'desc' = 'asc'
  ): MvpDeviceStats[] {
    return [...deviceStats].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'hostname':
          aValue = a.hostname.toLowerCase();
          bValue = b.hostname.toLowerCase();
          break;
        case 'cpu':
          aValue = a.system.cpu;
          bValue = b.system.cpu;
          break;
        case 'memory':
          aValue = a.system.memory;
          bValue = b.system.memory;
          break;
        case 'bandwidth':
          aValue = a.network.bandwidth.download;
          bValue = b.network.bandwidth.download;
          break;
        case 'latency':
          aValue = a.network.latency;
          bValue = b.network.latency;
          break;
        case 'collectionTime':
          aValue = a.collectionTime;
          bValue = b.collectionTime;
          break;
        default:
          return 0;
      }

      if (order === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }
} 
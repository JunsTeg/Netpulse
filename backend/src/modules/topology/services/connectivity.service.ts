import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Device } from '../../network/device.model';

const execAsync = promisify(exec);

interface ConnectivityResult {
  deviceId: string;
  ipAddress: string;
  isReachable: boolean;
  responseTime?: number;
  error?: string;
}

interface ConnectivityOptions {
  timeout?: number;
  maxConcurrent?: number;
  batchSize?: number;
  retries?: number;
}

@Injectable()
export class ConnectivityService {
  private readonly logger = new Logger(ConnectivityService.name);
  private readonly defaultOptions: Required<ConnectivityOptions> = {
    timeout: 3000,
    maxConcurrent: 10,
    batchSize: 50,
    retries: 1,
  };

  /**
   * Teste la connectivité de tous les appareils en parallèle
   */
  async testConnectivityParallel(
    devices: Device[], 
    options: ConnectivityOptions = {}
  ): Promise<Map<string, boolean>> {
    const opts = { ...this.defaultOptions, ...options };
    const results = new Map<string, boolean>();
    
    this.logger.log(`[CONNECTIVITY] Test de connectivité pour ${devices.length} appareils (max: ${opts.maxConcurrent} concurrents)`);

    // Traitement par lots pour éviter la surcharge
    for (let i = 0; i < devices.length; i += opts.batchSize) {
      const batch = devices.slice(i, i + opts.batchSize);
      
      const batchResults = await this.processBatch(batch, opts);
      
      // Ajouter les résultats au Map
      batchResults.forEach(result => {
        results.set(result.deviceId, result.isReachable);
      });
      
      // Pause entre les lots pour éviter la surcharge réseau
      if (i + opts.batchSize < devices.length) {
        await this.delay(100);
      }
    }

    const reachableCount = Array.from(results.values()).filter(Boolean).length;
    this.logger.log(`[CONNECTIVITY] ${reachableCount}/${devices.length} appareils accessibles`);

    return results;
  }

  /**
   * Teste la connectivité par type d'appareil avec priorités
   */
  async testConnectivityByType(devices: Device[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // 1. Switches et routers (priorité haute)
    const networkDevices = devices.filter(d => 
      ['switch', 'router'].includes(d.deviceType.toLowerCase())
    );
    
    if (networkDevices.length > 0) {
      this.logger.log(`[CONNECTIVITY] Test des équipements réseau: ${networkDevices.length} appareils`);
      const networkResults = await this.testConnectivityParallel(networkDevices, {
        timeout: 5000,
        maxConcurrent: 5,
      });
      
      networkResults.forEach((isReachable, deviceId) => {
        results.set(deviceId, isReachable);
      });
    }

    // 2. Serveurs (priorité moyenne)
    const servers = devices.filter(d => d.deviceType.toLowerCase() === 'server');
    
    if (servers.length > 0) {
      this.logger.log(`[CONNECTIVITY] Test des serveurs: ${servers.length} appareils`);
      const serverResults = await this.testConnectivityParallel(servers, {
        timeout: 3000,
        maxConcurrent: 8,
      });
      
      serverResults.forEach((isReachable, deviceId) => {
        results.set(deviceId, isReachable);
      });
    }

    // 3. Appareils finaux (priorité basse)
    const endDevices = devices.filter(d => 
      ['desktop', 'laptop', 'mobile', 'printer', 'other'].includes(d.deviceType.toLowerCase())
    );
    
    if (endDevices.length > 0) {
      this.logger.log(`[CONNECTIVITY] Test des appareils finaux: ${endDevices.length} appareils`);
      const endDeviceResults = await this.testConnectivityParallel(endDevices, {
        timeout: 2000,
        maxConcurrent: 15,
      });
      
      endDeviceResults.forEach((isReachable, deviceId) => {
        results.set(deviceId, isReachable);
      });
    }

    return results;
  }

  /**
   * Traite un lot d'appareils en parallèle
   */
  private async processBatch(
    devices: Device[], 
    options: Required<ConnectivityOptions>
  ): Promise<ConnectivityResult[]> {
    const promises = devices.map(device => 
      this.testSingleDevice(device, options)
    );

    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const device = devices[index];
        return {
          deviceId: device.id,
          ipAddress: device.ipAddress,
          isReachable: false,
          error: result.reason?.message || 'Erreur inconnue',
        };
      }
    });
  }

  /**
   * Teste la connectivité d'un seul appareil
   */
  private async testSingleDevice(
    device: Device, 
    options: Required<ConnectivityOptions>
  ): Promise<ConnectivityResult> {
    const startTime = Date.now();
    
    try {
      // Utiliser ping avec timeout
      const { stdout, stderr } = await execAsync(
        `ping -c 1 -W ${Math.ceil(options.timeout / 1000)} ${device.ipAddress}`,
        { timeout: options.timeout + 1000 }
      );

      const responseTime = Date.now() - startTime;
      const isReachable = !stderr && stdout.includes('1 received');

      return {
        deviceId: device.id,
        ipAddress: device.ipAddress,
        isReachable,
        responseTime: isReachable ? responseTime : undefined,
      };

    } catch (error: any) {
      return {
        deviceId: device.id,
        ipAddress: device.ipAddress,
        isReachable: false,
        error: error.message || 'Timeout ou erreur réseau',
      };
    }
  }

  /**
   * Teste la connectivité avec retry
   */
  async testConnectivityWithRetry(
    device: Device, 
    options: ConnectivityOptions = {}
  ): Promise<ConnectivityResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    for (let attempt = 1; attempt <= opts.retries; attempt++) {
      const result = await this.testSingleDevice(device, opts);
      
      if (result.isReachable) {
        return result;
      }
      
      if (attempt < opts.retries) {
        await this.delay(1000); // Attendre 1 seconde entre les tentatives
      }
    }
    
    // Dernière tentative
    return this.testSingleDevice(device, opts);
  }

  /**
   * Obtient les statistiques de connectivité
   */
  getConnectivityStats(results: Map<string, boolean>): {
    total: number;
    reachable: number;
    unreachable: number;
    successRate: number;
  } {
    const total = results.size;
    const reachable = Array.from(results.values()).filter(Boolean).length;
    const unreachable = total - reachable;
    const successRate = total > 0 ? (reachable / total) * 100 : 0;

    return {
      total,
      reachable,
      unreachable,
      successRate,
    };
  }

  /**
   * Filtre les appareils accessibles
   */
  getReachableDevices(devices: Device[], results: Map<string, boolean>): Device[] {
    return devices.filter(device => results.get(device.id) === true);
  }

  /**
   * Filtre les appareils inaccessibles
   */
  getUnreachableDevices(devices: Device[], results: Map<string, boolean>): Device[] {
    return devices.filter(device => results.get(device.id) === false);
  }

  /**
   * Délai utilitaire
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 
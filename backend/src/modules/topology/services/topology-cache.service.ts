import { Injectable, Logger } from '@nestjs/common';
import { Topology } from '../topology.types';
import { Device } from '../../network/device.model';

interface CachedTopology {
  topology: Topology;
  timestamp: number;
  deviceHash: string;
  lastDeviceUpdate: Date;
  generationTime: number;
}

interface DeviceHash {
  count: number;
  lastUpdate: Date;
  hash: string;
}

@Injectable()
export class TopologyCacheService {
  private readonly logger = new Logger(TopologyCacheService.name);
  private readonly cache = new Map<string, CachedTopology>();
  private readonly deviceCache = new Map<string, Device[]>();
  private readonly cacheTtl = 300000; // 5 minutes
  private readonly deviceCacheTtl = 60000; // 1 minute

  /**
   * Obtient une topologie en cache si elle est valide
   */
  async getCachedTopology(devices: Device[]): Promise<Topology | null> {
    const deviceHash = this.generateDeviceHash(devices);
    const cacheKey = `topology_${deviceHash.hash}`;
    
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached, deviceHash)) {
      this.logger.debug(`[CACHE] Hit pour ${devices.length} appareils`);
      return cached.topology;
    }
    
    this.logger.debug(`[CACHE] Miss pour ${devices.length} appareils`);
    return null;
  }

  /**
   * Met en cache une topologie
   */
  async setCachedTopology(devices: Device[], topology: Topology, generationTime: number): Promise<void> {
    const deviceHash = this.generateDeviceHash(devices);
    const cacheKey = `topology_${deviceHash.hash}`;
    
    const cached: CachedTopology = {
      topology,
      timestamp: Date.now(),
      deviceHash: deviceHash.hash,
      lastDeviceUpdate: deviceHash.lastUpdate,
      generationTime,
    };
    
    this.cache.set(cacheKey, cached);
    this.logger.debug(`[CACHE] Topologie mise en cache: ${devices.length} appareils`);
    
    // Nettoyage du cache si nécessaire
    this.cleanupCache();
  }

  /**
   * Obtient des appareils en cache par type
   */
  async getDevicesByType(type: string): Promise<Device[] | null> {
    const cacheKey = `devices_${type}`;
    const cached = this.deviceCache.get(cacheKey);
    
    // Le cache stocke directement les Device[], pas d'objet avec timestamp
    return cached || null;
  }

  /**
   * Met en cache des appareils par type
   */
  async setDevicesByType(type: string, devices: Device[]): Promise<void> {
    const cacheKey = `devices_${type}`;
    this.deviceCache.set(cacheKey, devices);
  }

  /**
   * Invalide le cache pour un type d'appareil
   */
  invalidateDeviceCache(type?: string): void {
    if (type) {
      this.deviceCache.delete(`devices_${type}`);
      this.logger.debug(`[CACHE] Cache appareils invalidé pour type: ${type}`);
    } else {
      this.deviceCache.clear();
      this.logger.debug('[CACHE] Cache appareils complètement invalidé');
    }
  }

  /**
   * Invalide le cache de topologie
   */
  invalidateTopologyCache(): void {
    const beforeSize = this.cache.size;
    this.cache.clear();
    this.logger.log(`[CACHE] Cache topologie invalidé: ${beforeSize} entrées supprimées`);
  }

  /**
   * Obtient les statistiques du cache
   */
  getCacheStats(): {
    topologyCacheSize: number;
    deviceCacheSize: number;
    topologyCacheKeys: string[];
    deviceCacheKeys: string[];
  } {
    return {
      topologyCacheSize: this.cache.size,
      deviceCacheSize: this.deviceCache.size,
      topologyCacheKeys: Array.from(this.cache.keys()),
      deviceCacheKeys: Array.from(this.deviceCache.keys()),
    };
  }

  /**
   * Vérifie si le cache est valide
   */
  private isCacheValid(cached: CachedTopology, currentHash: DeviceHash): boolean {
    // Vérifier le hash des appareils
    if (cached.deviceHash !== currentHash.hash) {
      return false;
    }
    
    // Vérifier le TTL
    if (Date.now() - cached.timestamp > this.cacheTtl) {
      return false;
    }
    
    // Vérifier si les appareils ont été mis à jour depuis la génération
    if (currentHash.lastUpdate > cached.lastDeviceUpdate) {
      return false;
    }
    
    return true;
  }

  /**
   * Génère un hash des appareils pour la validation du cache
   */
  private generateDeviceHash(devices: Device[]): DeviceHash {
    const sortedDevices = devices.sort((a, b) => a.id.localeCompare(b.id));
    
    const deviceStrings = sortedDevices.map(d => 
      `${d.id}:${d.ipAddress}:${d.lastSeen?.getTime() || 0}`
    );
    
    const hash = this.simpleHash(deviceStrings.join('|'));
    const lastUpdate = new Date(Math.max(...sortedDevices.map(d => 
      d.lastSeen?.getTime() || 0
    )));
    
    return {
      count: devices.length,
      lastUpdate,
      hash: hash.toString(),
    };
  }

  /**
   * Hash simple pour la validation
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Nettoie le cache en supprimant les entrées expirées
   */
  private cleanupCache(): void {
    const now = Date.now();
    
    // Nettoyage cache topologie
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.cacheTtl) {
        this.cache.delete(key);
      }
    }
    
    // Nettoyage cache appareils - pas de timestamp pour ce cache
    // Le cache des appareils est géré différemment
  }
} 
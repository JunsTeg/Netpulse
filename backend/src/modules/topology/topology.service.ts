import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { 
  Topology, 
  TopologyNode, 
  TopologyLink, 
  TopologyStats, 
  TopologyOptions,
  TopologyError,
  TopologyMetrics
} from './topology.types';
import { Device, DeviceType, DeviceStatus } from '../network/device.model';
import { SnmpService } from './services/snmp.service';
import { ValidationService } from './services/validation.service';
import { LinkGenerationService } from './services/link-generation.service';
import { TopologyRepository } from './repositories/topology.repository';
import { TopologyCacheService } from './services/topology-cache.service';
import { ConnectivityService } from './services/connectivity.service';
import { CentralNodeService } from './services/central-node.service';
import { DeviceRepository } from './repositories/device.repository';

@Injectable()
export class TopologyService {
  private readonly logger = new Logger(TopologyService.name);
  private readonly defaultOptions: Required<TopologyOptions> = {
    gatewayIp: undefined,
    snmpCommunity: 'public',
    snmpTimeout: 5000,
    snmpRetries: 2,
    enableFallback: true,
    confidenceThreshold: 0.3,
    maxParallelQueries: 5,
    cacheEnabled: true,
    cacheTtl: 300000, // 5 minutes
    preferRouter: true,
  };

  constructor(
    private readonly snmpService: SnmpService,
    private readonly validationService: ValidationService,
    private readonly linkGenerationService: LinkGenerationService,
    private readonly topologyRepository: TopologyRepository,
    private readonly topologyCacheService: TopologyCacheService,
    private readonly connectivityService: ConnectivityService,
    private readonly centralNodeService: CentralNodeService,
    private readonly deviceRepository: DeviceRepository,
  ) {}

  /**
   * Génère une topologie ultra-optimisée depuis la base de données
   */
  async generateTopologyFromDatabase(
    options: TopologyOptions = {},
    userId?: string
  ): Promise<{ topology: Topology; metrics: TopologyMetrics }> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };
    const metrics: TopologyMetrics = {
      generationTime: 0,
      snmpQueries: 0,
      snmpSuccessRate: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      warnings: 0,
    };

    try {
      this.logger.log(`[TOPOLOGY] Démarrage génération ultra-optimisée`);

      // 1. Récupération des appareils depuis la BD (1-10ms)
      const dbStartTime = Date.now();
      const devices = await this.getActiveDevicesFromDatabase();
      const dbTime = Date.now() - dbStartTime;
      this.logger.log(`[TOPOLOGY] ${devices.length} appareils récupérés en ${dbTime}ms`);

      // 2. Vérification du cache (1-5ms)
      const cacheStartTime = Date.now();
      const cachedTopology = await this.topologyCacheService.getCachedTopology(devices);
      const cacheTime = Date.now() - cacheStartTime;

      if (cachedTopology && opts.cacheEnabled) {
        metrics.cacheHits = 1;
        metrics.generationTime = Date.now() - startTime;
        this.logger.log(`[TOPOLOGY] Cache hit - Topologie retournée en ${cacheTime}ms`);
        return { topology: cachedTopology, metrics };
      }

      metrics.cacheMisses = 1;
      this.logger.log(`[TOPOLOGY] Cache miss - Génération nécessaire`);

      // 3. Tests de connectivité parallèles (5-30s)
      const connectivityStartTime = Date.now();
      const connectivityResults = await this.connectivityService.testConnectivityByType(devices);
      const connectivityTime = Date.now() - connectivityStartTime;
      this.logger.log(`[TOPOLOGY] Connectivité testée en ${connectivityTime}ms`);

      // 4. Enrichissement SNMP optimisé (2-10s)
      const snmpStartTime = Date.now();
      const snmpData = await this.enrichWithSnmpData(devices, connectivityResults, opts, metrics);
      const snmpTime = Date.now() - snmpStartTime;
      this.logger.log(`[TOPOLOGY] Données SNMP enrichies en ${snmpTime}ms`);

          // 5. Détermination intelligente de l'équipement central (1-2s)
    const centralStartTime = Date.now();
    const centralNodeResult = await this.centralNodeService.determineCentralNode(
      devices, 
      connectivityResults, 
      { gatewayIp: opts.gatewayIp, preferRouter: true }
    );
    const centralTime = Date.now() - centralStartTime;
    this.logger.log(`[TOPOLOGY] Équipement central déterminé en ${centralTime}ms: ${centralNodeResult.centralNode.hostname} (${centralNodeResult.confidence})`);

    // 6. Génération de topologie (1-5s)
    const generationStartTime = Date.now();
    const topology = await this.generateTopologyFromData(devices, snmpData, opts, userId);
    const generationTime = Date.now() - generationStartTime;
    this.logger.log(`[TOPOLOGY] Topologie générée en ${generationTime}ms`);

      // 6. Validation et persistance
      const validationStartTime = Date.now();
      this.validationService.validateTopology(topology);
      await this.topologyRepository.save(topology);
      const validationTime = Date.now() - validationStartTime;

      // 7. Mise en cache
      const totalGenerationTime = Date.now() - startTime;
      await this.topologyCacheService.setCachedTopology(devices, topology, totalGenerationTime);

      metrics.generationTime = totalGenerationTime;
      
      this.logger.log(`[TOPOLOGY] Topologie générée avec succès en ${totalGenerationTime}ms`);
      this.logger.log(`[TOPOLOGY] Métriques: ${JSON.stringify(metrics)}`);

      return { topology, metrics };

    } catch (error) {
      metrics.errors = 1;
      metrics.generationTime = Date.now() - startTime;
      
      this.logger.error(`[TOPOLOGY] Erreur génération: ${error.message}`);
      throw new TopologyError(
        `Échec de la génération de topologie: ${error.message}`,
        'GENERATION_ERROR',
        { options: opts, metrics, error }
      );
    }
  }

  /**
   * Récupère les appareils actifs depuis la base de données
   */
  private async getActiveDevicesFromDatabase(): Promise<Device[]> {
    this.logger.debug('[TOPOLOGY] Récupération des appareils actifs depuis la BD');
    return this.deviceRepository.getActiveDevices();
  }

  /**
   * Enrichit les données avec SNMP de manière optimisée
   */
  private async enrichWithSnmpData(
    devices: Device[],
    connectivityResults: Map<string, boolean>,
    options: Required<TopologyOptions>,
    metrics: TopologyMetrics
  ): Promise<Map<string, any>> {
    // Filtrer seulement les switches connectés
    const connectedSwitches = devices.filter(d => 
      d.deviceType.toLowerCase() === 'switch' && 
      connectivityResults.get(d.id) === true
    );

    if (connectedSwitches.length === 0) {
      this.logger.warn('[TOPOLOGY] Aucun switch connecté pour l\'enrichissement SNMP');
      return new Map();
    }

    this.logger.log(`[TOPOLOGY] Enrichissement SNMP pour ${connectedSwitches.length} switches`);

    try {
      const snmpResults = await this.snmpService.getMacTablesParallel(
        connectedSwitches.map(sw => ({ id: sw.id, ipAddress: sw.ipAddress })),
        options.snmpCommunity,
        options
      );

      metrics.snmpQueries = connectedSwitches.length;
      const successfulQueries = Array.from(snmpResults.values()).filter(data => data.length > 0).length;
      metrics.snmpSuccessRate = metrics.snmpQueries > 0 ? (successfulQueries / metrics.snmpQueries) * 100 : 0;

      this.logger.log(`[TOPOLOGY] SNMP: ${successfulQueries}/${metrics.snmpQueries} requêtes réussies`);

      return snmpResults;

    } catch (error) {
      metrics.warnings = 1;
      this.logger.warn(`[TOPOLOGY] Erreur SNMP: ${error.message}`);
      return new Map();
    }
  }

  /**
   * Génère la topologie à partir des données enrichies
   */
  private async generateTopologyFromData(
    devices: Device[],
    snmpData: Map<string, any>,
    options: Required<TopologyOptions>,
    userId?: string
  ): Promise<Topology> {
    // 1. Génération des nœuds
    const nodes = await this.generateNodes(devices, options);

    // 2. Détermination du nœud central et marquage
    const centralNodeResult = await this.centralNodeService.determineCentralNode(
      devices, 
      new Map(), // Pas de résultats de connectivité disponibles ici
      { gatewayIp: options.gatewayIp, preferRouter: true }
    );
    
    // Marquer le nœud central
    const centralNode = nodes.find(n => n.id === centralNodeResult.centralNode.id);
    if (centralNode) {
      centralNode.isCentral = true;
      this.logger.debug(`[TOPOLOGY] Nœud central marqué: ${centralNode.hostname} (${centralNode.id})`);
    }

    // 3. Génération des liens
    const links = await this.linkGenerationService.generateLinks(nodes, snmpData, options);

    // 4. Calcul des statistiques
    const stats = this.calculateStats(nodes, links, options);

    // 5. Création de la topologie
    const topology: Topology = {
      id: uuidv4(),
      name: `Topologie ${new Date().toISOString()}`,
      generationMethod: 'ultra-optimized',
      nodes,
      links,
      stats,
      createdAt: new Date(),
      source: 'database',
      version: '2.0.0',
      metadata: {
        userId,
        generationMethod: 'ultra-optimized',
        deviceCount: devices.length,
        options: options,
      },
    };

    return topology;
  }

  /**
   * Génère les nœuds de la topologie
   */
  private async generateNodes(devices: Device[], options: TopologyOptions): Promise<TopologyNode[]> {
    const nodes: TopologyNode[] = [];

    // 1. Conversion des appareils en nœuds (sans marquage central)
    for (const device of devices) {
      const node: TopologyNode = {
        id: device.id,
        hostname: device.hostname || 'Unknown',
        ipAddress: device.ipAddress,
        macAddress: device.macAddress,
        deviceType: device.deviceType,
        os: device.os,
        status: this.mapDeviceStatus(device.stats?.status) || 'inactive',
        cpuUsage: device.stats?.cpu || 0,
        memoryUsage: device.stats?.memory || 0,
        bandwidthMbps: typeof device.stats?.bandwidth === 'number' ? device.stats.bandwidth : 0,
        latencyMs: device.stats?.latency || 0,
        uptimeSeconds: parseInt(device.stats?.uptime || '0'),
        vlan: 'N/A',
        services: device.stats?.services || [],
        lastSeen: device.lastSeen,
        firstDiscovered: device.firstDiscovered,
        isCentral: false, // ⭐ NOUVEAU : Sera déterminé par le service central
        isVirtual: false,
      };

      nodes.push(node);
    }

    // 2. Détermination intelligente de l'équipement central
    // Note: Cette étape nécessite les résultats de connectivité
    // Elle sera effectuée après les tests de connectivité dans generateTopologyFromData
    
    return nodes;
  }

  /**
   * Calcule les statistiques de la topologie
   */
  private calculateStats(nodes: TopologyNode[], links: TopologyLink[], options: TopologyOptions): TopologyStats {
    const activeDevices = nodes.filter(n => n.status === 'active').length;
    const virtualDevices = nodes.filter(n => n.isVirtual).length;
    const averageConfidence = this.validationService.calculateAverageConfidence(links);

    const centralNode = nodes.find(n => n.isCentral);
    const centralNodeId = centralNode?.id;

    return {
      totalNodes: nodes.length,
      totalLinks: links.length,
      centralNodeId,
      averageLatency: 0,
      averageBandwidth: 0,
      connectivityScore: averageConfidence,
      averageConfidence: averageConfidence,
    };
  }

  /**
   * Récupère la dernière topologie active
   */
  async getLastTopology(): Promise<Topology | null> {
    try {
      return await this.topologyRepository.getLastActive();
    } catch (error) {
      this.logger.error(`[TOPOLOGY] Erreur récupération dernière topologie: ${error.message}`);
      return null;
    }
  }

  /**
   * Récupère une topologie par ID
   */
  async getTopologyById(id: string): Promise<Topology | null> {
    try {
      return await this.topologyRepository.findById(id);
    } catch (error) {
      this.logger.error(`[TOPOLOGY] Erreur récupération topologie ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Supprime une topologie
   */
  async deleteTopology(id: string): Promise<boolean> {
    try {
      const deleted = await this.topologyRepository.delete(id);
      if (deleted) {
        this.topologyCacheService.invalidateTopologyCache();
      }
      return deleted;
    } catch (error) {
      this.logger.error(`[TOPOLOGY] Erreur suppression topologie ${id}: ${error.message}`);
      return false;
    }
  }

  /**
   * Génère une topologie à partir d'une liste d'appareils
   */
  async generateTopology(devices: any[]): Promise<Topology> {
    try {
      this.logger.log(`[TOPOLOGY] Génération de topologie pour ${devices.length} appareils`);
      
      // Convertir les appareils au format Device
      const convertedDevices: Device[] = devices.map((d: any): Device => ({
        id: d.id || d.id_appareil,
        hostname: d.hostname || 'Unknown',
        ipAddress: d.ipAddress,
        macAddress: d.macAddress,
        deviceType: (d.deviceType || 'other') as DeviceType,
        os: d.os || 'Unknown',
        stats: {
          status: d.status || d.isActive ? DeviceStatus.ACTIVE : DeviceStatus.INACTIVE,
          cpu: 0,
          memory: 0,
          bandwidth: { download: 0, upload: 0 },
          latency: 0,
          uptime: '0',
          services: [],
        },
        lastSeen: d.lastSeen ? new Date(d.lastSeen) : new Date(),
        firstDiscovered: d.firstDiscovered ? new Date(d.firstDiscovered) : new Date(),
      }));

      // Générer la topologie avec les options par défaut
      const result = await this.generateTopologyFromDatabase({}, undefined);
      
      return result.topology;
    } catch (error) {
      this.logger.error(`[TOPOLOGY] Erreur génération topologie: ${error.message}`);
      throw new TopologyError(`Erreur lors de la génération de la topologie: ${error.message}`, 'GENERATION_ERROR', error);
    }
  }

  /**
   * Nettoie les anciennes topologies
   */
  async cleanupOldTopologies(keepDays: number = 30): Promise<number> {
    try {
      const deleted = await this.topologyRepository.cleanupOld(keepDays);
      if (deleted > 0) {
        this.topologyCacheService.invalidateTopologyCache();
      }
      return deleted;
    } catch (error) {
      this.logger.error(`[TOPOLOGY] Erreur nettoyage topologies: ${error.message}`);
      return 0;
    }
  }

  /**
   * Obtient les statistiques du service SNMP
   */
  getSnmpStats(): any {
    return this.snmpService.getCacheStats();
  }

  /**
   * Obtient les statistiques du cache
   */
  getCacheStats(): any {
    return this.topologyCacheService.getCacheStats();
  }

  /**
   * Nettoie le cache SNMP
   */
  clearSnmpCache(): void {
    this.snmpService.clearCache();
  }

  /**
   * Nettoie le cache de topologie
   */
  clearTopologyCache(): void {
    this.topologyCacheService.invalidateTopologyCache();
  }

  /**
   * Mappe le statut de l'appareil vers le format de topologie
   */
  private mapDeviceStatus(status?: any): 'active' | 'inactive' | 'warning' | 'error' {
    if (!status) return 'inactive';
    
    const statusStr = status.toString().toLowerCase();
    if (statusStr === 'active' || statusStr === 'online') return 'active';
    if (statusStr === 'warning' || statusStr === 'danger') return 'warning';
    if (statusStr === 'error' || statusStr === 'offline') return 'error';
    return 'inactive';
  }
} 
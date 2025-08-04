import { Injectable, Logger } from '@nestjs/common';
import { Device } from '../../network/device.model';
import { TopologyNode } from '../topology.types';

export interface CentralNodeCandidate {
  device: Device;
  score: number;
  reasons: string[];
  connectivityScore: number;
  centralityScore: number;
  typeScore: number;
  stableScore: number; // ⭐ NOUVEAU : Score stable basé sur des critères fixes
}

export interface CentralNodeResult {
  centralNode: TopologyNode;
  candidates: CentralNodeCandidate[];
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  networkHash: string; // ⭐ NOUVEAU : Hash du réseau pour la cohérence
}

export interface CachedCentralNode {
  centralNodeId: string;
  networkHash: string;
  timestamp: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

@Injectable()
export class CentralNodeService {
  private readonly logger = new Logger(CentralNodeService.name);
  private centralNodeCache = new Map<string, CachedCentralNode>();
  private readonly cacheTtl = 24 * 60 * 60 * 1000; // 24 heures

  /**
   * Détermine l'équipement central de manière intelligente avec cohérence
   */
  async determineCentralNode(
    devices: Device[],
    connectivityResults: Map<string, boolean>,
    options: { gatewayIp?: string; preferRouter?: boolean; forceRecalculation?: boolean } = {}
  ): Promise<CentralNodeResult> {
    this.logger.log(`[CENTRAL] Détermination de l'équipement central pour ${devices.length} appareils`);

    // 1. Si une gateway IP est fournie, l'utiliser (cohérent)
    if (options.gatewayIp) {
      return this.createVirtualGateway(options.gatewayIp, 'Gateway IP fournie');
    }

    // 2. Générer le hash du réseau pour la cohérence
    const networkHash = this.generateNetworkHash(devices);
    this.logger.debug(`[CENTRAL] Hash du réseau: ${networkHash}`);

    // 3. Vérifier le cache si pas de recalcul forcé
    if (!options.forceRecalculation) {
      const cached = this.getCachedCentralNode(networkHash);
      if (cached) {
        this.logger.log(`[CENTRAL] Utilisation du cache pour l'équipement central: ${cached.centralNodeId}`);
        
        // Récupérer l'appareil depuis la liste actuelle
        const cachedDevice = devices.find(d => d.id === cached.centralNodeId);
        if (cachedDevice) {
          const centralNode = this.createCentralNode(cachedDevice, [cached.reasoning]);
          return {
            centralNode,
            candidates: [], // Pas de candidats en mode cache
            reasoning: cached.reasoning,
            confidence: cached.confidence,
            networkHash,
          };
        }
      }
    }

    // 4. Évaluer tous les candidats avec score stable
    const candidates = await this.evaluateCandidatesWithStableScore(devices, connectivityResults, options);

    if (candidates.length === 0) {
      // 5. Aucun candidat trouvé, créer une gateway virtuelle
      const gatewayIp = this.determineGatewayIp(devices);
      const result = this.createVirtualGateway(gatewayIp, 'Aucun équipement central trouvé');
      result.networkHash = networkHash;
      return result;
    }

    // 6. Sélectionner le meilleur candidat (priorité au score stable)
    const bestCandidate = this.selectBestCandidateWithStablePriority(candidates);
    
    // 7. Créer le nœud central
    const centralNode = this.createCentralNode(bestCandidate.device, bestCandidate.reasons);

    // 8. Mettre en cache le résultat
    this.cacheCentralNode(networkHash, {
      centralNodeId: centralNode.id,
      networkHash,
      timestamp: Date.now(),
      confidence: this.determineConfidence(bestCandidate.stableScore),
      reasoning: bestCandidate.reasons.join(', '),
    });

    this.logger.log(`[CENTRAL] Équipement central sélectionné: ${centralNode.hostname} (${centralNode.ipAddress}) - Score stable: ${bestCandidate.stableScore.toFixed(2)}`);

    return {
      centralNode,
      candidates,
      reasoning: bestCandidate.reasons.join(', '),
      confidence: this.determineConfidence(bestCandidate.stableScore),
      networkHash,
    };
  }

  /**
   * Génère un hash stable du réseau basé sur les appareils
   */
  private generateNetworkHash(devices: Device[]): string {
    // Trier les appareils par ID pour garantir la cohérence
    const sortedDevices = devices
      .filter(d => ['router', 'switch', 'server'].includes(d.deviceType.toLowerCase()))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(d => `${d.id}:${d.deviceType}:${d.ipAddress}`)
      .join('|');
    
    // Hash simple mais efficace pour la cohérence
    let hash = 0;
    for (let i = 0; i < sortedDevices.length; i++) {
      const char = sortedDevices.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Récupère l'équipement central depuis le cache
   */
  private getCachedCentralNode(networkHash: string): CachedCentralNode | null {
    const cached = this.centralNodeCache.get(networkHash);
    if (!cached) return null;

    // Vérifier la validité du cache
    if (Date.now() - cached.timestamp > this.cacheTtl) {
      this.centralNodeCache.delete(networkHash);
      return null;
    }

    return cached;
  }

  /**
   * Met en cache l'équipement central
   */
  private cacheCentralNode(networkHash: string, data: CachedCentralNode): void {
    this.centralNodeCache.set(networkHash, data);
    
    // Nettoyer le cache si trop volumineux
    if (this.centralNodeCache.size > 100) {
      const oldestKey = Array.from(this.centralNodeCache.keys())[0];
      this.centralNodeCache.delete(oldestKey);
    }
  }

  /**
   * Évalue tous les candidats avec score stable
   */
  private async evaluateCandidatesWithStableScore(
    devices: Device[],
    connectivityResults: Map<string, boolean>,
    options: { preferRouter?: boolean }
  ): Promise<CentralNodeCandidate[]> {
    const candidates: CentralNodeCandidate[] = [];

    for (const device of devices) {
      const type = device.deviceType.toLowerCase();
      
      // Seulement les équipements réseau et serveurs
      if (!['router', 'switch', 'server'].includes(type)) {
        continue;
      }

      const candidate: CentralNodeCandidate = {
        device,
        score: 0,
        reasons: [],
        connectivityScore: 0,
        centralityScore: 0,
        typeScore: 0,
        stableScore: 0, // ⭐ NOUVEAU
      };

      // 1. Score de connectivité (variable)
      candidate.connectivityScore = this.calculateConnectivityScore(device, connectivityResults);
      candidate.score += candidate.connectivityScore * 0.4;

      // 2. Score de centralité réseau (stable)
      candidate.centralityScore = this.calculateCentralityScore(device, devices);
      candidate.score += candidate.centralityScore * 0.3;

      // 3. Score de type d'appareil (stable)
      candidate.typeScore = this.calculateTypeScore(device, options);
      candidate.score += candidate.typeScore * 0.3;

      // 4. ⭐ NOUVEAU : Score stable (sans connectivité variable)
      candidate.stableScore = (candidate.centralityScore * 0.5) + (candidate.typeScore * 0.5);

      // 5. Raisons de sélection
      candidate.reasons = this.generateReasons(candidate);

      candidates.push(candidate);
    }

    return candidates;
  }

  /**
   * Calcule le score de connectivité
   */
  private calculateConnectivityScore(
    device: Device,
    connectivityResults: Map<string, boolean>
  ): number {
    const isReachable = connectivityResults.get(device.id) === true;
    
    if (!isReachable) {
      return 0; // Équipement inaccessible
    }

    // Score basé sur la récence de la dernière vue
    const lastSeen = device.lastSeen;
    if (!lastSeen) {
      return 0.5; // Pas d'information de dernière vue
    }

    const hoursSinceLastSeen = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastSeen < 1) {
      return 1.0; // Vu dans la dernière heure
    } else if (hoursSinceLastSeen < 24) {
      return 0.8; // Vu dans les dernières 24h
    } else if (hoursSinceLastSeen < 168) {
      return 0.6; // Vu dans la dernière semaine
    } else {
      return 0.3; // Vu il y a plus d'une semaine
    }
  }

  /**
   * Calcule le score de centralité réseau
   */
  private calculateCentralityScore(device: Device, allDevices: Device[]): number {
    const deviceIp = device.ipAddress;
    const subnet = this.getSubnet(deviceIp);
    
    // Compter les appareils dans le même sous-réseau
    const devicesInSameSubnet = allDevices.filter(d => 
      d.ipAddress.startsWith(subnet) && d.id !== device.id
    ).length;

    // Score basé sur le nombre d'appareils dans le même sous-réseau
    if (devicesInSameSubnet === 0) {
      return 0.1; // Appareil isolé
    } else if (devicesInSameSubnet < 5) {
      return 0.3; // Petit réseau
    } else if (devicesInSameSubnet < 20) {
      return 0.6; // Réseau moyen
    } else {
      return 1.0; // Grand réseau
    }
  }

  /**
   * Calcule le score de type d'appareil
   */
  private calculateTypeScore(device: Device, options: { preferRouter?: boolean }): number {
    const type = device.deviceType.toLowerCase();
    
    // Priorité par type d'appareil
    const typeScores = {
      'router': 1.0,    // Priorité maximale
      'switch': 0.8,    // Haute priorité
      'server': 0.6,    // Priorité moyenne
    };

    let score = typeScores[type] || 0;

    // Bonus si on préfère les routers
    if (options.preferRouter && type === 'router') {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Génère les raisons de sélection
   */
  private generateReasons(candidate: CentralNodeCandidate): string[] {
    const reasons: string[] = [];

    // Raisons de connectivité
    if (candidate.connectivityScore > 0.8) {
      reasons.push('Très récemment actif');
    } else if (candidate.connectivityScore > 0.5) {
      reasons.push('Actif récemment');
    }

    // Raisons de centralité
    if (candidate.centralityScore > 0.8) {
      reasons.push('Réseau dense');
    } else if (candidate.centralityScore > 0.5) {
      reasons.push('Réseau moyen');
    }

    // Raisons de type
    const type = candidate.device.deviceType.toLowerCase();
    if (type === 'router') {
      reasons.push('Équipement de routage');
    } else if (type === 'switch') {
      reasons.push('Équipement de commutation');
    } else if (type === 'server') {
      reasons.push('Serveur central');
    }

    return reasons;
  }

  /**
   * Sélectionne le meilleur candidat
   */
  private selectBestCandidate(candidates: CentralNodeCandidate[]): CentralNodeCandidate {
    // Prendre le candidat avec le score le plus élevé
    const bestCandidate = candidates[0];
    
    // Log des candidats pour debug
    this.logger.debug(`[CENTRAL] Candidats évalués:`);
    candidates.slice(0, 5).forEach((candidate, index) => {
      this.logger.debug(`  ${index + 1}. ${candidate.device.hostname} (${candidate.device.ipAddress}) - Score: ${candidate.score.toFixed(2)}`);
    });

    return bestCandidate;
  }

  /**
   * Sélectionne le meilleur candidat avec priorité au score stable
   */
  private selectBestCandidateWithStablePriority(candidates: CentralNodeCandidate[]): CentralNodeCandidate {
    // ⭐ NOUVEAU : Trier d'abord par score stable, puis par score total
    const sortedCandidates = candidates.sort((a, b) => {
      // Priorité 1 : Score stable (cohérent)
      if (Math.abs(a.stableScore - b.stableScore) > 0.1) {
        return b.stableScore - a.stableScore;
      }
      // Priorité 2 : Score total (pour départager les égalités)
      return b.score - a.score;
    });

    const bestCandidate = sortedCandidates[0];
    
    // Log des candidats pour debug
    this.logger.debug(`[CENTRAL] Candidats évalués (triés par score stable):`);
    sortedCandidates.slice(0, 5).forEach((candidate, index) => {
      this.logger.debug(`  ${index + 1}. ${candidate.device.hostname} (${candidate.device.ipAddress}) - Stable: ${candidate.stableScore.toFixed(2)}, Total: ${candidate.score.toFixed(2)}`);
    });

    return bestCandidate;
  }

  /**
   * Crée un nœud central à partir d'un appareil
   */
  private createCentralNode(device: Device, reasons: string[]): TopologyNode {
    return {
      id: device.id,
      hostname: device.hostname || 'Central Node',
      ipAddress: device.ipAddress,
      macAddress: device.macAddress,
      deviceType: device.deviceType,
      os: device.os,
      status: 'active',
      cpuUsage: device.stats?.cpu || 0,
      memoryUsage: device.stats?.memory || 0,
      bandwidthMbps: typeof device.stats?.bandwidth === 'number' ? device.stats.bandwidth : 0,
      latencyMs: device.stats?.latency || 0,
      uptimeSeconds: parseInt(device.stats?.uptime || '0'),
      vlan: 'N/A',
      services: device.stats?.services || [],
      lastSeen: device.lastSeen,
      firstDiscovered: device.firstDiscovered,
      isCentral: true,
      isVirtual: false,
      metadata: {
        centralNodeReasons: reasons,
        selectionMethod: 'intelligent',
      },
    };
  }

  /**
   * Crée une gateway virtuelle
   */
  private createVirtualGateway(gatewayIp: string, reason: string): CentralNodeResult {
    const virtualGateway: TopologyNode = {
      id: 'gateway',
      hostname: 'Gateway',
      ipAddress: gatewayIp,
      deviceType: 'router' as any,
      status: 'active',
      cpuUsage: 0,
      memoryUsage: 0,
      bandwidthMbps: 0,
      latencyMs: 0,
      uptimeSeconds: 0,
      vlan: 'N/A',
      services: [],
      isCentral: true,
      isVirtual: true,
      metadata: {
        centralNodeReasons: [reason],
        selectionMethod: 'virtual',
      },
    };

    return {
      centralNode: virtualGateway,
      candidates: [],
      reasoning: reason,
      confidence: 'low',
      networkHash: 'virtual-gateway', // Hash spécifique pour les gateways virtuelles
    };
  }

  /**
   * Détermine l'IP de la gateway basée sur les appareils
   */
  private determineGatewayIp(devices: Device[]): string {
    if (devices.length === 0) {
      return '192.168.1.1'; // Gateway par défaut
    }

    // Prendre le premier appareil et déduire la gateway
    const firstDevice = devices[0];
    const ipParts = firstDevice.ipAddress.split('.');
    return `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.1`;
  }

  /**
   * Détermine le niveau de confiance
   */
  private determineConfidence(score: number): 'high' | 'medium' | 'low' {
    if (score > 0.8) return 'high';
    if (score > 0.5) return 'medium';
    return 'low';
  }

  /**
   * Obtient le sous-réseau d'une IP
   */
  private getSubnet(ipAddress: string): string {
    return ipAddress.split('.').slice(0, 3).join('.') + '.';
  }

  /**
   * Valide qu'un équipement central est approprié
   */
  validateCentralNode(centralNode: TopologyNode, devices: Device[]): boolean {
    // Vérifications de base
    if (!centralNode.isCentral) {
      return false;
    }

    // Si c'est une gateway virtuelle, c'est toujours valide
    if (centralNode.isVirtual) {
      return true;
    }

    // Pour un équipement réel, vérifier qu'il existe dans la liste
    const exists = devices.some(d => d.id === centralNode.id);
    if (!exists) {
      return false;
    }

    // Vérifier que c'est un type d'appareil approprié
    const type = centralNode.deviceType.toLowerCase();
    if (!['router', 'switch', 'server'].includes(type)) {
      return false;
    }

    return true;
  }

  /**
   * Force le recalcul de l'équipement central (ignore le cache)
   */
  async forceRecalculateCentralNode(
    devices: Device[],
    connectivityResults: Map<string, boolean>,
    options: { gatewayIp?: string; preferRouter?: boolean } = {}
  ): Promise<CentralNodeResult> {
    this.logger.log(`[CENTRAL] Recalcul forcé de l'équipement central`);
    return this.determineCentralNode(devices, connectivityResults, { ...options, forceRecalculation: true });
  }

  /**
   * Obtient les statistiques du cache d'équipement central
   */
  getCacheStats(): { size: number; hitRate: number; oldestEntry: number | null } {
    const size = this.centralNodeCache.size;
    const now = Date.now();
    const oldestEntry = size > 0 ? Math.min(...Array.from(this.centralNodeCache.values()).map(c => c.timestamp)) : null;
    
    return {
      size,
      hitRate: 0, // TODO: Implémenter le calcul du hit rate
      oldestEntry: oldestEntry ? now - oldestEntry : null,
    };
  }

  /**
   * Vide le cache d'équipement central
   */
  clearCache(): void {
    this.logger.log(`[CENTRAL] Vidage du cache d'équipement central (${this.centralNodeCache.size} entrées)`);
    this.centralNodeCache.clear();
  }

  /**
   * Vérifie la cohérence de l'équipement central pour un réseau donné
   */
  async checkCentralNodeConsistency(
    devices: Device[],
    connectivityResults: Map<string, boolean>,
    options: { gatewayIp?: string; preferRouter?: boolean } = {}
  ): Promise<{
    isConsistent: boolean;
    currentCentralNode: string | null;
    cachedCentralNode: string | null;
    networkHash: string;
    recommendations: string[];
  }> {
    const networkHash = this.generateNetworkHash(devices);
    const cached = this.getCachedCentralNode(networkHash);
    
    // Calculer l'équipement central actuel
    const currentResult = await this.determineCentralNode(devices, connectivityResults, { ...options, forceRecalculation: true });
    
    const isConsistent = cached && cached.centralNodeId === currentResult.centralNode.id;
    
    const recommendations: string[] = [];
    if (!isConsistent && cached) {
      recommendations.push('L\'équipement central a changé depuis la dernière génération');
      recommendations.push('Considérer les changements de connectivité ou de configuration');
    }
    
    if (currentResult.confidence === 'low') {
      recommendations.push('Confiance faible dans la sélection - vérifier la connectivité');
    }

    return {
      isConsistent,
      currentCentralNode: currentResult.centralNode.id,
      cachedCentralNode: cached?.centralNodeId || null,
      networkHash,
      recommendations,
    };
  }

  /**
   * Obtient l'historique des équipements centraux pour un réseau
   */
  getCentralNodeHistory(networkHash: string): CachedCentralNode[] {
    // Pour l'instant, retourne seulement l'entrée actuelle
    // TODO: Implémenter un historique complet
    const current = this.getCachedCentralNode(networkHash);
    return current ? [current] : [];
  }
} 
import { Injectable, Logger } from '@nestjs/common';
import { 
  Topology, 
  TopologyNode, 
  TopologyLink, 
  ValidationError
} from '../topology.types';
import { DeviceType } from '../../network/device.model';
import { Device } from '../../network/device.model';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  /**
   * Valide les données d'entrée pour la génération de topologie
   */
  validateInput(devices: Device[], options: any = {}): void {
    if (!Array.isArray(devices)) {
      throw new ValidationError('Les appareils doivent être un tableau');
    }

    if (devices.length === 0) {
      throw new ValidationError('Aucun appareil fourni pour la génération de topologie');
    }

    // Valider chaque appareil
    devices.forEach((device, index) => {
      this.validateDevice(device, index);
    });

    // Vérifier la cohérence des données
    this.validateDataConsistency(devices);
  }

  /**
   * Valide un appareil individuel
   */
  private validateDevice(device: Device, index: number): void {
    if (!device.id) {
      throw new ValidationError(`Appareil ${index}: ID manquant`);
    }

    if (!device.ipAddress) {
      throw new ValidationError(`Appareil ${index}: Adresse IP manquante`);
    }

    if (!this.isValidIpAddress(device.ipAddress)) {
      throw new ValidationError(`Appareil ${index}: Adresse IP invalide: ${device.ipAddress}`);
    }

    if (!device.deviceType) {
      throw new ValidationError(`Appareil ${index}: Type d'appareil manquant`);
    }

    if (!Object.values(DeviceType).includes(device.deviceType)) {
      throw new ValidationError(`Appareil ${index}: Type d'appareil invalide: ${device.deviceType}`);
    }
  }

  /**
   * Valide la cohérence des données
   */
  private validateDataConsistency(devices: Device[]): void {
    // Vérifier les doublons d'IP
    const ipAddresses = devices.map(d => d.ipAddress).filter(Boolean);
    const uniqueIps = new Set(ipAddresses);
    
    if (uniqueIps.size !== ipAddresses.length) {
      const duplicates = ipAddresses.filter((ip, index) => ipAddresses.indexOf(ip) !== index);
      throw new ValidationError(`Adresses IP en doublon détectées: ${duplicates.join(', ')}`);
    }

    // Vérifier les doublons d'ID
    const ids = devices.map(d => d.id).filter(Boolean);
    const uniqueIds = new Set(ids);
    
    if (uniqueIds.size !== ids.length) {
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      throw new ValidationError(`IDs en doublon détectés: ${duplicates.join(', ')}`);
    }

    // Vérifier qu'il y a au moins un équipement réseau
    const networkDevices = devices.filter(d => 
      ['router', 'switch', 'ap'].includes(d.deviceType?.toLowerCase())
    );
    
    if (networkDevices.length === 0) {
      this.logger.warn('[VALIDATION] Aucun équipement réseau détecté, la topologie sera limitée');
    }
  }

  /**
   * Valide une topologie générée
   */
  validateTopology(topology: Topology): void {
    this.logger.debug(`[VALIDATION] Début validation topologie: ${topology.id}`);
    
    if (!topology.id) {
      throw new ValidationError('ID de topologie manquant');
    }

    if (!topology.nodes || !Array.isArray(topology.nodes)) {
      throw new ValidationError('Nœuds de topologie invalides');
    }

    if (!topology.links || !Array.isArray(topology.links)) {
      throw new ValidationError('Liens de topologie invalides');
    }

    if (!topology.stats) {
      throw new ValidationError('Statistiques de topologie manquantes');
    }

    this.logger.debug(`[VALIDATION] Validation de ${topology.nodes.length} nœuds`);
    // Valider les nœuds
    topology.nodes.forEach((node, index) => {
      try {
        this.validateTopologyNode(node, index);
      } catch (error) {
        this.logger.error(`[VALIDATION] Erreur validation nœud ${index}: ${error.message}`);
        throw error;
      }
    });

    this.logger.debug(`[VALIDATION] Validation de ${topology.links.length} liens`);
    // Valider les liens
    topology.links.forEach((link, index) => {
      try {
        this.validateTopologyLink(link, index, topology.nodes);
      } catch (error) {
        this.logger.error(`[VALIDATION] Erreur validation lien ${index}: ${error.message}`);
        throw error;
      }
    });

    this.logger.debug(`[VALIDATION] Validation des statistiques`);
    // Valider les statistiques
    try {
      this.validateTopologyStats(topology.stats, topology.nodes, topology.links);
    } catch (error) {
      this.logger.error(`[VALIDATION] Erreur validation stats: ${error.message}`);
      throw error;
    }

    this.logger.debug(`[VALIDATION] Validation de la cohérence globale`);
    // Vérifier la cohérence globale
    try {
      this.validateTopologyConsistency(topology);
    } catch (error) {
      this.logger.error(`[VALIDATION] Erreur validation cohérence: ${error.message}`);
      throw error;
    }
    
    this.logger.debug(`[VALIDATION] Topologie validée avec succès`);
  }

  /**
   * Valide un nœud de topologie
   */
  private validateTopologyNode(node: TopologyNode, index: number): void {
    if (!node.id) {
      throw new ValidationError(`Nœud ${index}: ID manquant`);
    }

    if (!node.hostname) {
      throw new ValidationError(`Nœud ${index}: Hostname manquant`);
    }

    if (!node.ipAddress) {
      throw new ValidationError(`Nœud ${index}: Adresse IP manquante`);
    }

    if (!this.isValidIpAddress(node.ipAddress)) {
      throw new ValidationError(`Nœud ${index}: Adresse IP invalide: ${node.ipAddress}`);
    }

    if (!node.deviceType) {
      throw new ValidationError(`Nœud ${index}: Type d'appareil manquant`);
    }

    if (!['active', 'inactive', 'warning', 'error'].includes(node.status)) {
      throw new ValidationError(`Nœud ${index}: Statut invalide: ${node.status}`);
    }
  }

  /**
   * Valide un lien de topologie
   */
  private validateTopologyLink(link: TopologyLink, index: number, nodes: TopologyNode[]): void {
    if (!link.id) {
      throw new ValidationError(`Lien ${index}: ID manquant`);
    }

    if (!link.sourceNodeId) {
      throw new ValidationError(`Lien ${index}: Source manquante`);
    }

    if (!link.targetNodeId) {
      throw new ValidationError(`Lien ${index}: Cible manquante`);
    }

    if (link.sourceNodeId === link.targetNodeId) {
      throw new ValidationError(`Lien ${index}: Source et cible identiques`);
    }

    // Vérifier que les nœuds source et cible existent
    const sourceNode = nodes.find(n => n.id === link.sourceNodeId);
    const targetNode = nodes.find(n => n.id === link.targetNodeId);

    if (!sourceNode) {
      throw new ValidationError(`Lien ${index}: Nœud source introuvable: ${link.sourceNodeId}`);
    }

    if (!targetNode) {
      throw new ValidationError(`Lien ${index}: Nœud cible introuvable: ${link.targetNodeId}`);
    }

    if (!link.linkType) {
      throw new ValidationError(`Lien ${index}: Type manquant`);
    }

    if (!['LAN', 'WAN', 'WIFI', 'VLAN', 'SNMP', 'SUBNET', 'ASSUMED'].includes(link.linkType)) {
      throw new ValidationError(`Lien ${index}: Type invalide: ${link.linkType}`);
    }

    if (!link.confidence) {
      throw new ValidationError(`Lien ${index}: Niveau de confiance manquant`);
    }

    if (!['high', 'medium', 'low'].includes(link.confidence)) {
      throw new ValidationError(`Lien ${index}: Niveau de confiance invalide: ${link.confidence}`);
    }
  }

  /**
   * Valide les statistiques de topologie
   */
  private validateTopologyStats(stats: any, nodes: TopologyNode[], links: TopologyLink[]): void {
    this.logger.debug(`[VALIDATION] Validation stats: ${JSON.stringify(stats)}`);
    
    if (typeof stats.totalNodes !== 'number' || stats.totalNodes !== nodes.length) {
      throw new ValidationError(`Nombre total de nœuds incohérent: attendu ${nodes.length}, reçu ${stats.totalNodes}`);
    }

    if (typeof stats.totalLinks !== 'number' || stats.totalLinks !== links.length) {
      throw new ValidationError(`Nombre total de liens incohérent: attendu ${links.length}, reçu ${stats.totalLinks}`);
    }

    const actualActiveDevices = nodes.filter(n => n.status === 'active').length;

    if (typeof stats.averageConfidence !== 'number') {
      throw new ValidationError('Confiance moyenne invalide');
    }

    if (stats.averageConfidence < 0 || stats.averageConfidence > 1) {
      throw new ValidationError('Confiance moyenne hors limites (0-1)');
    }
  }

  /**
   * Valide la cohérence globale de la topologie
   */
  private validateTopologyConsistency(topology: Topology): void {
    // Vérifier qu'il n'y a pas de liens orphelins
    const nodeIds = new Set(topology.nodes.map(n => n.id));
    const orphanLinks = topology.links.filter(l => 
      !nodeIds.has(l.sourceNodeId) || !nodeIds.has(l.targetNodeId)
    );

    if (orphanLinks.length > 0) {
      throw new ValidationError(`Liens orphelins détectés: ${orphanLinks.length}`);
    }

    // Vérifier qu'il n'y a pas de doublons de liens
    const linkKeys = topology.links.map(l => `${l.sourceNodeId}-${l.targetNodeId}`);
    const uniqueLinkKeys = new Set(linkKeys);
    
    if (uniqueLinkKeys.size !== linkKeys.length) {
      const duplicates = linkKeys.filter((key, index) => linkKeys.indexOf(key) !== index);
      throw new ValidationError(`Liens en doublon détectés: ${duplicates.join(', ')}`);
    }

    // Vérifier la connectivité (au moins un nœud central)
    const centralNodes = topology.nodes.filter(n => n.isCentral);
    if (centralNodes.length === 0) {
      this.logger.warn('[VALIDATION] Aucun nœud central détecté dans la topologie');
    }
  }

  /**
   * Valide une adresse IP
   */
  private isValidIpAddress(ip: string): boolean {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  }

  /**
   * Calcule la confiance moyenne des liens
   */
  calculateAverageConfidence(links: TopologyLink[]): number {
    if (links.length === 0) return 0;

    const confidenceValues = {
      'high': 1.0,
      'medium': 0.6,
      'low': 0.2,
    };

    const totalConfidence = links.reduce((sum, link) => {
      return sum + (confidenceValues[link.confidence] || 0);
    }, 0);

    return totalConfidence / links.length;
  }

  /**
   * Vérifie si une topologie est valide pour l'affichage
   */
  isTopologyDisplayable(topology: Topology): boolean {
    try {
      this.validateTopology(topology);
      return true;
    } catch (error) {
      this.logger.warn(`[VALIDATION] Topologie non affichable: ${error.message}`);
      return false;
    }
  }
} 
import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { 
  TopologyNode, 
  TopologyLink, 
  MacTableEntry,
  TopologyOptions 
} from '../topology.types';
import { Device } from '../../network/device.model';

interface LinkCandidate {
  sourceNodeId: string;
  targetNodeId: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  linkType: 'LAN' | 'WAN' | 'WIFI' | 'VLAN';
  port?: number;
  bandwidth?: string;
}

@Injectable()
export class LinkGenerationService {
  private readonly logger = new Logger(LinkGenerationService.name);

  /**
   * Génère les liens pour une topologie
   */
  async generateLinks(
    nodes: TopologyNode[],
    macTables: Map<string, MacTableEntry[]>,
    options: TopologyOptions = {}
  ): Promise<TopologyLink[]> {
    const links: TopologyLink[] = [];
    const switches = nodes.filter(n => n.deviceType.toLowerCase() === 'switch');

    this.logger.log(`[LINKS] Génération de liens pour ${switches.length} switches`);

    // 1. Génération des liens SNMP (haute confiance)
    const snmpLinks = await this.generateSnmpLinks(nodes, macTables, options);
    links.push(...snmpLinks);

    // 2. Génération des liens de fallback si activé
    if (options.enableFallback !== false) {
      const fallbackLinks = this.generateFallbackLinks(nodes, switches, links, options);
      links.push(...fallbackLinks);
    }

    // 3. Génération des liens logiques
    const logicalLinks = this.generateLogicalLinks(nodes, links, options);
    links.push(...logicalLinks);

    // 4. Déduplication et validation
    const uniqueLinks = this.deduplicateLinks(links);

    this.logger.log(`[LINKS] ${uniqueLinks.length} liens générés (${snmpLinks.length} SNMP, ${logicalLinks.length} logiques)`);

    return uniqueLinks;
  }

  /**
   * Génère les liens basés sur SNMP avec validation améliorée
   */
  private async generateSnmpLinks(
    nodes: TopologyNode[],
    macTables: Map<string, MacTableEntry[]>,
    options: TopologyOptions
  ): Promise<TopologyLink[]> {
    const links: TopologyLink[] = [];
    const switches = nodes.filter(n => n.deviceType.toLowerCase() === 'switch');

    this.logger.log(`[LINKS] Génération de liens SNMP pour ${switches.length} switches`);

    for (const sw of switches) {
      const macTable = macTables.get(sw.id) || [];
      
      if (macTable.length === 0) {
        this.logger.debug(`[LINKS] Pas de table MAC pour ${sw.hostname} (${sw.ipAddress})`);
        continue;
      }

      // ⭐ NOUVEAU : Validation et déduplication des entrées MAC
      const validatedEntries = this.validateMacTableEntries(macTable, nodes);
      
      for (const entry of validatedEntries) {
        const targetNode = this.findNodeByMac(nodes, entry.mac);
        
        if (targetNode && targetNode.id !== sw.id) {
          // ⭐ NOUVEAU : Validation de cohérence
          if (this.isValidNeighborLink(sw, targetNode, entry)) {
            const linkId = this.generateLinkId(sw.id, targetNode.id);
            
            if (!links.some(l => l.id === linkId)) {
              links.push({
                id: linkId,
                sourceNodeId: sw.id,
                targetNodeId: targetNode.id,
                linkType: this.determineLinkType(sw, targetNode),
                sourcePort: entry.port,
                bandwidthMbps: 100, // Valeur par défaut
                confidence: 'high',
                isVirtual: false,
                isAssumed: false,
                reasoning: `SNMP MAC table - Port ${entry.port} - ${entry.mac}`,
                metadata: {
                  lastUpdated: new Date(),
                },
              });
            }
          }
        }
      }
    }

    this.logger.log(`[LINKS] ${links.length} liens SNMP générés`);
    return links;
  }

  /**
   * ⭐ NOUVEAU : Valide et déduplique les entrées MAC
   */
  private validateMacTableEntries(
    macTable: MacTableEntry[], 
    nodes: TopologyNode[]
  ): MacTableEntry[] {
    const validated: MacTableEntry[] = [];
    const seenMacs = new Set<string>();

    for (const entry of macTable) {
      const mac = entry.mac.toLowerCase();
      
      // Ignorer les MACs invalides
      if (!this.isValidMacAddress(mac)) {
        this.logger.debug(`[LINKS] MAC invalide ignorée: ${mac}`);
        continue;
      }

      // Ignorer les doublons
      if (seenMacs.has(mac)) {
        this.logger.debug(`[LINKS] MAC dupliquée ignorée: ${mac}`);
        continue;
      }

      // Vérifier que la MAC correspond à un nœud connu
      const targetNode = this.findNodeByMac(nodes, mac);
      if (!targetNode) {
        this.logger.debug(`[LINKS] MAC non trouvée dans les nœuds: ${mac}`);
        continue;
      }

      seenMacs.add(mac);
      validated.push(entry);
    }

    return validated;
  }

  /**
   * ⭐ NOUVEAU : Trouve un nœud par MAC avec validation
   */
  private findNodeByMac(nodes: TopologyNode[], mac: string): TopologyNode | null {
    const targetMac = mac.toLowerCase();
    
    // Recherche exacte
    const exactMatch = nodes.find(n => 
      n.macAddress && n.macAddress.toLowerCase() === targetMac
    );
    
    if (exactMatch) {
      return exactMatch;
    }

    // ⭐ NOUVEAU : Recherche par MAC partielle (pour les cas où la MAC est tronquée)
    const partialMatch = nodes.find(n => 
      n.macAddress && 
      (n.macAddress.toLowerCase().includes(targetMac) || 
       targetMac.includes(n.macAddress.toLowerCase()))
    );

    if (partialMatch) {
      this.logger.debug(`[LINKS] Correspondance MAC partielle: ${mac} -> ${partialMatch.macAddress}`);
      return partialMatch;
    }

    return null;
  }

  /**
   * ⭐ NOUVEAU : Valide si un lien de voisinage est cohérent
   */
  private isValidNeighborLink(
    source: TopologyNode, 
    target: TopologyNode, 
    entry: MacTableEntry
  ): boolean {
    // 1. Validation de type d'appareil
    const sourceType = source.deviceType.toLowerCase();
    const targetType = target.deviceType.toLowerCase();
    
    // Un switch ne peut pas être connecté à lui-même
    if (source.id === target.id) {
      return false;
    }

    // 2. Validation de port
    if (entry.port && (entry.port < 1 || entry.port > 48)) {
      this.logger.debug(`[LINKS] Port invalide: ${entry.port}`);
      return false;
    }

    // 3. Validation de sous-réseau (optionnelle mais recommandée)
    const sourceSubnet = this.getSubnet(source.ipAddress);
    const targetSubnet = this.getSubnet(target.ipAddress);
    
    // Les équipements réseau peuvent être sur des sous-réseaux différents
    if (sourceType === 'switch' && targetType === 'switch') {
      // Logique spéciale pour les interconnexions de switches
      return true;
    }

    // Pour les autres cas, vérifier la cohérence de sous-réseau
    if (sourceSubnet !== targetSubnet) {
      this.logger.debug(`[LINKS] Sous-réseaux différents: ${sourceSubnet} vs ${targetSubnet}`);
      // Pas forcément une erreur, mais à noter
    }

    return true;
  }

  /**
   * ⭐ NOUVEAU : Détermine le type de lien basé sur les appareils
   */
  private determineLinkType(source: TopologyNode, target: TopologyNode): 'LAN' | 'WAN' | 'WIFI' | 'VLAN' {
    const sourceType = source.deviceType.toLowerCase();
    const targetType = target.deviceType.toLowerCase();

    // Interconnexion de switches
    if (sourceType === 'switch' && targetType === 'switch') {
      return 'LAN';
    }

    // Switch vers serveur
    if ((sourceType === 'switch' && targetType === 'server') ||
        (sourceType === 'server' && targetType === 'switch')) {
      return 'LAN';
    }

    // Router vers switch
    if ((sourceType === 'router' && targetType === 'switch') ||
        (sourceType === 'switch' && targetType === 'router')) {
      return 'WAN';
    }

    // Par défaut
    return 'LAN';
  }

  /**
   * ⭐ NOUVEAU : Valide une adresse MAC
   */
  private isValidMacAddress(mac: string): boolean {
    // Format standard: XX:XX:XX:XX:XX:XX ou XX-XX-XX-XX-XX-XX
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  /**
   * Génère les liens de fallback basés sur la proximité réseau
   */
  private generateFallbackLinks(
    nodes: TopologyNode[],
    switches: TopologyNode[],
    existingLinks: TopologyLink[],
    options: TopologyOptions
  ): TopologyLink[] {
    const links: TopologyLink[] = [];

    for (const sw of switches) {
      const candidates = this.getFallbackCandidates(sw, nodes, existingLinks, options);
      
      for (const candidate of candidates) {
        const linkId = this.generateLinkId(sw.id, candidate.targetNodeId);
        
        if (!existingLinks.some(l => l.id === linkId) && !links.some(l => l.id === linkId)) {
          links.push({
            id: linkId,
            sourceNodeId: sw.id,
            targetNodeId: candidate.targetNodeId,
            linkType: candidate.linkType,
            bandwidthMbps: 0,
            confidence: candidate.confidence,
            isVirtual: false,
            isAssumed: true,
            reasoning: candidate.reasoning,
            metadata: {
              lastUpdated: new Date(),
            },
          });
        }
      }
    }

    return links;
  }

  /**
   * Obtient les candidats de fallback pour un switch
   */
  private getFallbackCandidates(
    switchNode: TopologyNode,
    nodes: TopologyNode[],
    existingLinks: TopologyLink[],
    options: TopologyOptions
  ): LinkCandidate[] {
    const candidates: LinkCandidate[] = [];

    // 1. Critère géographique (sous-réseau)
    const subnetCandidates = this.getSubnetCandidates(switchNode, nodes, existingLinks);
    candidates.push(...subnetCandidates);

    // 2. Critère de type d'appareil
    const typeCandidates = this.getTypeCandidates(switchNode, nodes, existingLinks);
    candidates.push(...typeCandidates);

    // 3. Critère de proximité temporelle
    const timeCandidates = this.getTimeCandidates(switchNode, nodes, existingLinks);
    candidates.push(...timeCandidates);

    // 4. Fusion et déduplication des candidats
    return this.mergeCandidates(candidates);
  }

  /**
   * Candidats basés sur le sous-réseau
   */
  private getSubnetCandidates(
    switchNode: TopologyNode,
    nodes: TopologyNode[],
    existingLinks: TopologyLink[]
  ): LinkCandidate[] {
    const candidates: LinkCandidate[] = [];
    const subnet = this.getSubnet(switchNode.ipAddress);

    const subnetDevices = nodes.filter(n => 
      n.id !== switchNode.id &&
      n.ipAddress.startsWith(subnet) &&
      !this.hasExistingLink(switchNode.id, n.id, existingLinks)
    );

    for (const device of subnetDevices) {
      candidates.push({
        sourceNodeId: switchNode.id,
        targetNodeId: device.id,
        confidence: 'medium',
        reasoning: `Même sous-réseau (${subnet})`,
        linkType: 'LAN',
      });
    }

    return candidates;
  }

  /**
   * Candidats basés sur le type d'appareil
   */
  private getTypeCandidates(
    switchNode: TopologyNode,
    nodes: TopologyNode[],
    existingLinks: TopologyLink[]
  ): LinkCandidate[] {
    const candidates: LinkCandidate[] = [];

    // Les switches se connectent souvent aux serveurs et aux équipements réseau
    const priorityTypes = ['server', 'router', 'ap'];
    
    for (const deviceType of priorityTypes) {
      const typeDevices = nodes.filter(n => 
        n.id !== switchNode.id &&
        n.deviceType.toLowerCase() === deviceType &&
        !this.hasExistingLink(switchNode.id, n.id, existingLinks)
      );

      for (const device of typeDevices) {
        candidates.push({
          sourceNodeId: switchNode.id,
          targetNodeId: device.id,
          confidence: 'medium',
          reasoning: `Type d'appareil prioritaire: ${deviceType}`,
          linkType: 'LAN',
        });
      }
    }

    return candidates;
  }

  /**
   * Candidats basés sur la proximité temporelle
   */
  private getTimeCandidates(
    switchNode: TopologyNode,
    nodes: TopologyNode[],
    existingLinks: TopologyLink[]
  ): LinkCandidate[] {
    const candidates: LinkCandidate[] = [];

    if (!switchNode.lastSeen) return candidates;

    const switchTime = new Date(switchNode.lastSeen);
    const timeThreshold = 24 * 60 * 60 * 1000; // 24 heures

    const timeProximityDevices = nodes.filter(n => 
      n.id !== switchNode.id &&
      n.lastSeen &&
      !this.hasExistingLink(switchNode.id, n.id, existingLinks) &&
      Math.abs(new Date(n.lastSeen).getTime() - switchTime.getTime()) < timeThreshold
    );

    for (const device of timeProximityDevices) {
      candidates.push({
        sourceNodeId: switchNode.id,
        targetNodeId: device.id,
        confidence: 'low',
        reasoning: 'Proximité temporelle',
        linkType: 'LAN',
      });
    }

    return candidates;
  }

  /**
   * Fusionne et déduplique les candidats
   */
  private mergeCandidates(candidates: LinkCandidate[]): LinkCandidate[] {
    const merged = new Map<string, LinkCandidate>();

    for (const candidate of candidates) {
      const key = `${candidate.sourceNodeId}-${candidate.targetNodeId}`;
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, candidate);
      } else {
        // Prendre le candidat avec la plus haute confiance
        const confidenceValues = { 'high': 3, 'medium': 2, 'low': 1 };
        if (confidenceValues[candidate.confidence] > confidenceValues[existing.confidence]) {
          merged.set(key, candidate);
        }
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Génère les liens logiques (router vers switch, etc.)
   */
  private generateLogicalLinks(
    nodes: TopologyNode[],
    existingLinks: TopologyLink[],
    options: TopologyOptions
  ): TopologyLink[] {
    const links: TopologyLink[] = [];
    const routers = nodes.filter(n => n.deviceType.toLowerCase() === 'router');
    const switches = nodes.filter(n => n.deviceType.toLowerCase() === 'switch');

    // Liens router -> switch
    for (const router of routers) {
      for (const sw of switches) {
        if (router.id !== sw.id && !this.hasExistingLink(router.id, sw.id, existingLinks)) {
          const linkId = this.generateLinkId(router.id, sw.id);
          
          links.push({
            id: linkId,
            sourceNodeId: router.id,
            targetNodeId: sw.id,
            linkType: 'LAN',
            bandwidthMbps: 1000,
            confidence: 'medium',
            isVirtual: false,
            isAssumed: true,
            reasoning: 'Lien logique router-switch',
            metadata: {
              lastUpdated: new Date(),
            },
          });
        }
      }
    }

    return links;
  }

  /**
   * Déduplique les liens
   */
  private deduplicateLinks(links: TopologyLink[]): TopologyLink[] {
    const unique = new Map<string, TopologyLink>();

    for (const link of links) {
      const key = link.id;
      const existing = unique.get(key);

      if (!existing) {
        unique.set(key, link);
      } else {
        // Prendre le lien avec la plus haute confiance
        const confidenceValues = { 'high': 3, 'medium': 2, 'low': 1 };
        if (confidenceValues[link.confidence] > confidenceValues[existing.confidence]) {
          unique.set(key, link);
        }
      }
    }

    return Array.from(unique.values());
  }

  /**
   * Utilitaires
   */
  private generateLinkId(source: string, target: string): string {
    return uuidv4();
  }

  private estimateBandwidth(source: TopologyNode, target: TopologyNode): string {
    // Logique simple d'estimation de bande passante
    if (source.deviceType.toLowerCase() === 'switch' && target.deviceType.toLowerCase() === 'switch') {
      return '10Gbps';
    }
    return '1Gbps';
  }

  private getSubnet(ipAddress: string): string {
    return ipAddress.split('.').slice(0, 3).join('.') + '.';
  }

  private hasExistingLink(source: string, target: string, links: TopologyLink[]): boolean {
    return links.some(l => 
      (l.sourceNodeId === source && l.targetNodeId === target) ||
      (l.sourceNodeId === target && l.targetNodeId === source)
    );
  }
} 
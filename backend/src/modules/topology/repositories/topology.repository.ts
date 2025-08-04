import { Injectable, Logger } from '@nestjs/common';
import { sequelize } from '../../../database';
import { QueryTypes } from 'sequelize';
import { Topology, TopologyNode, TopologyLink, TopologyStats } from '../topology.types';

@Injectable()
export class TopologyRepository {
  private readonly logger = new Logger(TopologyRepository.name);

  /**
   * Parse un champ JSON de manière sécurisée
   */
  private parseJsonField(field: any, defaultValue: any = null): any {
    try {
      // Si le champ est déjà un objet (parsé par Sequelize)
      if (typeof field === 'object' && field !== null) {
        return field;
      }
      
      // Si le champ est une chaîne JSON
      if (typeof field === 'string') {
        return JSON.parse(field);
      }
      
      // Valeur par défaut si le champ est null/undefined
      return defaultValue;
    } catch (error) {
      this.logger.warn(`[REPOSITORY] Erreur parsing JSON: ${error.message}, utilisation de la valeur par défaut`);
      return defaultValue;
    }
  }

  /**
   * Sauvegarde une topologie dans les tables normalisées
   */
  async save(topology: Topology): Promise<void> {
    const transaction = await sequelize.transaction();
    
    try {
      // Désactiver les anciennes topologies
      await sequelize.query(
        `UPDATE topologies SET status = 'inactive' WHERE status = 'active'`,
        { 
          type: QueryTypes.UPDATE,
          transaction 
        }
      );

      // Insérer la nouvelle topologie
      await sequelize.query(
        `INSERT INTO topologies (
          id, name, version, source, status, generation_method, 
          device_count, link_count, central_node_id, central_node_confidence,
          generation_time_ms, snmp_success_rate, cache_hit_rate, metadata,
          created_at, updated_at, created_by, expires_at
        ) VALUES (
          :id, :name, :version, :source, 'active', :generation_method,
          :device_count, :link_count, :central_node_id, :central_node_confidence,
          :generation_time_ms, :snmp_success_rate, :cache_hit_rate, :metadata,
          NOW(), NOW(), :created_by, :expires_at
        )`,
        {
          replacements: {
            id: topology.id,
            name: topology.name,
            version: topology.version,
            source: topology.source,
            generation_method: topology.generationMethod,
            device_count: topology.nodes.length,
            link_count: topology.links.length,
            central_node_id: topology.centralNode?.id || null,
            central_node_confidence: topology.centralNode?.confidence || 'medium',
            generation_time_ms: topology.stats?.generationTime || 0,
            snmp_success_rate: topology.stats?.snmpSuccessRate || 0,
            cache_hit_rate: topology.stats?.cacheHitRate || 0,
            metadata: JSON.stringify(topology.metadata || {}),
            created_by: topology.createdBy || null,
            expires_at: topology.expiresAt || null,
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );

      // Insérer les nœuds (avec vérification des doublons)
      const processedNodeIds = new Set();
      for (const node of topology.nodes) {
        // Éviter les doublons
        if (processedNodeIds.has(node.id)) {
          this.logger.warn(`[REPOSITORY] Nœud en doublon ignoré: ${node.id} (${node.hostname})`);
          continue;
        }
        processedNodeIds.add(node.id);
        
        await sequelize.query(
          `INSERT INTO topology_nodes (
            id, topology_id, device_id, hostname, ip_address, mac_address,
            device_type, os, is_central, is_virtual, status, cpu_usage,
            memory_usage, bandwidth_mbps, latency_ms, uptime_seconds,
            vlan, services, last_seen, first_discovered, node_metadata, created_at
          ) VALUES (
            :id, :topology_id, :device_id, :hostname, :ip_address, :mac_address,
            :device_type, :os, :is_central, :is_virtual, :status, :cpu_usage,
            :memory_usage, :bandwidth_mbps, :latency_ms, :uptime_seconds,
            :vlan, :services, :last_seen, :first_discovered, :node_metadata, NOW()
          )`,
          {
            replacements: {
              id: node.id,
              topology_id: topology.id,
              device_id: node.deviceId || node.id, // Utiliser l'ID du nœud si deviceId n'est pas défini
              hostname: node.hostname,
              ip_address: node.ipAddress,
              mac_address: node.macAddress,
              device_type: node.deviceType,
              os: node.os,
              is_central: node.isCentral,
              is_virtual: node.isVirtual,
              status: node.status,
              cpu_usage: node.cpuUsage,
              memory_usage: node.memoryUsage,
              bandwidth_mbps: node.bandwidthMbps,
              latency_ms: node.latencyMs,
              uptime_seconds: node.uptimeSeconds,
              vlan: node.vlan,
              services: JSON.stringify(node.services || []),
              last_seen: node.lastSeen,
              first_discovered: node.firstDiscovered,
              node_metadata: JSON.stringify(node.metadata || {}),
            },
            type: QueryTypes.INSERT,
            transaction
          }
        );
      }

      // Insérer les liens
      for (const link of topology.links) {
        await sequelize.query(
          `INSERT INTO topology_links (
            id, topology_id, source_node_id, target_node_id, link_type,
            confidence, is_virtual, is_assumed, source_port, target_port,
            bandwidth_mbps, latency_ms, packet_loss, vlan_id, reasoning,
            link_metadata, last_updated, created_at
          ) VALUES (
            :id, :topology_id, :source_node_id, :target_node_id, :link_type,
            :confidence, :is_virtual, :is_assumed, :source_port, :target_port,
            :bandwidth_mbps, :latency_ms, :packet_loss, :vlan_id, :reasoning,
            :link_metadata, NOW(), NOW()
          )`,
          {
            replacements: {
              id: link.id,
              topology_id: topology.id,
              source_node_id: link.sourceNodeId,
              target_node_id: link.targetNodeId,
              link_type: link.linkType,
              confidence: link.confidence,
              is_virtual: link.isVirtual,
              is_assumed: link.isAssumed,
              source_port: link.sourcePort,
              target_port: link.targetPort,
              bandwidth_mbps: link.bandwidthMbps,
              latency_ms: link.latencyMs,
              packet_loss: link.packetLoss,
              vlan_id: link.vlanId,
              reasoning: link.reasoning,
              link_metadata: JSON.stringify(link.metadata || {}),
            },
            type: QueryTypes.INSERT,
            transaction
          }
        );
      }

      // Insérer les statistiques
      if (topology.stats) {
        await this.saveTopologyStats(topology.id, topology.stats, transaction);
      }

      await transaction.commit();
      this.logger.log(`[REPOSITORY] Topologie ${topology.id} sauvegardée avec ${topology.nodes.length} nœuds et ${topology.links.length} liens`);
    } catch (error) {
      await transaction.rollback();
      this.logger.error(`[REPOSITORY] Erreur sauvegarde topologie: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sauvegarde les statistiques de topologie
   */
  private async saveTopologyStats(topologyId: string, stats: TopologyStats, transaction: any): Promise<void> {
    const statEntries = [
      { type: 'overall', key: 'total_nodes', value: stats.totalNodes, unit: 'count' },
      { type: 'overall', key: 'total_links', value: stats.totalLinks, unit: 'count' },
      { type: 'performance', key: 'avg_latency', value: stats.averageLatency, unit: 'ms' },
      { type: 'performance', key: 'avg_bandwidth', value: stats.averageBandwidth, unit: 'mbps' },
      { type: 'performance', key: 'connectivity_score', value: stats.connectivityScore, unit: 'percentage' },
      { type: 'performance', key: 'avg_confidence', value: stats.averageConfidence, unit: 'percentage' },
    ];

    for (const entry of statEntries) {
      await sequelize.query(
        `INSERT INTO topology_stats (
          id, topology_id, stat_type, stat_key, stat_value, stat_unit, stat_description, calculated_at
        ) VALUES (
          UUID(), :topology_id, :stat_type, :stat_key, :stat_value, :stat_unit, :stat_description, NOW()
        )`,
        {
          replacements: {
            topology_id: topologyId,
            stat_type: entry.type,
            stat_key: entry.key,
            stat_value: entry.value || 0,
            stat_unit: entry.unit,
            stat_description: `Statistic for ${entry.key}`,
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );
    }
  }

  /**
   * Récupère la dernière topologie active
   */
  async getLastActive(): Promise<Topology | null> {
    try {
      // Récupérer la topologie active
      const [topologyRow] = await sequelize.query(
        `SELECT * FROM topologies WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`,
        { type: QueryTypes.SELECT }
      );

      if (!topologyRow) {
        return null;
      }

      const topology = topologyRow as any;
      const topologyId = topology.id;

      // Récupérer les nœuds
      const nodes = await sequelize.query(
        `SELECT * FROM topology_nodes WHERE topology_id = :topology_id`,
        {
          replacements: { topology_id: topologyId },
          type: QueryTypes.SELECT,
        }
      );

      // Récupérer les liens
      const links = await sequelize.query(
        `SELECT * FROM topology_links WHERE topology_id = :topology_id`,
        {
          replacements: { topology_id: topologyId },
          type: QueryTypes.SELECT,
        }
      );

      // Récupérer les statistiques
      const stats = await sequelize.query(
        `SELECT * FROM topology_stats WHERE topology_id = :topology_id`,
        {
          replacements: { topology_id: topologyId },
          type: QueryTypes.SELECT,
        }
      );

      // Reconstruire l'objet Topology
      return this.reconstructTopology(topology, nodes, links, stats);
    } catch (error) {
      this.logger.error(`[REPOSITORY] Erreur récupération dernière topologie: ${error.message}`);
      return null;
    }
  }

  /**
   * Récupère une topologie par ID
   */
  async findById(id: string): Promise<Topology | null> {
    try {
      // Récupérer la topologie
      const [topologyRow] = await sequelize.query(
        `SELECT * FROM topologies WHERE id = :id`,
        {
          replacements: { id },
          type: QueryTypes.SELECT,
        }
      );

      if (!topologyRow) {
        return null;
      }

      const topology = topologyRow as any;

      // Récupérer les nœuds
      const nodes = await sequelize.query(
        `SELECT * FROM topology_nodes WHERE topology_id = :topology_id`,
        {
          replacements: { topology_id: id },
          type: QueryTypes.SELECT,
        }
      );

      // Récupérer les liens
      const links = await sequelize.query(
        `SELECT * FROM topology_links WHERE topology_id = :topology_id`,
        {
          replacements: { topology_id: id },
          type: QueryTypes.SELECT,
        }
      );

      // Récupérer les statistiques
      const stats = await sequelize.query(
        `SELECT * FROM topology_stats WHERE topology_id = :topology_id`,
        {
          replacements: { topology_id: id },
          type: QueryTypes.SELECT,
        }
      );

      // Reconstruire l'objet Topology
      return this.reconstructTopology(topology, nodes, links, stats);
    } catch (error) {
      this.logger.error(`[REPOSITORY] Erreur récupération topologie ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Reconstruit un objet Topology à partir des données normalisées
   */
  private reconstructTopology(topologyRow: any, nodes: any[], links: any[], stats: any[]): Topology {
    // Reconstruire les nœuds
    const topologyNodes: TopologyNode[] = nodes.map((node: any) => ({
      id: node.id,
      deviceId: node.device_id,
      hostname: node.hostname,
      ipAddress: node.ip_address,
      macAddress: node.mac_address,
      deviceType: node.device_type,
      os: node.os,
      isCentral: node.is_central,
      isVirtual: node.is_virtual,
      status: node.status,
      cpuUsage: node.cpu_usage,
      memoryUsage: node.memory_usage,
      bandwidthMbps: node.bandwidth_mbps,
      latencyMs: node.latency_ms,
      uptimeSeconds: node.uptime_seconds,
      vlan: node.vlan,
      services: this.parseJsonField(node.services, []),
      lastSeen: node.last_seen,
      firstDiscovered: node.first_discovered,
      metadata: this.parseJsonField(node.node_metadata, {}),
    }));

    // Reconstruire les liens
    const topologyLinks: TopologyLink[] = links.map((link: any) => ({
      id: link.id,
      sourceNodeId: link.source_node_id,
      targetNodeId: link.target_node_id,
      linkType: link.link_type,
      confidence: link.confidence,
      isVirtual: link.is_virtual,
      isAssumed: link.is_assumed,
      sourcePort: link.source_port,
      targetPort: link.target_port,
      bandwidthMbps: link.bandwidth_mbps,
      latencyMs: link.latency_ms,
      packetLoss: link.packet_loss,
      vlanId: link.vlan_id,
      reasoning: link.reasoning,
      metadata: this.parseJsonField(link.link_metadata, {}),
    }));

    // Reconstruire les statistiques
    const topologyStats: TopologyStats = {
      totalNodes: topologyRow.device_count,
      totalLinks: topologyRow.link_count,
      centralNodeId: topologyRow.central_node_id,
      averageLatency: 0,
      averageBandwidth: 0,
      connectivityScore: 0,
      averageConfidence: 0,
    };

    // Extraire les statistiques des données
    stats.forEach((stat: any) => {
      if (stat.stat_key === 'avg_latency') topologyStats.averageLatency = stat.stat_value;
      if (stat.stat_key === 'avg_bandwidth') topologyStats.averageBandwidth = stat.stat_value;
      if (stat.stat_key === 'connectivity_score') topologyStats.connectivityScore = stat.stat_value;
      if (stat.stat_key === 'avg_confidence') topologyStats.averageConfidence = stat.stat_value;
    });

    // Trouver le nœud central
    const centralNode = topologyNodes.find(node => node.isCentral);

    return {
      id: topologyRow.id,
      name: topologyRow.name,
      version: topologyRow.version,
      source: topologyRow.source,
      generationMethod: topologyRow.generation_method,
      nodes: topologyNodes,
      links: topologyLinks,
      stats: topologyStats,
      centralNode: centralNode ? {
        id: centralNode.id,
        hostname: centralNode.hostname,
        confidence: topologyRow.central_node_confidence,
      } : null,
      metadata: this.parseJsonField(topologyRow.metadata, {}),
      createdAt: topologyRow.created_at,
      updatedAt: topologyRow.updated_at,
      createdBy: topologyRow.created_by,
      expiresAt: topologyRow.expires_at,
    };
  }

  /**
   * Supprime une topologie
   */
  async delete(id: string): Promise<boolean> {
    const transaction = await sequelize.transaction();
    
    try {
      // Supprimer les statistiques
      await sequelize.query(
        `DELETE FROM topology_stats WHERE topology_id = :id`,
        {
          replacements: { id },
          type: QueryTypes.DELETE,
          transaction
        }
      );

      // Supprimer les liens
      await sequelize.query(
        `DELETE FROM topology_links WHERE topology_id = :id`,
        {
          replacements: { id },
          type: QueryTypes.DELETE,
          transaction
        }
      );

      // Supprimer les nœuds
      await sequelize.query(
        `DELETE FROM topology_nodes WHERE topology_id = :id`,
        {
          replacements: { id },
          type: QueryTypes.DELETE,
          transaction
        }
      );

      // Supprimer la topologie
      const result = await sequelize.query(
        `DELETE FROM topologies WHERE id = :id`,
        {
          replacements: { id },
          type: QueryTypes.DELETE,
          transaction
        }
      );

      await transaction.commit();
      
      const deleted = (result as any)[1] > 0;
      if (deleted) {
        this.logger.log(`[REPOSITORY] Topologie ${id} supprimée`);
      }

      return deleted;
    } catch (error) {
      await transaction.rollback();
      this.logger.error(`[REPOSITORY] Erreur suppression topologie ${id}: ${error.message}`);
      return false;
    }
  }

  /**
   * Nettoie les anciennes topologies
   */
  async cleanupOld(keepDays: number = 30): Promise<number> {
    const transaction = await sequelize.transaction();
    
    try {
      // Trouver les topologies à supprimer
      const [oldTopologies] = await sequelize.query(
        `SELECT id FROM topologies WHERE status = 'inactive' AND created_at < DATE_SUB(NOW(), INTERVAL :days DAY)`,
        {
          replacements: { days: keepDays },
          type: QueryTypes.SELECT,
          transaction
        }
      );

      let deleted = 0;
      for (const topology of oldTopologies as any[]) {
        const success = await this.delete(topology.id);
        if (success) deleted++;
      }

      await transaction.commit();
      this.logger.log(`[REPOSITORY] ${deleted} anciennes topologies supprimées`);
      return deleted;
    } catch (error) {
      await transaction.rollback();
      this.logger.error(`[REPOSITORY] Erreur nettoyage topologies: ${error.message}`);
      return 0;
    }
  }

  /**
   * Récupère toutes les topologies
   */
  async findAll(): Promise<Topology[]> {
    try {
      const topologies = await sequelize.query(
        `SELECT * FROM topologies ORDER BY created_at DESC`,
        { type: QueryTypes.SELECT }
      );

      const result: Topology[] = [];
      for (const topology of topologies as any[]) {
        const fullTopology = await this.findById(topology.id);
        if (fullTopology) {
          result.push(fullTopology);
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`[REPOSITORY] Erreur récupération topologies: ${error.message}`);
      return [];
    }
  }

  /**
   * Récupère les statistiques de la base de données
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    oldest: Date | null;
    newest: Date | null;
  }> {
    try {
      const [stats] = await sequelize.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
          MIN(created_at) as oldest,
          MAX(created_at) as newest
         FROM topologies`,
        { type: QueryTypes.SELECT }
      );

      return {
        total: Number((stats as any)?.total || 0),
        active: Number((stats as any)?.active || 0),
        inactive: Number((stats as any)?.inactive || 0),
        oldest: (stats as any)?.oldest ? new Date((stats as any).oldest) : null,
        newest: (stats as any)?.newest ? new Date((stats as any).newest) : null,
      };
    } catch (error) {
      this.logger.error(`[REPOSITORY] Erreur récupération statistiques: ${error.message}`);
      return {
        total: 0,
        active: 0,
        inactive: 0,
        oldest: null,
        newest: null,
      };
    }
  }
} 
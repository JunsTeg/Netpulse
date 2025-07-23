import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { TracerouteAgentService } from '../network/agents/traceroute.service';
import { sequelize } from '../../database';
import { QueryTypes } from 'sequelize';

@Injectable()
export class TopologyService {
  constructor(
    @Inject(forwardRef(() => TracerouteAgentService))
    private readonly tracerouteAgent: TracerouteAgentService,
  ) {}

  async generateTopology(devices: any[], gatewayIp?: string): Promise<any> {
    // Détection automatique de la gateway si non fournie
    if (!gatewayIp) {
      // Tentative de déduction de la gateway la plus probable
      // On prend la première ip de type router ou server, ou .1 du réseau
      const router = devices.find(d => (d.deviceType || '').toLowerCase() === 'router')
      if (router) gatewayIp = router.ipAddress
      else if (devices.length > 0) {
        const ipParts = devices[0].ipAddress.split('.')
        gatewayIp = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.1`
      }
    }
    let centralNodeId = null;
    // Définir la fonction isRelevant AVANT son utilisation
    const isRelevant = (d: any) => {
      const type = (d.deviceType || '').toLowerCase();
      const isCore = type === 'router' || type === 'server';
      const isNew = (() => {
        if (!d.firstDiscovered) return false;
        const days = (Date.now() - new Date(d.firstDiscovered).getTime()) / (1000 * 3600 * 24);
        return days < 2;
      })();
      return isCore || isNew;
    };
    // Générer les nœuds avec marquage central et support isVirtual
    const nodes: Array<any & { isVirtual?: boolean }> = devices.map(device => {
      const isCentral = device.ipAddress === gatewayIp;
      if (isCentral) centralNodeId = device.id;
      return {
        id: device.id,
        hostname: device.hostname,
        ipAddress: device.ipAddress,
        deviceType: device.deviceType,
        stats: device.stats || {},
        lastSeen: device.lastSeen,
        firstDiscovered: device.firstDiscovered,
        macAddress: device.macAddress,
        os: device.os,
        isCentral,
        isVirtual: false,
      };
    });
    // Si la gateway n'est pas dans la liste, on l'ajoute comme nœud virtuel
    if (!centralNodeId && gatewayIp) {
      const virtualGateway = {
        id: 'gateway',
        hostname: 'Gateway',
        ipAddress: gatewayIp,
        deviceType: 'router',
        stats: {},
        lastSeen: null,
        firstDiscovered: null,
        macAddress: null,
        os: null,
        isCentral: true,
        isVirtual: true,
      };
      nodes.push(virtualGateway);
      centralNodeId = 'gateway';
    }
    // --- Correction : enrichir la liste des nœuds avec tous les hops vus dans les traceroutes ---
    // 1. Collecter tous les hops de tous les traceroutes
    const allTracerouteHops = new Set<string>();
    const relevantDevices = devices.filter(isRelevant);
    const tracerouteResults = await Promise.all(
      relevantDevices.map(device => this.tracerouteAgent.execute({ target: device.ipAddress, deepMode: false }))
    );
    tracerouteResults.forEach((result) => {
      if (!result.success) return;
      result.hops.forEach(hop => {
        if (hop.ip) allTracerouteHops.add(hop.ip);
      });
    });
    // 2. Ajouter un nœud virtuel pour chaque hop inconnu
    allTracerouteHops.forEach(ip => {
      if (!nodes.some(n => n.ipAddress === ip)) {
        nodes.push({
          id: `virtual-${ip}`,
          hostname: `Noeud ${ip}`,
          ipAddress: ip,
          deviceType: 'unknown',
          stats: {},
          lastSeen: null,
          firstDiscovered: null,
          macAddress: null,
          os: null,
          isCentral: false,
          isVirtual: true,
        });
      }
    });
    // 3. Générer les liens à partir des hops (chaque segment)
    const links: any[] = [];
    tracerouteResults.forEach((result) => {
      if (!result.success) return;
      for (let i = 0; i < result.hops.length - 1; i++) {
        const currentHop = result.hops[i];
        const nextHop = result.hops[i + 1];
        // Trouver les nœuds (réels ou virtuels)
        const sourceNode = nodes.find((n: any) => n.ipAddress === currentHop.ip);
        const targetNode = nodes.find((n: any) => n.ipAddress === nextHop.ip);
        if (sourceNode && targetNode) {
          const linkExists = links.some(
            (link) =>
              (link.source === sourceNode.id && link.target === targetNode.id) ||
              (link.source === targetNode.id && link.target === sourceNode.id)
          );
          if (!linkExists) {
            links.push({
              source: sourceNode.id,
              target: targetNode.id,
              type: 'LAN',
              bandwidth: '1Gbps',
              isVirtual: sourceNode.isVirtual || targetNode.isVirtual || false,
            });
          }
        }
      }
    });
    // Statistiques
    const stats = {
      totalDevices: nodes.length,
      totalLinks: links.length,
      activeDevices: nodes.filter(n => n.stats.status === 'active').length,
      centralNodeId,
      gatewayIp,
    };
    // Ajout des champs generatedAt et source
    const topology = {
      nodes,
      links,
      stats,
      generatedAt: new Date().toISOString(),
      source: 'manual', // ou 'scan' si besoin
    };
    // Persistance : désactiver les anciennes, insérer la nouvelle
    await sequelize.query(
      `UPDATE topologie_reseau SET isActive = FALSE WHERE isActive = TRUE`,
      { type: QueryTypes.UPDATE }
    );
    await sequelize.query(
      `INSERT INTO topologie_reseau (name, data, isActive, createdAt) VALUES (:name, :data, TRUE, NOW())`,
      {
        replacements: {
          name: `Topologie ${new Date().toISOString()}`,
          data: JSON.stringify(topology),
        },
        type: QueryTypes.INSERT,
      }
    );
    return topology;
  }

  async getLastTopology(): Promise<any> {
    // Charger la dernière topologie persistée depuis la base
    const [row] = await sequelize.query(
      `SELECT data FROM topologie_reseau WHERE isActive = TRUE ORDER BY updatedAt DESC LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    const data = (row as any)?.data;
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }
} 
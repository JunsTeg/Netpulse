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

  async generateTopology(devices: any[]): Promise<any> {
    // Filtrage intelligent : routeurs, serveurs, nouveaux devices
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
    const relevantDevices = devices.filter(isRelevant);
    // Lancer les traceroutes en parallèle (limité à 5)
    const limit = 5;
    const tracerouteResults = await Promise.all(
      relevantDevices.map(device => this.tracerouteAgent.execute({ target: device.ipAddress, deepMode: false }))
    );
    // Générer les liens à partir des résultats de traceroute
    const links: any[] = [];
    tracerouteResults.forEach((result) => {
      if (!result.success) return;
      for (let i = 0; i < result.hops.length - 1; i++) {
        const currentHop = result.hops[i];
        const nextHop = result.hops[i + 1];
        // Trouver les appareils correspondants
        const sourceDevice = devices.find((d: any) => d.ipAddress === currentHop.ip);
        const targetDevice = devices.find((d: any) => d.ipAddress === nextHop.ip);
        if (sourceDevice && targetDevice) {
          // Vérifier si le lien existe déjà
          const linkExists = links.some(
            (link) =>
              (link.source === sourceDevice.id && link.target === targetDevice.id) ||
              (link.source === targetDevice.id && link.target === sourceDevice.id)
          );
          if (!linkExists) {
            links.push({
              source: sourceDevice.id,
              target: targetDevice.id,
              type: 'LAN',
              bandwidth: '1Gbps',
            });
          }
        }
      }
    });
    // Générer les nœuds
    const nodes = devices.map(device => ({
      id: device.id,
      hostname: device.hostname,
      ipAddress: device.ipAddress,
      deviceType: device.deviceType,
      stats: device.stats || {},
      lastSeen: device.lastSeen,
      firstDiscovered: device.firstDiscovered,
      macAddress: device.macAddress,
      os: device.os,
    }));
    // Statistiques
    const stats = {
      totalDevices: nodes.length,
      totalLinks: links.length,
      activeDevices: nodes.filter(n => n.stats.status === 'active').length,
    };
    const topology = { nodes, links, stats };
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
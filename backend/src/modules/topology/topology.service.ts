import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { TracerouteAgentService } from '../network/agents/traceroute.service';
import { sequelize } from '../../database';
import { QueryTypes } from 'sequelize';
import * as snmp from 'net-snmp';
import { ExecutionManagerService } from '../../execution-manager/execution-manager.service';
import { TopologyTask } from '../../execution-manager/tasks/topology.task';

@Injectable()
export class TopologyService {
  constructor(
    @Inject(forwardRef(() => TracerouteAgentService))
    private readonly tracerouteAgent: TracerouteAgentService,
    @Inject(ExecutionManagerService)
    private readonly executionManager: ExecutionManagerService,
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
    // Générer les nœuds avec marquage central et support isVirtual
    const nodes: Array<any & { isVirtual?: boolean }> = devices.map(device => {
      const type = (device.deviceType || '').toLowerCase();
      // Sont centraux : router, server, switch
      const isCentral = type === 'router' || type === 'server' || type === 'switch';
      if (isCentral && !centralNodeId) centralNodeId = device.id;
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
    // Génération des liens physiques à partir de la table MAC SNMP
    const switches = devices.filter(d => (d.deviceType || '').toLowerCase() === 'switch');
    const links: any[] = [];
    for (const sw of switches) {
      let macTable: {mac: string, port: number}[] = [];
      let snmpOk = true;
      try {
        macTable = await getMacTable(sw.ipAddress, 'public');
      } catch (err) {
        snmpOk = false;
        // Marquer le switch comme non SNMP
        const node = nodes.find(n => n.id === sw.id);
        if (node) node.snmpUnavailable = true;
        throw err; // Supprimer le logger.warn
      }

      if (snmpOk) {
        for (const entry of macTable) {
          const device = devices.find(d => d.macAddress && d.macAddress.toLowerCase() === entry.mac.toLowerCase());
          if (device) {
            const alreadyLinked = links.some(l => (l.source === sw.id && l.target === device.id) || (l.source === device.id && l.target === sw.id));
            if (!alreadyLinked) {
            links.push({
                source: sw.id,
                target: device.id,
              type: 'LAN',
                port: entry.port ?? null,
                isVirtual: false,
              bandwidth: '1Gbps',
                confidence: 'high',
              });
            }
          }
        }
      } else {
        // Fallback : lier tous les appareils du même sous-réseau qui n'ont pas déjà de lien
        const subnet = sw.ipAddress.split('.').slice(0, 3).join('.') + '.';
        const candidates = devices.filter(d =>
          d.ipAddress && d.ipAddress.startsWith(subnet) &&
          d.id !== sw.id &&
          !links.some(l => (l.source === sw.id && l.target === d.id) || (l.source === d.id && l.target === sw.id))
        );
        for (const device of candidates) {
          links.push({
            source: sw.id,
            target: device.id,
            type: 'LAN',
            port: null,
            isVirtual: false,
            bandwidth: 'unknown',
            confidence: 'low',
            isAssumed: true
          });
        }
      }
    }
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

  async submitTopologyGeneration(devices: any[], userId?: string) {
    const task = new TopologyTask(
      () => this.generateTopology(devices),
      { userId, priority: 8 }
    );
    this.executionManager.submit(task);
    return task.id;
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

// Fonction utilitaire pour récupérer la table MAC d'un switch via SNMP (BRIDGE-MIB)
export async function getMacTable(switchIp: string, community = 'public'): Promise<{mac: string, port: number}[]> {
  // Valeurs SNMP ObjectType pour les erreurs courantes
  const SNMP_NoSuchInstance = 128;
  const SNMP_NoSuchObject = 129;
  const SNMP_EndOfMibView = 130;
  return new Promise((resolve, reject) => {
    const session = snmp.createSession(switchIp, community);
    const macTableOid = '1.3.6.1.2.1.17.4.3.1.2';
    const macTable: {mac: string, port: number}[] = [];
    (session as any).walk(macTableOid, 40, (varbind: any) => {
      if (
        varbind.type === SNMP_NoSuchInstance ||
        varbind.type === SNMP_NoSuchObject ||
        varbind.type === SNMP_EndOfMibView
      ) return;
      const oidParts = varbind.oid.split('.');
      const mac = oidParts.slice(-6).map((x: string) => (+x).toString(16).padStart(2, '0')).join(':');
      macTable.push({mac, port: varbind.value});
    }, (error: any) => {
      session.close();
      if (error) reject(error);
      else resolve(macTable);
    });
  });
} 
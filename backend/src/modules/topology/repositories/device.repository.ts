import { Injectable, Logger } from '@nestjs/common';
import { Device } from '../../network/device.model';
import { sequelize } from '../../../database';
import { QueryTypes } from 'sequelize';

@Injectable()
export class DeviceRepository {
  private readonly logger = new Logger(DeviceRepository.name);

  /**
   * Récupère tous les appareils actifs depuis la base de données
   */
  async getActiveDevices(): Promise<Device[]> {
    try {
      this.logger.debug('[REPOSITORY] Récupération des appareils actifs depuis la BD');
      
      const [results] = await sequelize.query(`
        SELECT 
          id,
          hostname,
          ipAddress,
          macAddress,
          deviceType,
          os,
          stats,
          lastSeen,
          firstDiscovered,
          createdAt,
          isActive
        FROM appareils 
        WHERE isActive = 1 
        AND lastSeen > DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY deviceType DESC, lastSeen DESC
      `);

      const devices: Device[] = results.map((row: any) => ({
        id: row.id,
        hostname: row.hostname || 'Unknown',
        ipAddress: row.ipAddress,
        macAddress: row.macAddress,
        deviceType: row.deviceType || 'unknown',
        os: row.os || 'Unknown',
        stats: this.parseStatsField(row.stats, row.isActive),
        lastSeen: row.lastSeen ? new Date(row.lastSeen) : new Date(),
        firstDiscovered: row.firstDiscovered ? new Date(row.firstDiscovered) : new Date(),
      }));

      this.logger.log(`[REPOSITORY] ${devices.length} appareils actifs récupérés`);
      return devices;

    } catch (error) {
      this.logger.error(`[REPOSITORY] Erreur récupération appareils: ${error.message}`);
      throw new Error(`Impossible de récupérer les appareils: ${error.message}`);
    }
  }

  /**
   * Parse le champ stats en gérant les différents formats possibles
   */
  private parseStatsField(stats: any, isActive: boolean): any {
    try {
      // Si stats est déjà un objet (parsé par Sequelize)
      if (typeof stats === 'object' && stats !== null) {
        return stats;
      }
      
      // Si stats est une chaîne JSON
      if (typeof stats === 'string') {
        return JSON.parse(stats);
      }
      
      // Valeur par défaut si stats est null/undefined
      return {
        status: isActive ? 'active' : 'inactive',
        cpu: 0,
        memory: 0,
        bandwidth: { download: 0, upload: 0 },
        latency: 0,
        uptime: '0',
        services: [],
      };
    } catch (error) {
      this.logger.warn(`[REPOSITORY] Erreur parsing stats: ${error.message}, utilisation des valeurs par défaut`);
      return {
        status: isActive ? 'active' : 'inactive',
        cpu: 0,
        memory: 0,
        bandwidth: { download: 0, upload: 0 },
        latency: 0,
        uptime: '0',
        services: [],
      };
    }
  }

  /**
   * Récupère les appareils par type
   */
  async getDevicesByType(deviceType: string): Promise<Device[]> {
    try {
      const [results] = await sequelize.query(`
        SELECT 
          id,
          hostname,
          ipAddress,
          macAddress,
          deviceType,
          os,
          stats,
          lastSeen,
          firstDiscovered,
          isActive
        FROM appareils 
        WHERE deviceType = :deviceType 
        AND isActive = 1
        ORDER BY lastSeen DESC
      `, {
        replacements: { deviceType },
        type: QueryTypes.SELECT,
      });

      return (Array.isArray(results) ? results : []).map((row: any) => ({
        id: row.id,
        hostname: row.hostname || 'Unknown',
        ipAddress: row.ipAddress,
        macAddress: row.macAddress,
        deviceType: row.deviceType,
        os: row.os || 'Unknown',
        stats: this.parseStatsField(row.stats, row.isActive),
        lastSeen: row.lastSeen ? new Date(row.lastSeen) : new Date(),
        firstDiscovered: row.firstDiscovered ? new Date(row.firstDiscovered) : new Date(),
      }));
    } catch (error) {
      this.logger.error(`[REPOSITORY] Erreur récupération appareils par type: ${error.message}`);
      return [];
    }
  }

  /**
   * Récupère les appareils dans un sous-réseau
   */
  async getDevicesInSubnet(subnet: string): Promise<Device[]> {
    try {
      const [results] = await sequelize.query(`
        SELECT 
          id,
          hostname,
          ipAddress,
          macAddress,
          deviceType,
          os,
          stats,
          lastSeen,
          firstDiscovered,
          isActive
        FROM appareils 
        WHERE ipAddress LIKE :subnetPattern
        AND isActive = 1
        ORDER BY deviceType DESC, lastSeen DESC
      `, {
        replacements: { subnetPattern: `${subnet}%` },
        type: QueryTypes.SELECT,
      });

      return (Array.isArray(results) ? results : []).map((row: any) => ({
        id: row.id,
        hostname: row.hostname || 'Unknown',
        ipAddress: row.ipAddress,
        macAddress: row.macAddress,
        deviceType: row.deviceType,
        os: row.os || 'Unknown',
        stats: this.parseStatsField(row.stats, row.isActive),
        lastSeen: row.lastSeen ? new Date(row.lastSeen) : new Date(),
        firstDiscovered: row.firstDiscovered ? new Date(row.firstDiscovered) : new Date(),
      }));

    } catch (error) {
      this.logger.error(`[REPOSITORY] Erreur récupération appareils par sous-réseau: ${error.message}`);
      throw new Error(`Impossible de récupérer les appareils du sous-réseau ${subnet}: ${error.message}`);
    }
  }

  /**
   * Vérifie si un appareil existe et est actif
   */
  async isDeviceActive(deviceId: string): Promise<boolean> {
    try {
      const [results] = await sequelize.query(`
        SELECT COUNT(*) as count
        FROM appareils 
        WHERE id = :deviceId 
        AND isActive = 1
        AND lastSeen > DATE_SUB(NOW(), INTERVAL 7 DAY)
      `, {
        replacements: { deviceId },
        type: QueryTypes.SELECT,
      });

      return (results && results[0] && results[0].count) ? results[0].count > 0 : false;

    } catch (error) {
      this.logger.error(`[REPOSITORY] Erreur vérification appareil actif: ${error.message}`);
      return false;
    }
  }

  /**
   * Obtient les statistiques des appareils
   */
  async getDeviceStats(): Promise<{
    total: number;
    active: number;
    byType: Record<string, number>;
    bySubnet: Record<string, number>;
  }> {
    try {
      const [totalResults] = await sequelize.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active
        FROM appareils
      `);

      const [typeResults] = await sequelize.query(`
        SELECT 
          deviceType,
          COUNT(*) as count
        FROM appareils 
        WHERE isActive = 1
        GROUP BY deviceType
      `);

      const [subnetResults] = await sequelize.query(`
        SELECT 
          SUBSTRING_INDEX(ipAddress, '.', 3) as subnet,
          COUNT(*) as count
        FROM appareils 
        WHERE isActive = 1
        GROUP BY SUBSTRING_INDEX(ipAddress, '.', 3)
      `);

      return {
        total: (totalResults && Array.isArray(totalResults) && totalResults[0] && (totalResults[0] as any).total) ? Number((totalResults[0] as any).total) : 0,
        active: (totalResults && Array.isArray(totalResults) && totalResults[0] && (totalResults[0] as any).active) ? Number((totalResults[0] as any).active) : 0,
        byType: (Array.isArray(typeResults) ? typeResults : []).reduce<Record<string, number>>((acc: Record<string, number>, row: any) => {
          acc[row.deviceType] = Number(row.count);
          return acc;
        }, {} as Record<string, number>),
        bySubnet: (Array.isArray(subnetResults) ? subnetResults : []).reduce<Record<string, number>>((acc: Record<string, number>, row: any) => {
          acc[row.subnet] = Number(row.count);
          return acc;
        }, {} as Record<string, number>),
      };

    } catch (error) {
      this.logger.error(`[REPOSITORY] Erreur récupération statistiques: ${error.message}`);
      return {
        total: 0,
        active: 0,
        byType: {},
        bySubnet: {},
      };
    }
  }
} 
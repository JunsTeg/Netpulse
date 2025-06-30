import { Injectable, Logger } from "@nestjs/common"
import { v4 as uuidv4 } from "uuid"
import { Device, DeviceStatus } from "./device.model"
import { QueryTypes } from "sequelize"
import { sequelize } from "../../database"

@Injectable()
export class AppareilRepository {
  private readonly logger = new Logger(AppareilRepository.name)

  /**
   * Upsert (insert ou update) un appareil dans la table appareils
   */
  async upsertDevice(device: Device): Promise<string | null> {
    try {
      // 1. Détection d'unicité : priorité MAC, sinon IP+hostname
      let existing: { id: string }[] = []
      if (device.macAddress && device.macAddress.trim() !== "") {
        existing = await sequelize.query<{ id: string }>(
          `SELECT id FROM appareils WHERE macAddress = :mac LIMIT 1`,
          {
            replacements: { mac: device.macAddress },
            type: QueryTypes.SELECT,
          }
        )
      }
      if ((!existing || existing.length === 0) && device.ipAddress && device.hostname) {
        existing = await sequelize.query<{ id: string }>(
          `SELECT id FROM appareils WHERE ipAddress = :ip AND hostname = :hostname LIMIT 1`,
          {
            replacements: { ip: device.ipAddress, hostname: device.hostname },
            type: QueryTypes.SELECT,
          }
        )
      }

      // 2. Toujours garantir la cohérence des champs
      if (!device.stats || typeof device.stats !== 'object') {
        device.stats = { cpu: 0, memory: 0, uptime: "0", status: DeviceStatus.INACTIVE, services: [] }
        this.logger.warn(`[UPSERT] stats manquant ou invalide pour ${device.ipAddress}, valeur par défaut appliquée`)
      }
      if (!(Array.isArray((device as any).sources))) {
        (device as any).sources = [(device as any).source || "inconnu"]
      }

      let id: string
      if (existing && existing.length > 0) {
        id = existing[0].id
        await sequelize.query(
          `UPDATE appareils SET
            hostname = :hostname,
            macAddress = :macAddress,
            os = :os,
            deviceType = :deviceType,
            stats = :stats,
            lastSeen = :lastSeen,
            isActive = TRUE
          WHERE id = :id`,
          {
            replacements: {
              id,
              hostname: device.hostname,
              macAddress: device.macAddress,
              os: device.os,
              deviceType: device.deviceType,
              stats: JSON.stringify(device.stats),
              lastSeen: device.lastSeen,
            },
            type: QueryTypes.UPDATE,
          }
        )
        this.logger.debug(`[UPSERT] Appareil mis à jour (fusion): ${device.ipAddress} / ${device.macAddress}`)
      } else {
        id = device.id || uuidv4()
        await sequelize.query(
          `INSERT INTO appareils (
            id, hostname, ipAddress, macAddress, os, deviceType, stats, lastSeen, firstDiscovered, isActive
          ) VALUES (
            :id, :hostname, :ipAddress, :macAddress, :os, :deviceType, :stats, :lastSeen, :firstDiscovered, TRUE
          )`,
          {
            replacements: {
              id,
              hostname: device.hostname,
              ipAddress: device.ipAddress,
              macAddress: device.macAddress,
              os: device.os,
              deviceType: device.deviceType,
              stats: JSON.stringify(device.stats),
              lastSeen: device.lastSeen,
              firstDiscovered: device.firstDiscovered || new Date(),
            },
            type: QueryTypes.INSERT,
          }
        )
        this.logger.debug(`[UPSERT] Nouvel appareil inséré: ${device.ipAddress} / ${device.macAddress}`)
      }

      // Détection automatique d'anomalies (CPU, RAM, latence, etc.)
      try {
        const { cpu, memory, latency } = device.stats || {}
        let anomalyType = null
        let severity = null
        let description = ''
        if (cpu > 90) {
          anomalyType = 'CPU_HIGH'
          severity = 'critical'
          description = `CPU élevé (${cpu}%)`
        } else if (memory > 90) {
          anomalyType = 'MEMORY_HIGH'
          severity = 'critical'
          description = `Mémoire élevée (${memory}%)`
        } else if (latency && latency > 200) {
          anomalyType = 'LATENCY_HIGH'
          severity = 'warning'
          description = `Latence élevée (${latency} ms)`
        }
        if (anomalyType) {
          const anomalyId = uuidv4()
          await sequelize.query(
            `INSERT INTO anomalies (id, deviceId, severity, description, anomalyType, detectedAt, isConfirmed) VALUES (:id, :deviceId, :severity, :description, :anomalyType, NOW(), FALSE)`,
            {
              replacements: {
                id: anomalyId,
                deviceId: id,
                severity,
                description,
                anomalyType,
              },
              type: QueryTypes.INSERT,
            }
          )
          await sequelize.query(
            `INSERT INTO alertes (id, anomalyId, status, priority, triggeredAt, notified) VALUES (:id, :anomalyId, 'active', :priority, NOW(), FALSE)`,
            {
              replacements: {
                id: uuidv4(),
                anomalyId,
                priority: severity === 'critical' ? 'high' : 'medium',
              },
              type: QueryTypes.INSERT,
            }
          )
          this.logger.warn(`[ANOMALY] ${description} sur appareil ${device.hostname || device.ipAddress}`)
        }
      } catch (err) {
        this.logger.error(`[ANOMALY] Erreur détection/insert anomalie: ${err.message}`)
      }

      return id
    } catch (error) {
      this.logger.error(`[UPSERT] Erreur upsert appareil: ${error.message}`)
      return null
    }
  }

  /**
   * Désactive tous les appareils qui ne sont pas dans la liste des IDs détectés
   */
  async disableMissingDevices(detectedIds: string[]): Promise<void> {
    try {
      if (!Array.isArray(detectedIds) || detectedIds.length === 0) {
        this.logger.warn('[DISABLE] Liste des IDs détectés vide, aucune désactivation effectuée.')
        return
      }
      await sequelize.query(
        `UPDATE appareils SET isActive = FALSE WHERE id NOT IN (:ids)`,
        {
          replacements: { ids: detectedIds },
          type: QueryTypes.UPDATE,
        }
      )
      this.logger.log(`[DISABLE] Appareils non détectés désactivés (isActive=FALSE).`)
    } catch (error) {
      this.logger.error(`[DISABLE] Erreur lors de la désactivation des appareils: ${error.message}`)
    }
  }

  async findAllDevices(): Promise<Device[]> {
    try {
      this.logger.log('[FIND ALL] Début de la récupération des appareils actifs')
      
      const results = await sequelize.query<any>(
        `SELECT * FROM appareils`,
        { type: QueryTypes.SELECT }
      )
      
      this.logger.log(`[FIND ALL] ${results.length} appareils actifs trouvés dans la base de données`)
      
      const devices = results.map(d => ({
        ...d,
        stats: (() => {
          try {
            if (typeof d.stats === 'string') return JSON.parse(d.stats)
            if (typeof d.stats === 'object' && d.stats !== null) return d.stats
            return { cpu: 0, memory: 0, uptime: "0", status: "inactive", services: [] }
          } catch {
            return { cpu: 0, memory: 0, uptime: "0", status: "inactive", services: [] }
          }
        })(),
        sources: d.sources ? (Array.isArray(d.sources) ? d.sources : [d.sources]) : ["inconnu"],
        lastSeen: d.lastSeen ? new Date(d.lastSeen) : new Date(),
        firstDiscovered: d.firstDiscovered ? new Date(d.firstDiscovered) : new Date(),
      }) as Device)
      
      this.logger.log(`[FIND ALL] ${devices.length} appareils traités et retournés`)
      return devices
    } catch (error) {
      this.logger.error(`[FIND ALL] Erreur récupération appareils: ${error.message}`)
      return []
    }
  }

  /**
   * Méthode de débogage pour récupérer tous les appareils (actifs et inactifs)
   */
  async findAllDevicesDebug(): Promise<{ active: Device[], inactive: Device[], total: number }> {
    try {
      this.logger.log('[FIND ALL DEBUG] Début de la récupération de tous les appareils')
      
      const allResults = await sequelize.query<any>(
        `SELECT *, isActive FROM appareils ORDER BY lastSeen DESC`,
        { type: QueryTypes.SELECT }
      )
      
      this.logger.log(`[FIND ALL DEBUG] ${allResults.length} appareils totaux trouvés dans la base de données`)
      
      const activeDevices = allResults.filter(d => d.isActive === true || d.isActive === 1)
      const inactiveDevices = allResults.filter(d => d.isActive === false || d.isActive === 0)
      
      this.logger.log(`[FIND ALL DEBUG] ${activeDevices.length} appareils actifs, ${inactiveDevices.length} appareils inactifs`)
      
      const processDevice = (d: any): Device => ({
        ...d,
        stats: (() => {
          try {
            if (typeof d.stats === 'string') return JSON.parse(d.stats)
            if (typeof d.stats === 'object' && d.stats !== null) return d.stats
            return { cpu: 0, memory: 0, uptime: "0", status: "inactive", services: [] }
          } catch {
            return { cpu: 0, memory: 0, uptime: "0", status: "inactive", services: [] }
          }
        })(),
        sources: d.sources ? (Array.isArray(d.sources) ? d.sources : [d.sources]) : ["inconnu"],
        lastSeen: d.lastSeen ? new Date(d.lastSeen) : new Date(),
        firstDiscovered: d.firstDiscovered ? new Date(d.firstDiscovered) : new Date(),
      }) as Device
      
      return {
        active: activeDevices.map(processDevice),
        inactive: inactiveDevices.map(processDevice),
        total: allResults.length
      }
    } catch (error) {
      this.logger.error(`[FIND ALL DEBUG] Erreur récupération appareils: ${error.message}`)
      return { active: [], inactive: [], total: 0 }
    }
  }
} 
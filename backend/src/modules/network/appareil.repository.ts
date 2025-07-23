import { Injectable, Logger } from "@nestjs/common"
import { v4 as uuidv4 } from "uuid"
import { Device, DeviceStatus, DeviceType } from "./device.model"
import { QueryTypes } from "sequelize"
import { sequelize } from "../../database"
// Supprimer toute référence à loadOuiDatabase ou ouiDb
import * as path from "path"

@Injectable()
export class AppareilRepository {
  private readonly logger = new Logger(AppareilRepository.name)

  /**
   * Upsert (insert ou update) un appareil dans la table appareils
   */
  async upsertDevice(device: Device): Promise<string | null> {
    try {
      // Suppression du fallback OUI enrichi
      // 1. Vérification d'existence par (ipAddress, hostname) d'abord
      let existing: { id: string, hostname: string, macAddress: string, os: string, deviceType: string, stats: string, lastSeen: Date }[] = []
      if (device.ipAddress && device.hostname) {
        existing = await sequelize.query<{ id: string, hostname: string, macAddress: string, os: string, deviceType: string, stats: string, lastSeen: Date }>(
          `SELECT * FROM appareils WHERE ipAddress = :ip AND hostname = :hostname LIMIT 1`,
          {
            replacements: { ip: device.ipAddress, hostname: device.hostname },
            type: QueryTypes.SELECT,
          }
        )
      }
      // Si non trouvé, on insérera

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
        // Fusion intelligente : ne pas écraser les champs non vides par des valeurs vides ou génériques, toujours garder la valeur la plus complète
        function bestValue(a: any, b: any) {
          if (a && b) {
            if (typeof a === 'string' && typeof b === 'string') {
              // Prendre la plus longue (plus descriptive)
              return b.length > a.length ? b : a
            }
            if (typeof a === 'object' && typeof b === 'object') {
              // Prendre l'objet le plus riche
              return Object.keys(b).length > Object.keys(a).length ? b : a
            }
            // Sinon, garder la valeur non vide la plus "riche"
            return b || a
          }
          return a || b
        }
        const mergedStats = bestValue(
          typeof existing[0].stats === 'string' ? JSON.parse(existing[0].stats) : existing[0].stats,
          typeof device.stats === 'string' ? JSON.parse(device.stats) : device.stats
        )
        const merged = {
          hostname: bestValue(existing[0].hostname, device.hostname),
          macAddress: bestValue(existing[0].macAddress, device.macAddress),
          os: bestValue(existing[0].os, device.os),
          deviceType: bestValue(existing[0].deviceType, device.deviceType),
          stats: JSON.stringify(mergedStats),
          lastSeen: device.lastSeen || existing[0].lastSeen,
          // Champs SQL synchronisés
          cpuUsage: mergedStats.cpu ?? null,
          memoryUsage: mergedStats.memory ?? null,
          bandwidthDownload: mergedStats.bandwidth?.download ?? null,
          bandwidthUpload: mergedStats.bandwidth?.upload ?? null,
          status: mergedStats.status ?? null,
        }
        await sequelize.query(
          `UPDATE appareils SET
            hostname = :hostname,
            macAddress = :macAddress,
            os = :os,
            deviceType = :deviceType,
            stats = :stats,
            lastSeen = :lastSeen,
            cpuUsage = :cpuUsage,
            memoryUsage = :memoryUsage,
            bandwidthDownload = :bandwidthDownload,
            bandwidthUpload = :bandwidthUpload,
            status = :status,
            isActive = TRUE
          WHERE id = :id`,
          {
            replacements: {
              id,
              ...merged,
            },
            type: QueryTypes.UPDATE,
          }
        )
        this.logger.debug(`[UPSERT] Appareil mis à jour (fusion avancée): ${device.ipAddress} / ${device.macAddress}`)
      } else {
        id = device.id || uuidv4()
        // Champs SQL synchronisés
        const cpuUsage = device.stats?.cpu ?? null
        const memoryUsage = device.stats?.memory ?? null
        const bandwidthDownload = device.stats?.bandwidth?.download ?? null
        const bandwidthUpload = device.stats?.bandwidth?.upload ?? null
        const status = device.stats?.status ?? null
        await sequelize.query(
          `INSERT INTO appareils (
            id, hostname, ipAddress, macAddress, os, deviceType, stats, lastSeen, firstDiscovered, isActive,
            cpuUsage, memoryUsage, bandwidthDownload, bandwidthUpload, status
          ) VALUES (
            :id, :hostname, :ipAddress, :macAddress, :os, :deviceType, :stats, :lastSeen, :firstDiscovered, TRUE,
            :cpuUsage, :memoryUsage, :bandwidthDownload, :bandwidthUpload, :status
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
              cpuUsage,
              memoryUsage,
              bandwidthDownload,
              bandwidthUpload,
              status,
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
   * Upsert (insert ou update) en batch pour plusieurs appareils
   */
  async upsertMany(devices: Device[], batchSize = 200): Promise<string[]> {
    // --- PATCH: Générer un id pour chaque device si absent ---
    for (const device of devices) {
      if (!device.id) device.id = uuidv4()
    }
    const insertedIds: string[] = []
    if (!Array.isArray(devices) || devices.length === 0) return insertedIds
    try {
      // Découpage en batchs si trop d'appareils
      for (let i = 0; i < devices.length; i += batchSize) {
        const batch = devices.slice(i, i + batchSize)
        // Préparation des valeurs et des champs
        const values = batch.map(device => {
          // Valeurs par défaut et nettoyage
          if (!device.stats || typeof device.stats !== 'object') {
            device.stats = { cpu: 0, memory: 0, uptime: "0", status: DeviceStatus.INACTIVE, services: [] }
          }
          // Synchronisation des champs SQL
          const cpuUsage = device.stats?.cpu ?? null
          const memoryUsage = device.stats?.memory ?? null
          const bandwidthDownload = device.stats?.bandwidth?.download ?? null
          const bandwidthUpload = device.stats?.bandwidth?.upload ?? null
          const status = device.stats?.status ?? null
          return `('${device.id}',
            ${sequelize.escape(device.hostname)},
            ${sequelize.escape(device.ipAddress)},
            ${sequelize.escape(device.macAddress)},
            ${sequelize.escape(device.os)},
            ${sequelize.escape(device.deviceType)},
            ${sequelize.escape(JSON.stringify(device.stats))},
            ${sequelize.escape(device.lastSeen)},
            ${sequelize.escape(device.firstDiscovered || new Date())},
            TRUE,
            ${cpuUsage !== null ? sequelize.escape(cpuUsage) : 'NULL'},
            ${memoryUsage !== null ? sequelize.escape(memoryUsage) : 'NULL'},
            ${bandwidthDownload !== null ? sequelize.escape(bandwidthDownload) : 'NULL'},
            ${bandwidthUpload !== null ? sequelize.escape(bandwidthUpload) : 'NULL'},
            ${status !== null ? sequelize.escape(status) : 'NULL'})`
        }).join(',\n')
        // Construction de la requête
        const sql = `INSERT INTO appareils
          (id, hostname, ipAddress, macAddress, os, deviceType, stats, lastSeen, firstDiscovered, isActive,
           cpuUsage, memoryUsage, bandwidthDownload, bandwidthUpload, status)
          VALUES ${values}
          ON DUPLICATE KEY UPDATE
            hostname = VALUES(hostname),
            macAddress = VALUES(macAddress),
            os = VALUES(os),
            deviceType = VALUES(deviceType),
            stats = VALUES(stats),
            lastSeen = VALUES(lastSeen),
            isActive = TRUE,
            cpuUsage = VALUES(cpuUsage),
            memoryUsage = VALUES(memoryUsage),
            bandwidthDownload = VALUES(bandwidthDownload),
            bandwidthUpload = VALUES(bandwidthUpload),
            status = VALUES(status)`;
        await sequelize.query(sql, { type: QueryTypes.INSERT })
        // --- PATCH: Après insertion, récupérer les ids réels depuis la base ---
        const batchIds = await Promise.all(batch.map(async d => {
          const rows = await sequelize.query<{id: string}>(
            `SELECT id FROM appareils WHERE ipAddress = :ip AND hostname = :hostname LIMIT 1`,
            { replacements: { ip: d.ipAddress, hostname: d.hostname }, type: QueryTypes.SELECT }
          )
          return rows[0]?.id || d.id
        }))
        insertedIds.push(...batchIds)
        this.logger.log(`[BATCH UPSERT] ${batch.length} appareils insérés/mis à jour.`)
      }
      return insertedIds
    } catch (error) {
      this.logger.error(`[BATCH UPSERT] Erreur batch upsert: ${error.message}`)
      return insertedIds
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
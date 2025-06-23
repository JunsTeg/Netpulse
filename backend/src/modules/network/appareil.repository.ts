import { Injectable, Logger } from "@nestjs/common"
import { v4 as uuidv4 } from "uuid"
import { Device } from "./device.model"
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
      const existing = await sequelize.query<{ id: string }>(
        `SELECT id FROM appareils WHERE ipAddress = :ip OR macAddress = :mac LIMIT 1`,
        {
          replacements: { ip: device.ipAddress, mac: device.macAddress },
          type: QueryTypes.SELECT,
        }
      )

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
            lastSeen = :lastSeen
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
        this.logger.debug(`[UPSERT] Appareil mis à jour: ${device.ipAddress}`)
      } else {
        id = device.id || uuidv4()
        await sequelize.query(
          `INSERT INTO appareils (
            id, hostname, ipAddress, macAddress, os, deviceType, stats, lastSeen, firstDiscovered
          ) VALUES (
            :id, :hostname, :ipAddress, :macAddress, :os, :deviceType, :stats, :lastSeen, :firstDiscovered
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
        this.logger.debug(`[UPSERT] Nouvel appareil inséré: ${device.ipAddress}`)
      }
      return id
    } catch (error) {
      this.logger.error(`[UPSERT] Erreur upsert appareil: ${error.message}`)
      return null
    }
  }

  async findAllDevices(): Promise<Device[]> {
    try {
      const results = await sequelize.query<any>(
        `SELECT * FROM appareils`,
        { type: QueryTypes.SELECT }
      )
      return results.map(d => ({
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
    } catch (error) {
      this.logger.error(`[FIND ALL] Erreur récupération appareils: ${error.message}`)
      return []
    }
  }
} 
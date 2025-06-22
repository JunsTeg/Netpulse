import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import type { NetworkService } from "./network.service"
import type { NetworkGateway } from "./network.gateway"
import type { Device } from "./device.model"

@Injectable()
export class NetworkDetectorService {
  private readonly logger = new Logger(NetworkDetectorService.name)
  private devices: Map<string, Device> = new Map()
  private isScanning = false

  constructor(
    private readonly networkService: NetworkService,
    private readonly networkGateway: NetworkGateway,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async performPeriodicScan() {
    if (this.isScanning) {
      this.logger.debug("[DETECTOR] Scan déjà en cours, ignoré")
      return
    }

    try {
      this.isScanning = true
      this.logger.log("[DETECTOR] Démarrage scan périodique")

      const result = await this.networkService.scanNetwork("192.168.1.0/24")

      if (result.success) {
        await this.processDeviceChanges(result.devices)
      }
    } catch (error) {
      this.logger.error(`[DETECTOR] Erreur scan périodique: ${error.message}`)
    } finally {
      this.isScanning = false
    }
  }

  private async processDeviceChanges(newDevices: Device[]) {
    const changes = {
      added: [] as Device[],
      updated: [] as Device[],
      removed: [] as Device[],
    }

    // Détection des nouveaux appareils et mises à jour
    for (const device of newDevices) {
      const existing = this.devices.get(device.ipAddress)

      if (!existing) {
        changes.added.push(device)
        this.devices.set(device.ipAddress, device)
      } else if (this.hasDeviceChanged(existing, device)) {
        changes.updated.push(device)
        this.devices.set(device.ipAddress, device)
      }
    }

    // Détection des appareils supprimés
    const currentIPs = new Set(newDevices.map((d) => d.ipAddress))
    for (const [ip, device] of this.devices) {
      if (!currentIPs.has(ip)) {
        changes.removed.push(device)
        this.devices.delete(ip)
      }
    }

    // Notification des changements
    if (changes.added.length > 0 || changes.updated.length > 0 || changes.removed.length > 0) {
      this.logger.log(
        `[DETECTOR] Changements détectés: +${changes.added.length} ~${changes.updated.length} -${changes.removed.length}`,
      )
      this.networkGateway.broadcastDeviceChanges(changes)
    }
  }

  private hasDeviceChanged(oldDevice: Device, newDevice: Device): boolean {
    return (
      oldDevice.stats.status !== newDevice.stats.status ||
      oldDevice.stats.services.length !== newDevice.stats.services.length ||
      oldDevice.os !== newDevice.os
    )
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values())
  }

  getDevice(ipAddress: string): Device | undefined {
    return this.devices.get(ipAddress)
  }
}

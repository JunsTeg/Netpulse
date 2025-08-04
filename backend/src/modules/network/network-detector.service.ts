import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { NetworkService } from "./network.service"
import { EnhancedNetworkService } from "./enhanced-network.service"
import { NetworkGateway } from "./network.gateway"
import type { Device } from "./device.model"
import * as os from "os"

@Injectable()
export class NetworkDetectorService {
  private readonly logger = new Logger(NetworkDetectorService.name)
  private devices: Map<string, Device> = new Map()
  private isScanning = false
  private lastScanMethod = "nmap" // Historique de la méthode utilisée

  constructor(
    private readonly networkService: NetworkService,
    private readonly enhancedNetworkService: EnhancedNetworkService,
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
      this.logger.log("[DETECTOR] Démarrage scan périodique automatique amélioré")

      // Détection automatique du réseau actif
      const activeNetwork = await this.detectActiveNetwork()
      if (!activeNetwork || activeNetwork.length === 0) {
        this.logger.warn("[DETECTOR] Aucun réseau actif détecté, utilisation du réseau par défaut")
        const result = await this.executeEnhancedScan("192.168.1.0/24")
        if (result.success) {
          await this.processDeviceChanges(result.devices)
        }
        return
      }

      // Prendre le premier réseau actif détecté
      const selectedNetwork = activeNetwork[0]

      // Exécution du scan amélioré
      const result = await this.executeEnhancedScan(selectedNetwork.cidr)

      if (result.success) {
        this.logger.log(`[DETECTOR] Scan ${result.scanMethod} terminé: ${result.devices.length} appareils trouvés en ${result.scanDuration}ms`)
        await this.processDeviceChanges(result.devices)
      } else {
        this.logger.error(`[DETECTOR] Échec du scan amélioré: ${result.error}`)
        // Fallback vers le scan Nmap basique
        await this.executeFallbackScan(selectedNetwork.cidr)
      }
    } catch (error) {
      this.logger.error(`[DETECTOR] Erreur scan périodique: ${error.message}`)
      // Fallback vers le scan Nmap basique en cas d'erreur
      try {
        await this.executeFallbackScan("192.168.1.0/24")
      } catch (fallbackError) {
        this.logger.error(`[DETECTOR] Échec du fallback: ${fallbackError.message}`)
      }
    } finally {
      this.isScanning = false
    }
  }

  private async executeEnhancedScan(target: string) {
    try {
      // Configuration du scan amélioré avec sélection automatique de la méthode
      const config = {
        target,
        scanMethod: "auto" as const, // Sélection intelligente
        deepScan: true, // Mode approfondi pour le scan automatique
        stealth: false, // Pas de mode furtif pour la surveillance continue
        threads: 100, // Nombre de threads optimisé
        osDetection: true,
        serviceDetection: true,
        timing: 4,
      }

      this.logger.log(`[DETECTOR] Exécution scan amélioré sur ${target}`)
      const result = await this.enhancedNetworkService.executeEnhancedScan(config, "system-auto-scan")
      
      // Mise à jour de la méthode utilisée
      this.lastScanMethod = result.scanMethod
      
      return result
    } catch (error) {
      this.logger.error(`[DETECTOR] Erreur scan amélioré: ${error.message}`)
      return {
        success: false,
        devices: [],
        error: error.message,
        scanMethod: "error",
        scanDuration: 0,
        statistics: {
          totalDevices: 0,
          activeDevices: 0,
          vulnerableDevices: 0,
          averageResponseTime: 0,
          osDistribution: {},
          deviceTypes: {},
          topPorts: {},
        }
      }
    }
  }

  private async executeFallbackScan(target: string) {
    this.logger.log(`[DETECTOR] Exécution scan de fallback (Nmap) sur ${target}`)
    const result = await this.networkService.scanNetwork(target, "system-auto-scan")
    if (result.success) {
      await this.processDeviceChanges(result.devices)
    }
    this.lastScanMethod = "nmap-fallback"
  }

  private async detectActiveNetwork() {
    try {
      const interfaces = os.networkInterfaces()
      const wifiOrEthRegex = /wi[-]?fi|wlan|ethernet|en|eth/i
      const candidates = []

      // 1. Filtrer toutes les interfaces physiques IPv4
      for (const [name, nets] of Object.entries(interfaces)) {
        if (!nets) continue
        if (!wifiOrEthRegex.test(name)) continue
        
        for (const net of nets) {
          if (net.family === 'IPv4' && !net.internal && net.address) {
            // Exclusion des plages privées spécifiques
            const ip = net.address
            if (
              ip.startsWith('10.') ||
              (ip.startsWith('172.') && (() => {
                const second = parseInt(ip.split('.')[1], 10)
                return second >= 16 && second <= 31
              })())
            ) {
              continue
            }
            
            const ipParts = ip.split('.')
            const networkPrefix = ipParts.slice(0, 3).join('.')
            const cidr = `${networkPrefix}.0/24`
            candidates.push({
              interface: name,
              localIP: net.address,
              netmask: net.netmask,
              cidr,
              gateway: `${networkPrefix}.1`
            })
          }
        }
      }

      // 2. Tester la gateway de chaque interface (ping)
      const activeNetworks = []
      const exec = require('child_process').exec
      const pingGateway = (gateway) => new Promise(resolve => {
        exec(process.platform === 'win32' ? `ping -n 1 -w 1000 ${gateway}` : `ping -c 1 -W 1 ${gateway}`,
          (err, stdout) => {
            if (stdout && stdout.toLowerCase().includes('ttl')) resolve(true)
            else resolve(false)
          })
      })

      for (const net of candidates) {
        const reachable = await pingGateway(net.gateway)
        if (reachable) activeNetworks.push(net)
      }

      // Retourner le premier réseau actif trouvé (cohérent avec l'utilisation)
      if (activeNetworks.length === 0) {
        this.logger.warn('[DETECTOR] Aucune interface physique active détectée (gateway non joignable)')
        return null
      }
      
      this.logger.log(`[DETECTOR] Réseau actif détecté: ${activeNetworks[0].cidr} (${activeNetworks[0].interface})`)
      return activeNetworks  // Retourner le tableau complet
    } catch (error) {
      this.logger.error(`[DETECTOR] Erreur détection réseau actif: ${error.message}`)
      return null
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

    // Notification des changements avec informations sur la méthode utilisée
    if (changes.added.length > 0 || changes.updated.length > 0 || changes.removed.length > 0) {
      this.logger.log(
        `[DETECTOR] Changements détectés (${this.lastScanMethod}): +${changes.added.length} ~${changes.updated.length} -${changes.removed.length}`,
      )
      this.networkGateway.broadcastDeviceChanges(changes)
    }
  }

  private hasDeviceChanged(oldDevice: Device, newDevice: Device): boolean {
    return (
      oldDevice.stats.status !== newDevice.stats.status ||
      oldDevice.stats.services.length !== newDevice.stats.services.length ||
      oldDevice.os !== newDevice.os ||
      oldDevice.deviceType !== newDevice.deviceType ||
      oldDevice.macAddress !== newDevice.macAddress
    )
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values())
  }

  getDevice(ipAddress: string): Device | undefined {
    return this.devices.get(ipAddress)
  }

  getLastScanMethod(): string {
    return this.lastScanMethod
  }

  isScanningActive(): boolean {
    return this.isScanning
  }

  getScanStatus(): {
    isScanning: boolean
    lastMethod: string
    devicesCount: number
    lastUpdate: Date | null
  } {
    const devices = Array.from(this.devices.values())
    return {
      isScanning: this.isScanning,
      lastMethod: this.lastScanMethod,
      devicesCount: devices.length,
      lastUpdate: devices.length > 0 ? new Date(Math.max(...devices.map(d => d.lastSeen.getTime()))) : null,
    }
  }
}

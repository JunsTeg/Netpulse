import { Controller, Get, Post, UseGuards, Logger, HttpException, HttpStatus, Body, Req, Headers } from "@nestjs/common"
import { NetworkService } from "./network.service"
import { NetworkDetectorService } from "./network-detector.service"
import { RouterQueryService } from "./agents/router-query.service"
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard"
import type { RequestWithUser } from "../../auth/auth.types"
import * as os from "os"
import { AppareilRepository } from "./appareil.repository"
import { NmapAgentService } from "./agents/nmap.service"

interface ScanConfigDto {
  target: string
  ports?: string
  osDetection?: boolean
  serviceDetection?: boolean
  timing?: number
  sudo?: boolean
  quick?: boolean
}

@Controller("network")
@UseGuards(JwtAuthGuard)
export class NetworkController {
  private readonly logger = new Logger(NetworkController.name)

  constructor(
    private readonly networkService: NetworkService,
    private readonly networkDetector: NetworkDetectorService,
    private readonly routerQuery: RouterQueryService,
    private readonly appareilRepository: AppareilRepository,
    private readonly nmapAgentService: NmapAgentService,
  ) {}

  @Get("detect")
  async detectNetwork(@Req() req: RequestWithUser) {
    try {
      this.logger.log(`[CONTROLLER] Détection automatique du réseau demandée par l'utilisateur ${req.user?.id || 'inconnu'}`)
      
      // Détection automatique du réseau local
      const networkInfo = await this.detectActiveNetwork()
      
      return {
        success: true,
        network: networkInfo,
        message: "Réseaux détectés avec succès"
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur détection réseaux: ${error.message}`)
      throw new HttpException(`Erreur lors de la détection des réseaux: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post("scan")
  async scanNetwork(@Body() config: ScanConfigDto, @Req() req: RequestWithUser) {
    try {
      // Vérification de l'authentification
      if (!req.user || !req.user.id) {
        this.logger.error("[CONTROLLER] Utilisateur non authentifié dans la requête")
        throw new HttpException("Utilisateur non authentifié", HttpStatus.UNAUTHORIZED)
      }

      const userId = req.user.id
      this.logger.log(`[CONTROLLER] Scan réseau demandé par l'utilisateur ${userId}`)

      const result = await this.networkService.scanNetwork(config.target, userId)

      return {
        success: result.success,
        data: result.devices,
        scanTime: result.scanTime,
        scanDuration: result.scanDuration,
        error: result.error,
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur scan: ${error.message}`)
      if (error instanceof HttpException) {
        throw error
      }
      throw new HttpException(`Erreur lors du scan réseau: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("devices")
  async getDevices(@Req() req: RequestWithUser) {
    try {
      this.logger.log(`[CONTROLLER] Récupération des appareils demandée par l'utilisateur ${req.user?.id || 'inconnu'}`)
      const devices = await this.appareilRepository.findAllDevices()
      // Ajout d'une information sur la méthode de détection (si disponible)
      const enriched = devices.map(d => ({
        ...d,
        sources: (d as any).sources || ["inconnu"],
        lastSeen: d.lastSeen,
      }))
      return {
        success: true,
        data: enriched,
        count: enriched.length,
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur récupération appareils: ${error.message}`)
      throw new HttpException("Erreur lors de la récupération des appareils", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("topology")
  async getTopology(@Req() req: RequestWithUser) {
    try {
      this.logger.log(`[CONTROLLER] Récupération de la topologie demandée par l'utilisateur ${req.user?.id || 'inconnu'}`)
      
      const devices = this.networkDetector.getDevices()
      const topology = await this.networkService.getNetworkTopology(devices)

      return {
        success: true,
        data: topology,
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur topologie: ${error.message}`)
      throw new HttpException("Erreur lors de la génération de la topologie", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("test-nmap")
  async testNmap(@Req() req: RequestWithUser) {
    try {
      if (!req.user || !req.user.id) {
        throw new HttpException("Utilisateur non authentifié", HttpStatus.UNAUTHORIZED)
      }

      this.logger.log(`[CONTROLLER] Test nmap demandé par l'utilisateur ${req.user.id}`)

      // Test de la commande nmap
      const { exec } = require("child_process")
      const { promisify } = require("util")
      const execAsync = promisify(exec)
      const os = require("os")

      // Test 1: Version nmap
      let nmapVersion = "Non disponible"
      try {
        const { stdout } = await execAsync("nmap --version")
        nmapVersion = stdout.split("\n")[0]
      } catch (error) {
        nmapVersion = `Erreur: ${error.message}`
      }

      // Test 2: Scan local
      let localScan = "Non disponible"
      try {
        const { stdout } = await execAsync("nmap -sn 127.0.0.1")
        localScan = stdout
      } catch (error) {
        localScan = `Erreur: ${error.message}`
      }

      // Test 3: Scan réseau local
      let networkScan = "Non disponible"
      try {
        const interfaces = os.networkInterfaces()
        let localNetwork = "192.168.1.0/24"
        
        for (const name of Object.keys(interfaces)) {
          const nets = interfaces[name]
          if (!nets) continue
          
          for (const iface of nets) {
            if (iface.family === "IPv4" && !iface.internal && iface.address) {
              const ipParts = iface.address.split(".")
              localNetwork = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/24`
              break
            }
          }
        }

        const { stdout } = await execAsync(`nmap -sn -T4 --max-retries 2 --host-timeout 10s ${localNetwork}`)
        networkScan = stdout
      } catch (error) {
        networkScan = `Erreur: ${error.message}`
      }

      return {
        success: true,
        nmapVersion,
        localScan: localScan.substring(0, 500) + "...",
        networkScan: networkScan.substring(0, 500) + "...",
        interfaces: os.networkInterfaces()
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur test nmap: ${error.message}`)
      throw new HttpException(`Erreur lors du test nmap: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("test-auth")
  async testAuth(@Req() req: RequestWithUser) {
    try {
      if (!req.user || !req.user.id) {
        this.logger.error("[CONTROLLER] Token invalide - utilisateur non authentifié")
        return {
          success: false,
          message: "Token invalide ou utilisateur non authentifié",
          user: req.user
        };
      }

      this.logger.log(`[CONTROLLER] Test auth réussi pour l'utilisateur ${req.user.id}`)
      return {
        success: true,
        message: "Token valide",
        user: req.user,
        userId: req.user.id,
        username: req.user.username
      };
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur test auth: ${error.message}`);
      return {
        success: false,
        message: `Erreur: ${error.message}`
      };
    }
  }

  @Get("router-devices")
  async getRouterDevices(@Req() req: RequestWithUser) {
    try {
      if (!req.user || !req.user.id) {
        throw new HttpException("Utilisateur non authentifié", HttpStatus.UNAUTHORIZED)
      }

      this.logger.log(`[CONTROLLER] Interrogation routeur demandée par l'utilisateur ${req.user.id}`)

      const startTime = Date.now()
      const devices = await this.routerQuery.getConnectedDevices()
      const duration = Date.now() - startTime

      return {
        success: true,
        data: devices,
        count: devices.length,
        scanDuration: duration,
        method: "Router Query (SNMP/ARP)",
        message: `Interrogation de l'équipement central terminée en ${duration}ms`
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur interrogation routeur: ${error.message}`)
      throw new HttpException(`Erreur lors de l'interrogation du routeur: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("comprehensive-scan")
  async comprehensiveScan(@Req() req: RequestWithUser) {
    try {
      if (!req.user || !req.user.id) {
        throw new HttpException("Utilisateur non authentifié", HttpStatus.UNAUTHORIZED)
      }

      this.logger.log(`[CONTROLLER] Scan complet demandé par l'utilisateur ${req.user.id}`)

      const startTime = Date.now()
      const results = {
        routerDevices: [],
        nmapDevices: [],
        combinedDevices: [],
        scanDuration: 0,
        methods: []
      }

      // 1. Interrogation du routeur (SNMP/ARP)
      try {
        this.logger.log(`[CONTROLLER] Démarrage interrogation routeur`)
        const routerStart = Date.now()
        results.routerDevices = await this.routerQuery.getConnectedDevices()
        const routerDuration = Date.now() - routerStart
        results.methods.push(`Router Query: ${results.routerDevices.length} appareils en ${routerDuration}ms`)
        this.logger.log(`[CONTROLLER] Routeur: ${results.routerDevices.length} appareils trouvés`)
      } catch (error) {
        this.logger.warn(`[CONTROLLER] Échec interrogation routeur: ${error.message}`)
        results.methods.push(`Router Query: Échec - ${error.message}`)
      }

      // 2. Scan nmap en parallèle
      try {
        this.logger.log(`[CONTROLLER] Démarrage scan nmap`)
        const nmapStart = Date.now()
        const networksInfo = await this.detectActiveNetwork()
        let nmapDevices: any[] = []
        for (const net of networksInfo) {
          const nmapResult = await this.networkService.scanNetwork(net.cidr, req.user.id)
          if (nmapResult && nmapResult.devices) {
            nmapDevices = nmapDevices.concat(nmapResult.devices)
          }
        }
        results.nmapDevices = nmapDevices
        const nmapDuration = Date.now() - nmapStart
        results.methods.push(`Nmap Scan: ${results.nmapDevices.length} appareils en ${nmapDuration}ms`)
        this.logger.log(`[CONTROLLER] Nmap: ${results.nmapDevices.length} appareils trouvés`)
      } catch (error) {
        this.logger.warn(`[CONTROLLER] Échec scan nmap: ${error.message}`)
        results.methods.push(`Nmap Scan: Échec - ${error.message}`)
      }

      // 3. Combiner et dédupliquer les résultats
      const deviceMap = new Map()

      // Fonction utilitaire pour fusionner deux appareils
      function mergeDevices(existing, incoming) {
        return {
          ...existing,
          ...Object.fromEntries(Object.entries(incoming).filter(([k, v]) => v !== undefined && v !== null && v !== '')),
          sources: Array.from(new Set([...(existing.sources || [existing.source || '']), ...(incoming.sources || [incoming.source || ''])])).filter(Boolean)
        }
      }

      // Ajouter les appareils du routeur
      results.routerDevices.forEach(device => {
        const key = device.macAddress || (device.ipAddress + (device.hostname || ''))
        if (key && !deviceMap.has(key)) {
          deviceMap.set(key, {
            ...device,
            sources: ['router']
          })
        }
      })

      // Ajouter les appareils nmap
      results.nmapDevices.forEach(device => {
        const key = device.macAddress || (device.ipAddress + (device.hostname || ''))
        if (key) {
          if (deviceMap.has(key)) {
            // Fusionner les informations intelligemment
            const existing = deviceMap.get(key)
            deviceMap.set(key, mergeDevices(existing, { ...device, sources: ['nmap'] }))
          } else {
            deviceMap.set(key, {
              ...device,
              sources: ['nmap']
            })
          }
        }
      })

      results.combinedDevices = Array.from(deviceMap.values())
      results.scanDuration = Date.now() - startTime

      // Upsert en base pour chaque appareil détecté
      const now = new Date()
      for (const device of results.combinedDevices) {
        const toSave = {
          ...device,
          lastSeen: now,
          firstDiscovered: device.firstDiscovered || now,
          status: 'connu',
        }
        const realId = await this.appareilRepository.upsertDevice(toSave)
        if (realId) {
          await this.nmapAgentService.saveNetworkStats(realId, device.stats)
          await this.nmapAgentService.saveScanLogs({ ...device, id: realId })
        }
      }

      this.logger.log(`[CONTROLLER] Scan complet terminé: ${results.combinedDevices.length} appareils uniques`)

      return {
        success: true,
        data: results.combinedDevices,
        count: results.combinedDevices.length,
        scanDuration: results.scanDuration,
        methods: results.methods,
        breakdown: {
          router: results.routerDevices.length,
          nmap: results.nmapDevices.length,
          combined: results.combinedDevices.length
        },
        message: `Scan complet terminé: ${results.combinedDevices.length} appareils détectés via ${results.methods.length} méthodes`
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur scan complet: ${error.message}`)
      throw new HttpException(`Erreur lors du scan complet: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  private async detectActiveNetwork() {
    try {
      const interfaces = os.networkInterfaces()
      const gateway = await this.routerQuery.detectGateway()
      const wifiOrEthRegex = /wi[-]?fi|wlan|ethernet|en|eth/i
      let selected = null
      for (const [name, nets] of Object.entries(interfaces)) {
        if (!nets) continue
        if (!wifiOrEthRegex.test(name)) continue
        for (const net of nets) {
          if (net.family === 'IPv4' && !net.internal && net.address) {
            const ipParts = net.address.split('.')
            const gwParts = gateway.split('.')
            if (ipParts[0] === gwParts[0] && ipParts[1] === gwParts[1] && ipParts[2] === gwParts[2]) {
              const networkPrefix = ipParts.slice(0, 3).join('.')
              const cidr = `${networkPrefix}.0/24`
              selected = {
                interface: name,
                localIP: net.address,
                netmask: net.netmask,
                cidr,
                gateway
              }
              break
            }
          }
        }
        if (selected) break
      }
      if (!selected) {
        // Fallback : première interface Wi-Fi/Ethernet trouvée
        for (const [name, nets] of Object.entries(interfaces)) {
          if (!nets) continue
          if (!wifiOrEthRegex.test(name)) continue
          for (const net of nets) {
            if (net.family === 'IPv4' && !net.internal && net.address) {
              const ipParts = net.address.split('.')
              const networkPrefix = ipParts.slice(0, 3).join('.')
              const cidr = `${networkPrefix}.0/24`
              selected = {
                interface: name,
                localIP: net.address,
                netmask: net.netmask,
                cidr,
                gateway: `${networkPrefix}.1`
              }
              break
            }
          }
          if (selected) break
        }
      }
      if (!selected) {
        selected = {
          interface: "default",
          localIP: "192.168.1.1",
          netmask: "255.255.255.0",
          cidr: "192.168.1.0/24",
          gateway: "192.168.1.1"
        }
      }
      this.logger.log(`[CONTROLLER] Réseau actif détecté: ${selected.cidr} (gateway: ${selected.gateway})`)
      return selected
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur détection réseau actif: ${error.message}`)
      throw new Error("Impossible de détecter le réseau actif")
    }
  }
}

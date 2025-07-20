import { Controller, Get, Post, UseGuards, Logger, HttpException, HttpStatus, Body, Req, Headers, Query, Param } from "@nestjs/common"
import { NetworkService } from "./network.service"
import { NetworkDetectorService } from "./network-detector.service"
import { RouterQueryService } from "./agents/router-query.service"
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard"
import type { RequestWithUser } from "../../auth/auth.types"
import * as os from "os"
import { AppareilRepository } from "./appareil.repository"
import { NmapAgentService } from "./agents/nmap.service"
import { QueryTypes } from "sequelize"
import { sequelize } from "../../database"
import { v4 as uuidv4 } from "uuid"
import { Op } from "sequelize"

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

  @Get("devices/debug")
  async getDevicesDebug(@Req() req: RequestWithUser) {
    try {
      this.logger.log(`[CONTROLLER] Récupération debug des appareils demandée par l'utilisateur ${req.user?.id || 'inconnu'}`)
      const debugInfo = await this.appareilRepository.findAllDevicesDebug()
      
      return {
        success: true,
        data: {
          active: debugInfo.active,
          inactive: debugInfo.inactive,
          total: debugInfo.total,
          summary: {
            activeCount: debugInfo.active.length,
            inactiveCount: debugInfo.inactive.length,
            totalCount: debugInfo.total
          }
        },
        count: debugInfo.total,
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur récupération debug appareils: ${error.message}`)
      throw new HttpException("Erreur lors de la récupération debug des appareils", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("topology")
  async getTopology(@Req() req: RequestWithUser) {
    try {
      this.logger.log(`[CONTROLLER] Récupération de la topologie persistée demandée par l'utilisateur ${req.user?.id || 'inconnu'}`)
      // Récupérer la dernière topologie persistée
      const [row] = await sequelize.query(
        `SELECT data FROM topologie_reseau WHERE isActive = TRUE ORDER BY updatedAt DESC LIMIT 1`,
        { type: QueryTypes.SELECT }
      )
      const data = (row as any)?.data
      if (!data) {
        throw new HttpException("Aucune topologie persistée trouvée", HttpStatus.NOT_FOUND)
      }
      const topology = typeof data === 'string' ? JSON.parse(data) : data
      return {
        success: true,
        data: topology,
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur récupération topologie persistée: ${error.message}`)
      throw new HttpException("Erreur lors de la récupération de la topologie", HttpStatus.INTERNAL_SERVER_ERROR)
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
        // Priorité : ne scanner que la première interface active
        if (Array.isArray(networksInfo) && networksInfo.length > 0) {
          const net = networksInfo[0]
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

      // ENRICHISSEMENT : pipeline du scan auto sur chaque source AVANT fusion
      let enrichedRouterDevices = []
      let enrichedNmapDevices = []
      if (results.routerDevices && results.routerDevices.length > 0) {
        enrichedRouterDevices = await this.nmapAgentService.enrichBasicInfo(results.routerDevices)
      }
      if (results.nmapDevices && results.nmapDevices.length > 0) {
        enrichedNmapDevices = await this.nmapAgentService.enrichBasicInfo(results.nmapDevices)
      }

      // Vérification : lister les appareils présents dans les deux sources (Nmap ET routeur) avant la fusion
      const nmapMap = new Map()
      for (const device of enrichedNmapDevices) {
        const key = device.macAddress || (device.ipAddress + (device.hostname || ''))
        if (key) nmapMap.set(key, device)
      }
      const routerMap = new Map()
      for (const device of enrichedRouterDevices) {
        const key = device.macAddress || (device.ipAddress + (device.hostname || ''))
        if (key) routerMap.set(key, device)
      }
      // Appareils présents dans les deux sources
      const inBoth = []
      for (const [key, device] of nmapMap) {
        if (routerMap.has(key)) {
          inBoth.push({
            nmap: device,
            router: routerMap.get(key)
          })
        }
      }
      this.logger.log(`[SCAN] Appareils présents dans les deux sources (Nmap ET Routeur): ${inBoth.length}`)
      // Optionnel : exposer dans la réponse API pour debug
      // results.inBoth = inBoth

      // 3. Combiner et dédupliquer les résultats UNIQUEMENT pour les appareils présents dans les deux sources
      const deviceMap = new Map()
      function mergeDevices(existing, incoming) {
        const merged = { ...existing }
        for (const [k, v] of Object.entries(incoming)) {
          if (
            v !== undefined && v !== null && v !== '' &&
            (merged[k] === undefined || merged[k] === null || merged[k] === '' || (typeof v === 'object' && Object.keys(v).length > Object.keys(merged[k] || {}).length))
          ) {
            merged[k] = v
          }
        }
        merged.sources = Array.from(new Set([...(existing.sources || [existing.source || '']), ...(incoming.sources || [incoming.source || ''])])).filter(Boolean)
        return merged
      }
      for (const pair of inBoth) {
        const deviceNmap = pair.nmap
        const deviceRouter = pair.router
        const key = deviceNmap.macAddress || (deviceNmap.ipAddress + (deviceNmap.hostname || ''))
        if (key && !deviceMap.has(key)) {
          // Upsert de l'appareil fusionné
          const merged = mergeDevices(deviceRouter, deviceNmap)
          const toSave = {
            ...merged,
            lastSeen: new Date(),
            firstDiscovered: merged.firstDiscovered || new Date(),
            status: 'connu',
          }
          const realId = await this.appareilRepository.upsertDevice(toSave)
          if (realId) {
            deviceMap.set(key, {
              ...merged,
              id: realId,
              sources: merged.sources
            })
          }
        }
      }
      let combinedDevices = Array.from(deviceMap.values())
      results.combinedDevices = combinedDevices
      results.scanDuration = Date.now() - startTime

      // Récupérer les IDs des appareils détectés pour la désactivation
      const detectedIds: string[] = results.combinedDevices.map(device => device.id).filter(Boolean)

      // Désactiver les appareils non détectés
      await this.appareilRepository.disableMissingDevices(detectedIds)

      // Générer et persister la topologie réseau
      try {
        const topology = await this.networkService.getNetworkTopology(results.combinedDevices)
        // Désactiver les anciennes topologies
        await sequelize.query(
          `UPDATE topologie_reseau SET isActive = FALSE WHERE isActive = TRUE`,
          { type: QueryTypes.UPDATE }
        )
        // Insérer la nouvelle topologie
        await sequelize.query(
          `INSERT INTO topologie_reseau (id, name, data, isActive, createdAt, updatedAt) VALUES (:id, :name, :data, TRUE, NOW(), NOW())`,
          {
            replacements: {
              id: uuidv4(),
              name: `Scan du ${new Date().toLocaleString()}`,
              data: JSON.stringify(topology),
            },
            type: QueryTypes.INSERT,
          }
        )
        this.logger.log(`[TOPOLOGY] Nouvelle topologie persistée.`)
      } catch (err) {
        this.logger.error(`[TOPOLOGY] Erreur lors de la persistance de la topologie: ${err.message}`)
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

  @Get("/dashboard/summary")
  async getDashboardSummary() {
    try {
      // 1. Nombre d'appareils actifs/inactifs
      const [devices] = await sequelize.query(
        `SELECT isActive, COUNT(*) as count FROM appareils GROUP BY isActive`,
        { type: QueryTypes.SELECT }
      )
      let devicesActive = 0, devicesInactive = 0
      if (Array.isArray(devices)) {
        devices.forEach((row: any) => {
          if ((row as any).isActive) devicesActive += Number((row as any).count)
          else devicesInactive += Number((row as any).count)
        })
      } else if (devices) {
        if ((devices as any).isActive) devicesActive = Number((devices as any).count)
        else devicesInactive = Number((devices as any).count)
      }

      // 2. Nombre d'alertes actives et incidents critiques
      const [alerts] = await sequelize.query(
        `SELECT severity, COUNT(*) as count FROM alertes a JOIN anomalies an ON a.anomalyId = an.id WHERE a.status = 'active' GROUP BY an.severity`,
        { type: QueryTypes.SELECT }
      )
      let alertsActive = 0, incidentsCritical = 0
      if (Array.isArray(alerts)) {
        alerts.forEach((row: any) => {
          if (((row as any).severity || '').toLowerCase() === 'critical') incidentsCritical += Number((row as any).count)
          else alertsActive += Number((row as any).count)
        })
      } else if (alerts) {
        if (((alerts as any).severity || '').toLowerCase() === 'critical') incidentsCritical = Number((alerts as any).count)
        else alertsActive = Number((alerts as any).count)
      }

      // 3. Bande passante totale (download/upload sur la dernière heure)
      const [bandwidth] = await sequelize.query(
        `SELECT SUM(bandwidth) as totalDownload, SUM(cpuUsage) as totalUpload FROM statistiques_reseau WHERE timestamp >= NOW() - INTERVAL 1 HOUR`,
        { type: QueryTypes.SELECT }
      )
      const totalDownload = (bandwidth as any)?.totalDownload || 0
      const totalUpload = (bandwidth as any)?.totalUpload || 0

      // 4. Evolution sur 24h (points pour graphiques)
      const [evolution] = await sequelize.query(
        `SELECT HOUR(timestamp) as hour, SUM(bandwidth) as download, SUM(cpuUsage) as upload FROM statistiques_reseau WHERE timestamp >= NOW() - INTERVAL 24 HOUR GROUP BY HOUR(timestamp) ORDER BY hour`,
        { type: QueryTypes.SELECT }
      )
      const evolution24h = Array.isArray(evolution) ? evolution : []

      return {
        success: true,
        data: {
          devicesActive,
          devicesInactive,
          alertsActive,
          incidentsCritical,
          totalDownload,
          totalUpload,
          evolution24h,
        }
      }
    } catch (error) {
      this.logger.error(`[DASHBOARD] Erreur récupération synthèse dashboard: ${error.message}`)
      throw new HttpException("Erreur lors de la récupération du dashboard", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("/alerts")
  async getAlerts(@Query() query) {
    // Pagination et filtres
    const page = parseInt(query.page) || 1
    const pageSize = parseInt(query.pageSize) || 20
    const offset = (page - 1) * pageSize
    const status = query.status
    const severity = query.severity
    const deviceId = query.deviceId
    const whereAlert = []
    const whereAnomaly = []
    if (status) whereAlert.push(`a.status = :status`)
    if (severity) whereAnomaly.push(`an.severity = :severity`)
    if (deviceId) whereAnomaly.push(`an.deviceId = :deviceId`)
    const whereClause = [
      whereAlert.length ? whereAlert.join(' AND ') : null,
      whereAnomaly.length ? whereAnomaly.join(' AND ') : null
    ].filter(Boolean).join(' AND ')
    const sql = `
      SELECT a.id as alertId, a.status, a.priority, a.triggeredAt, a.resolvedAt, a.notified,
             an.id as anomalyId, an.severity, an.description, an.anomalyType, an.detectedAt, an.isConfirmed,
             ap.id as deviceId, ap.hostname, ap.ipAddress, ap.macAddress, ap.deviceType
      FROM alertes a
      JOIN anomalies an ON a.anomalyId = an.id
      JOIN appareils ap ON an.deviceId = ap.id
      ${whereClause ? 'WHERE ' + whereClause : ''}
      ORDER BY a.triggeredAt DESC
      LIMIT :pageSize OFFSET :offset
    `
    const results = await sequelize.query(sql, {
      replacements: {
        status,
        severity,
        deviceId,
        pageSize,
        offset
      },
      type: QueryTypes.SELECT
    })
    return { page, pageSize, results }
  }

  @Post("/alerts/:id/ack")
  async acknowledgeAlert(@Param('id') id: string, @Req() req: RequestWithUser) {
    // Acquitter une alerte (status -> resolved, resolvedAt = NOW)
    await sequelize.query(
      `UPDATE alertes SET status = 'resolved', resolvedAt = NOW() WHERE id = :id`,
      { replacements: { id }, type: QueryTypes.UPDATE }
    )
    return { success: true }
  }

  @Post("/alerts/:id/assign")
  async assignAlert(@Param('id') id: string, @Body('userId') userId: string) {
    // Assigner une alerte à un utilisateur (mettre à jour anomalies.assignedToUserId)
    await sequelize.query(
      `UPDATE anomalies SET assignedToUserId = :userId WHERE id = (SELECT anomalyId FROM alertes WHERE id = :id)`,
      { replacements: { id, userId }, type: QueryTypes.UPDATE }
    )
    return { success: true }
  }

  @Post("/alerts/:id/comment")
  async commentAlert(@Param('id') id: string, @Req() req: RequestWithUser, @Body('message') message: string) {
    // Ajouter un commentaire dans la table retours
    const userId = req.user?.id
    await sequelize.query(
      `INSERT INTO retours (id, userId, alertId, message, createdAt) VALUES (UUID(), :userId, :alertId, :message, NOW())`,
      { replacements: { userId, alertId: id, message }, type: QueryTypes.INSERT }
    )
    return { success: true }
  }

  @Get("/notifications")
  async getNotifications(@Req() req: RequestWithUser) {
    const userId = req.user?.id
    if (!userId) throw new HttpException('Utilisateur non authentifié', HttpStatus.UNAUTHORIZED)
    const sql = `SELECT * FROM notifications WHERE userId = :userId ORDER BY createdAt DESC`
    const notifications = await sequelize.query(sql, {
      replacements: { userId },
      type: QueryTypes.SELECT
    })
    return { notifications }
  }

  @Post("/notifications/:id/read")
  async markNotificationRead(@Param('id') id: string, @Req() req: RequestWithUser) {
    const userId = req.user?.id
    if (!userId) throw new HttpException('Utilisateur non authentifié', HttpStatus.UNAUTHORIZED)
    await sequelize.query(
      `UPDATE notifications SET isRead = TRUE, readAt = NOW() WHERE id = :id AND userId = :userId`,
      { replacements: { id, userId }, type: QueryTypes.UPDATE }
    )
    return { success: true }
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
            const ipParts = net.address.split('.')
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
        // eslint-disable-next-line no-await-in-loop
        const reachable = await pingGateway(net.gateway)
        if (reachable) activeNetworks.push(net)
      }
      if (activeNetworks.length === 0) {
        this.logger.warn('[CONTROLLER] Aucune interface physique active détectée (gateway non joignable)')
        throw new Error('Aucune interface physique active détectée (gateway non joignable)')
      }
      this.logger.log(`[CONTROLLER] Réseaux actifs détectés: ${activeNetworks.map(n => n.cidr).join(', ')}`)
      return activeNetworks
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur détection réseau actif: ${error.message}`)
      throw new Error('Impossible de détecter le réseau actif')
    }
  }
}

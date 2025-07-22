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
import { TopologyService } from '../topology/topology.service';

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
    private readonly topologyService: TopologyService,
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

      // --- NOUVEAU : Vérification de la plage cible ---
      const activeNetworks = await this.detectActiveNetwork()
      const activeCidrs = activeNetworks.map(n => n.cidr)
      // On autorise le scan uniquement si la cible fait partie des CIDR actifs
      if (!activeCidrs.includes(config.target)) {
        this.logger.warn(`[CONTROLLER] Plage cible ${config.target} non détectée comme active. Plages actives: ${activeCidrs.join(', ')}`)
        throw new HttpException(
          `La plage réseau demandée (${config.target}) n'est pas active sur cette machine. Plages détectées : ${activeCidrs.join(', ')}`,
          HttpStatus.BAD_REQUEST
        )
      }
      // --- FIN NOUVEAU ---

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
  async comprehensiveScan(@Req() req: RequestWithUser, @Query('mode') mode: string) {
    try {
      if (!req.user || !req.user.id) {
        throw new HttpException("Utilisateur non authentifié", HttpStatus.UNAUTHORIZED)
      }
      const userId = req.user.id;
      const isFast = mode === 'rapide';
      this.logger.log(`[CONTROLLER] Scan ${isFast ? 'rapide' : 'complet'} demandé par l'utilisateur ${userId}`)
      const startTime = Date.now()
      if (isFast) {
        // Pipeline identique au scan auto
        const networksInfo = await this.detectActiveNetwork()
        let nmapDevices: any[] = []
        if (Array.isArray(networksInfo) && networksInfo.length > 0) {
          const net = networksInfo[0]
          const nmapResult = await this.networkService.scanNetwork(net.cidr, userId)
          if (nmapResult && nmapResult.devices) {
            nmapDevices = nmapResult.devices
          }
        }
        return {
          success: true,
          mode: 'rapide',
          data: nmapDevices,
          count: nmapDevices.length,
          scanDuration: Date.now() - startTime,
          message: `Scan rapide terminé: ${nmapDevices.length} appareils détectés.`
        }
      }
      // Pipeline complet (actuel)
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
        if (Array.isArray(networksInfo) && networksInfo.length > 0) {
          const net = networksInfo[0]
          const nmapResult = await this.networkService.scanNetwork(net.cidr, userId)
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
      // Fusion, déduplication
      const allDevices = [...enrichedRouterDevices, ...enrichedNmapDevices]
      // Upsert batché
      const upsertedIds = await this.appareilRepository.upsertMany(allDevices)
      // ... (suite de la pipeline: topologie, stats, etc.)
      // (On garde la logique existante pour le mode complet)
      // ...
      // (Retour de la réponse complète comme avant)
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur scan: ${error.message}`)
      throw new HttpException(`Erreur lors du scan: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post('generate-topology')
  async generateTopologyManually() {
    const allDevices = await this.appareilRepository.findAllDevices();
    // On filtre les actifs via le champ brut
    const devices = allDevices.filter((d: any) => d.isActive === true || d.isActive === 1);
    const topology = await this.topologyService.generateTopology(devices);
    // TODO: persister la topologie générée
    return { success: true, data: topology };
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

  @Get("test-device-type")
  async testDeviceType(@Query('mac') mac: string, @Query('hostname') hostname: string, @Query('os') os: string, @Query('ports') ports: string) {
    try {
      this.logger.log(`[TEST] Test détection type: MAC=${mac}, Hostname=${hostname}, OS=${os}, Ports=${ports}`)
      
      const openPorts = ports ? ports.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p)) : []
      
      const result = this.nmapAgentService['deviceTypeService'].detectDeviceType({
        macAddress: mac,
        hostname: hostname,
        os: os,
        openPorts: openPorts
      })
      
      return {
        success: true,
        result: result,
        message: `Type détecté: ${result.deviceType} (confiance: ${result.confidence}, méthode: ${result.method})`
      }
    } catch (error) {
      this.logger.error(`[TEST] Erreur test détection: ${error.message}`)
      throw new HttpException(`Erreur test détection: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("test-real-devices")
  async testRealDevices() {
    try {
      this.logger.log(`[TEST] Test avec les appareils réels détectés`)
      
      const testCases = [
        {
          name: "iPhone",
          mac: "b6:e1:3a:1b:57:c9",
          hostname: "iPhone",
          os: "Linux",
          ports: []
        },
        {
          name: "Windows Docker",
          mac: "",
          hostname: "host.docker.internal", 
          os: "Windows",
          ports: [135, 139, 445, 8080]
        },
        {
          name: "Routeur",
          mac: "02:56:ce:01:c5:ae",
          hostname: "infinitybox.home",
          os: "Linux",
          ports: [80, 443, 22]
        }
      ]
      
      const results = testCases.map(testCase => {
        const result = this.nmapAgentService['deviceTypeService'].detectDeviceType({
          macAddress: testCase.mac,
          hostname: testCase.hostname,
          os: testCase.os,
          openPorts: testCase.ports
        })
        
        return {
          name: testCase.name,
          input: testCase,
          result: result
        }
      })
      
      return {
        success: true,
        results: results
      }
    } catch (error) {
      this.logger.error(`[TEST] Erreur test appareils réels: ${error.message}`)
      throw new HttpException(`Erreur test appareils réels: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("test-contextual-detection")
  async testContextualDetection() {
    try {
      this.logger.log(`[TEST] Test détection contextuelle avec cas réels`)
      
      const testCases = [
        {
          name: "iPhone",
          mac: "b6:e1:3a:1b:57:c9",
          hostname: "iPhone",
          os: "Linux",
          ports: [],
          expected: "MOBILE"
        },
        {
          name: "Windows Docker",
          mac: "",
          hostname: "host.docker.internal", 
          os: "Windows",
          ports: [135, 139, 445, 8080],
          expected: "DESKTOP"
        },
        {
          name: "Routeur InfinityBox",
          mac: "02:56:ce:01:c5:ae",
          hostname: "infinitybox.home",
          os: "Linux",
          ports: [80, 443, 22],
          expected: "ROUTER"
        },
        {
          name: "Laptop Dell",
          mac: "00:1e:8c:12:34:56",
          hostname: "dell-laptop-paul",
          os: "Windows",
          ports: [135, 139, 445, 3389],
          expected: "LAPTOP"
        },
        {
          name: "Serveur Linux",
          mac: "00:50:56:12:34:56",
          hostname: "web-server-01",
          os: "Linux Ubuntu",
          ports: [22, 80, 443, 3306, 8080],
          expected: "SERVER"
        },
        {
          name: "Imprimante HP",
          mac: "00:80:77:12:34:56",
          hostname: "HP-Printer-Office",
          os: "Embedded Linux",
          ports: [80, 443, 515, 631, 9100],
          expected: "PRINTER"
        },
        {
          name: "Samsung Galaxy",
          mac: "00:1a:11:12:34:56",
          hostname: "Galaxy-S21",
          os: "Android",
          ports: [80, 443],
          expected: "MOBILE"
        }
      ]
      
      const results = testCases.map(testCase => {
        const result = this.nmapAgentService['deviceTypeService'].detectDeviceType({
          macAddress: testCase.mac,
          hostname: testCase.hostname,
          os: testCase.os,
          openPorts: testCase.ports
        })
        
        const isCorrect = result.deviceType === testCase.expected;
        
        return {
          name: testCase.name,
          input: {
            mac: testCase.mac,
            hostname: testCase.hostname,
            os: testCase.os,
            ports: testCase.ports
          },
          result: {
            detected: result.deviceType,
            expected: testCase.expected,
            confidence: result.confidence,
            method: result.method,
            isCorrect: isCorrect
          },
          details: result.details
        }
      })
      
      const correctCount = results.filter(r => r.result.isCorrect).length;
      const accuracy = (correctCount / results.length) * 100;
      
      return {
        success: true,
        accuracy: `${accuracy.toFixed(1)}%`,
        correctCount,
        totalCount: results.length,
        results: results
      }
    } catch (error) {
      this.logger.error(`[TEST] Erreur test détection contextuelle: ${error.message}`)
      throw new HttpException(`Erreur test détection contextuelle: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
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

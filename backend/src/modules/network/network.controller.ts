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
import { EnhancedNetworkService } from "./enhanced-network.service";

// Interfaces pour le typage des résultats de requêtes SQL
interface StatsResult {
  avgCpu: number
  avgMemory: number
  avgBandwidth: number
  totalDownload: number
  totalUpload: number
}

interface TotalCountResult {
  total: number
}

interface AlertResult {
  alertId: string
  status: string
  priority: string
  triggeredAt: Date
  resolvedAt?: Date
  notified: boolean
}

interface EnrichedAlertResult extends AlertResult {
  anomalyId?: string
  severity?: string
  description?: string
  anomalyType?: string
  detectedAt?: Date
  isConfirmed?: boolean
  deviceId?: string
  hostname?: string
  ipAddress?: string
  macAddress?: string
  deviceType?: string
}

interface CountResult {
  count: number
}

interface TableStatus {
  [key: string]: {
    exists: boolean
    count?: number
    error?: string
  }
}

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
    private readonly enhancedNetworkService: EnhancedNetworkService,
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

  @Get("devices/no-log")
  async getDevicesNoLog(@Req() req: RequestWithUser) {
    try {
      const devices = await this.appareilRepository.findAllDevicesNoLog()
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
      
      // Utiliser le TopologyService pour récupérer la dernière topologie
      const topology = await this.topologyService.getLastTopology()
      
      if (!topology) {
        throw new HttpException("Aucune topologie persistée trouvée", HttpStatus.NOT_FOUND)
      }
      
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
      const isOptimized = mode === 'optimise';
      this.logger.log(`[CONTROLLER] Scan ${isFast ? 'rapide' : isOptimized ? 'optimisé' : 'complet'} demandé par l'utilisateur ${userId}`)
      const startTime = Date.now()
      
      if (isFast) {
        // Pipeline rapide minimal - détection uniquement sans enrichissement
        const networksInfo = await this.detectActiveNetwork()
        let nmapDevices: any[] = []
        if (Array.isArray(networksInfo) && networksInfo.length > 0) {
          const net = networksInfo[0]
          // Utilisation de la nouvelle méthode scanNetworkQuick pour le mode rapide
          const nmapResult = await this.networkService.scanNetworkQuick(net.cidr, userId)
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
      
      // Pipeline complet (actuel) - avec enrichissement et statistiques
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
      
      // 2. Scan nmap en parallèle (choix entre optimisé et complet)
      try {
        this.logger.log(`[CONTROLLER] Démarrage scan nmap (mode: ${isOptimized ? 'optimisé' : 'complet'})`)
        const nmapStart = Date.now()
        const networksInfo = await this.detectActiveNetwork()
        let nmapDevices: any[] = []
        if (Array.isArray(networksInfo) && networksInfo.length > 0) {
          const net = networksInfo[0]
          // Utilisation de la méthode optimisée si demandée
          const nmapResult = isOptimized 
            ? await this.networkService.scanNetworkOptimized(net.cidr, userId)
            : await this.networkService.scanNetwork(net.cidr, userId)
          if (nmapResult && nmapResult.devices) {
            nmapDevices = nmapDevices.concat(nmapResult.devices)
          }
        }
        results.nmapDevices = nmapDevices
        const nmapDuration = Date.now() - nmapStart
        results.methods.push(`Nmap Scan (${isOptimized ? 'optimisé' : 'complet'}): ${results.nmapDevices.length} appareils en ${nmapDuration}ms`)
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
      
      // Calcul de la durée totale
      results.scanDuration = Date.now() - startTime
      
      // Retour de la réponse complète
      return {
        success: true,
        mode: isOptimized ? 'optimisé' : 'complet',
        data: allDevices,
        count: allDevices.length,
        scanDuration: results.scanDuration,
        methods: results.methods,
        message: `Scan ${isOptimized ? 'optimisé' : 'complet'} terminé: ${allDevices.length} appareils détectés en ${results.scanDuration}ms`
      }
      
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur scan: ${error.message}`)
      throw new HttpException(`Erreur lors du scan: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post('generate-topology')
  async generateTopologyManually() {
    try {
      const allDevices = await this.appareilRepository.findAllDevices();
      const devices = allDevices.filter((d: any) => d.isActive === true || d.isActive === 1);

      if (!devices || devices.length === 0) {
        throw new HttpException("Aucun appareil actif trouvé, impossible de générer la topologie", HttpStatus.BAD_REQUEST);
      }

      // La topologie est générée ET persistée dans le service
      const topology = await this.topologyService.generateTopology(devices);

      // Ajout d'un champ generatedAt et source pour la traçabilité
      const responseTopology = {
        ...topology,
        generatedAt: new Date().toISOString(),
        source: 'manual',
      };

      return { success: true, data: responseTopology };
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur génération topologie: ${error.message}`);
      throw new HttpException("Erreur lors de la génération de la topologie: " + (error.message || error), HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get("/dashboard/summary")
  async getDashboardSummary() {
    try {
      this.logger.log('[DASHBOARD] Récupération du résumé dashboard')
      
      // 1. Nombre d'appareils actifs/inactifs - Comptage direct dans la table appareils
      const devicesResult = await sequelize.query(
        `SELECT 
          isActive, 
          COUNT(*) as count 
        FROM appareils 
        GROUP BY isActive`,
        { type: QueryTypes.SELECT }
      )
      
      let devicesActive = 0, devicesInactive = 0
      
      if (Array.isArray(devicesResult)) {
        devicesResult.forEach((row: any) => {
          if (row.isActive === 1 || row.isActive === true) {
            devicesActive = Number(row.count)
          } else {
            devicesInactive = Number(row.count)
          }
        })
      }
      
      this.logger.log(`[DASHBOARD] Appareils comptés - Actifs: ${devicesActive}, Inactifs: ${devicesInactive}`)

      // 2. Nombre d'alertes actives et incidents critiques
      const alertsResult = await sequelize.query(
        `SELECT 
          an.severity, 
          COUNT(*) as count 
        FROM alertes a 
        JOIN anomalies an ON a.anomalyId = an.id 
        WHERE a.status = 'active' 
        GROUP BY an.severity`,
        { type: QueryTypes.SELECT }
      )
      
      let alertsActive = 0, incidentsCritical = 0
      
      if (Array.isArray(alertsResult)) {
        alertsResult.forEach((row: any) => {
          const severity = (row.severity || '').toLowerCase()
          const count = Number(row.count)
          
          if (severity === 'critical') {
            incidentsCritical = count
          } else {
            alertsActive += count
          }
        })
      }
      
      this.logger.log(`[DASHBOARD] Alertes comptées - Actives: ${alertsActive}, Critiques: ${incidentsCritical}`)

      // 3. Statistiques réseau (CPU, mémoire, bande passante sur la dernière heure)
      const statsResult = await sequelize.query(
        `SELECT 
          AVG(cpuUsage) as avgCpu, 
          AVG(memoryUsage) as avgMemory, 
          AVG(bandwidth) as avgBandwidth,
          SUM(bandwidth) as totalDownload,
          SUM(bandwidth) as totalUpload
        FROM statistiques_reseau 
        WHERE timestamp >= NOW() - INTERVAL 1 HOUR`,
        { type: QueryTypes.SELECT }
      )
      
      const stats = Array.isArray(statsResult) ? statsResult[0] as StatsResult : statsResult as StatsResult
      const avgCpu = Number(stats?.avgCpu || 0)
      const avgMemory = Number(stats?.avgMemory || 0)
      const avgBandwidth = Number(stats?.avgBandwidth || 0)
      const totalDownload = Number(stats?.totalDownload || 0)
      const totalUpload = Number(stats?.totalUpload || 0)

      // 4. Evolution sur 24h (points pour graphiques)
      const evolutionResult = await sequelize.query(
        `SELECT 
          HOUR(timestamp) as hour, 
          AVG(cpuUsage) as cpu, 
          AVG(memoryUsage) as memory,
          AVG(bandwidth) as bandwidth 
        FROM statistiques_reseau 
        WHERE timestamp >= NOW() - INTERVAL 24 HOUR 
        GROUP BY HOUR(timestamp) 
        ORDER BY hour`,
        { type: QueryTypes.SELECT }
      )
      
      const evolution24h = Array.isArray(evolutionResult) ? evolutionResult : []

      this.logger.log(`[DASHBOARD] Résumé généré - Total appareils: ${devicesActive + devicesInactive}`)

      return {
        success: true,
        data: {
          devicesActive,
          devicesInactive,
          alertsActive,
          incidentsCritical,
          avgCpu,
          avgMemory,
          avgBandwidth,
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

  @Get("/dashboard/test-count")
  async testDeviceCount() {
    try {
      this.logger.log('[DASHBOARD] Test du comptage des appareils')
      
      // Test 1: Comptage simple
      const totalCount = await sequelize.query(
        `SELECT COUNT(*) as total FROM appareils`,
        { type: QueryTypes.SELECT }
      )
      
      // Test 2: Comptage par statut
      const statusCount = await sequelize.query(
        `SELECT 
          isActive, 
          COUNT(*) as count 
        FROM appareils 
        GROUP BY isActive`,
        { type: QueryTypes.SELECT }
      )
      
      // Test 3: Détails des appareils (limité à 5)
      const sampleDevices = await sequelize.query(
        `SELECT 
          id, 
          hostname, 
          ipAddress, 
          isActive, 
          lastSeen 
        FROM appareils 
        ORDER BY lastSeen DESC 
        LIMIT 5`,
        { type: QueryTypes.SELECT }
      )
      
      const result = {
        totalDevices: Array.isArray(totalCount) ? Number((totalCount[0] as TotalCountResult)?.total || 0) : 0,
        statusBreakdown: Array.isArray(statusCount) ? statusCount : [],
        sampleDevices: Array.isArray(sampleDevices) ? sampleDevices : [],
        timestamp: new Date().toISOString()
      }
      
      this.logger.log(`[DASHBOARD] Test comptage - Total: ${result.totalDevices}`)
      
      return {
        success: true,
        data: result
      }
    } catch (error) {
      this.logger.error(`[DASHBOARD] Erreur test comptage: ${error.message}`)
      throw new HttpException("Erreur lors du test de comptage", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("/alerts")
  async getAlerts(@Query() query) {
    try {
      this.logger.log('[ALERTS] Début récupération des alertes')
      
      // Pagination et filtres
      const page = parseInt(query.page) || 1
      const pageSize = parseInt(query.pageSize) || 20
      const offset = (page - 1) * pageSize
      const status = query.status
      
      // Commencer par une requête simple sur la table alertes
      let sql = `SELECT id as alertId, status, priority, triggeredAt, resolvedAt, notified FROM alertes`
      const replacements: { pageSize: number; offset: number; status?: string } = { pageSize, offset }
      
      // Ajouter le filtre de statut si spécifié
      if (status) {
        sql += ` WHERE status = :status`
        replacements.status = status
      }
      
      sql += ` ORDER BY triggeredAt DESC LIMIT :pageSize OFFSET :offset`
      
      this.logger.log(`[ALERTS] Exécution de la requête SQL simple`)
      
      const results = await sequelize.query(sql, {
        replacements,
        type: QueryTypes.SELECT
      })
      
      this.logger.log(`[ALERTS] ${results.length} alertes récupérées avec succès`)
      
      // Si on a des résultats, essayer d'enrichir avec les données des anomalies
      if (results.length > 0) {
        try {
          const alertIds = results.map((r: AlertResult) => r.alertId)
          const enrichQuery = `
            SELECT 
              a.id as alertId,
              an.id as anomalyId,
              an.severity,
              an.description,
              an.anomalyType,
              an.detectedAt,
              an.isConfirmed,
              ap.id as deviceId,
              ap.hostname,
              ap.ipAddress,
              ap.macAddress,
              ap.deviceType
            FROM alertes a
            LEFT JOIN anomalies an ON a.anomalyId = an.id
            LEFT JOIN appareils ap ON an.deviceId = ap.id
            WHERE a.id IN (:alertIds)
          `
          
          const enrichedData = await sequelize.query(enrichQuery, {
            replacements: { alertIds },
            type: QueryTypes.SELECT
          })
          
          // Fusionner les données
          const enrichedMap = new Map(enrichedData.map((item: EnrichedAlertResult) => [item.alertId, item]))
          
          results.forEach((alert: AlertResult) => {
            const enriched = enrichedMap.get(alert.alertId)
            if (enriched) {
              Object.assign(alert, enriched)
            }
          })
          
          this.logger.log(`[ALERTS] Données enrichies avec succès`)
        } catch (enrichError) {
          this.logger.warn(`[ALERTS] Erreur lors de l'enrichissement des données: ${enrichError.message}`)
          // Continuer avec les données de base
        }
      }
      
      return { page, pageSize, results }
      
    } catch (error) {
      this.logger.error(`[ALERTS] Erreur lors de la récupération des alertes: ${error.message}`)
      this.logger.error(`[ALERTS] Stack trace: ${error.stack}`)
      
      // Retourner une liste vide en cas d'erreur plutôt que de faire planter l'API
      return { 
        page: 1, 
        pageSize: 20, 
        results: [],
        error: 'Erreur lors de la récupération des alertes'
      }
    }
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

  @Get("test-alerts")
  async testAlerts() {
    try {
      this.logger.log('[TEST-ALERTS] Test de la structure des tables d\'alertes')
      
      // Vérifier si les tables existent
      const tables = ['alertes', 'anomalies', 'appareils']
      const tableStatus: TableStatus = {}
      
      for (const table of tables) {
        try {
          const countQuery = `SELECT COUNT(*) as count FROM ${table}`
          const result = await sequelize.query(countQuery, { type: QueryTypes.SELECT })
          tableStatus[table] = {
            exists: true,
            count: (result[0] as CountResult)?.count || 0
          }
        } catch (error) {
          tableStatus[table] = {
            exists: false,
            error: error.message
          }
        }
      }
      
      // Test simple de la table alertes
      let simpleAlerts = []
      if (tableStatus.alertes.exists) {
        try {
          const simpleQuery = `SELECT id, status, priority, triggeredAt FROM alertes LIMIT 5`
          simpleAlerts = await sequelize.query(simpleQuery, { type: QueryTypes.SELECT })
        } catch (error) {
          this.logger.error(`[TEST-ALERTS] Erreur requête simple alertes: ${error.message}`)
        }
      }
      
      return {
        success: true,
        tableStatus,
        simpleAlerts,
        message: 'Test des tables d\'alertes terminé'
      }
      
    } catch (error) {
      this.logger.error(`[TEST-ALERTS] Erreur test: ${error.message}`)
      return {
        success: false,
        error: error.message,
        message: 'Erreur lors du test des tables d\'alertes'
      }
    }
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

  @Get("test-enhanced-auto-scan")
  async testEnhancedAutoScan(@Req() req: RequestWithUser) {
    try {
      if (!req.user || !req.user.id) {
        throw new HttpException("Utilisateur non authentifié", HttpStatus.UNAUTHORIZED)
      }

      this.logger.log(`[CONTROLLER] Test scan automatique amélioré demandé par l'utilisateur ${req.user.id}`)
      const startTime = Date.now()

      // Détection du réseau actif
      const activeNetwork = await this.detectActiveNetwork()
      if (!activeNetwork || activeNetwork.length === 0) {
        throw new HttpException("Aucun réseau actif détecté", HttpStatus.BAD_REQUEST)
      }

      // Prendre le premier réseau actif détecté
      const selectedNetwork = activeNetwork[0]

      // Configuration du scan amélioré
      const config = {
        target: selectedNetwork.cidr,
        scanMethod: "auto" as const,
        deepScan: true,
        stealth: false,
        threads: 100,
        osDetection: true,
        serviceDetection: true,
        timing: 4,
      }

      // Exécution du scan amélioré
      const result = await this.enhancedNetworkService.executeEnhancedScan(config, req.user.id)

      const totalDuration = Date.now() - startTime

      return {
        success: result.success,
        scanInfo: {
          target: selectedNetwork.cidr,
          method: result.scanMethod,
          duration: result.scanDuration,
          totalDuration,
          network: selectedNetwork,
        },
        results: {
          devices: result.devices,
          count: result.devices.length,
          statistics: result.statistics,
        },
        performance: {
          devicesPerSecond: result.devices.length / (result.scanDuration / 1000),
          averageResponseTime: result.statistics.averageResponseTime,
          vulnerableDevices: result.statistics.vulnerableDevices,
        },
        message: `Scan ${result.scanMethod} terminé: ${result.devices.length} appareils trouvés en ${result.scanDuration}ms`,
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur test scan amélioré: ${error.message}`)
      throw new HttpException(`Erreur lors du test scan amélioré: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("auto-scan-status")
  async getAutoScanStatus(@Req() req: RequestWithUser) {
    try {
      if (!req.user || !req.user.id) {
        throw new HttpException("Utilisateur non authentifié", HttpStatus.UNAUTHORIZED)
      }

      const lastScanMethod = this.networkDetector.getLastScanMethod()
      const devices = this.networkDetector.getDevices()

      return {
        success: true,
        autoScan: {
          isActive: this.networkDetector.isScanningActive(), // Utiliser une méthode publique
          lastMethod: lastScanMethod,
          devicesInMemory: devices.length,
          lastUpdate: devices.length > 0 ? Math.max(...devices.map(d => d.lastSeen.getTime())) : null,
        },
        devices: devices.slice(0, 10), // Retourner les 10 premiers appareils
        message: `Statut du scan automatique: ${lastScanMethod}`,
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur statut scan automatique: ${error.message}`)
      throw new HttpException(`Erreur lors de la récupération du statut: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("/agents/status")
  async getAgentsStatus() {
    try {
      // Récupérer l'état des différents agents/services
      const agentsStatus = [
        {
          id: 'nmap-agent',
          name: 'Agent Nmap',
          status: 'OK',
          lastRun: new Date(Date.now() - 5 * 60 * 1000).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          nextRun: new Date(Date.now() + 25 * 60 * 1000).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          uptime: '2h 15m',
          type: 'network-scan'
        },
        {
          id: 'stats-agent',
          name: 'Agent Stats',
          status: 'OK',
          lastRun: new Date(Date.now() - 2 * 60 * 1000).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          nextRun: new Date(Date.now() + 28 * 60 * 1000).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          uptime: '1h 45m',
          type: 'performance-monitoring'
        },
        {
          id: 'ping-agent',
          name: 'Agent Ping',
          status: 'OK',
          lastRun: new Date(Date.now() - 1 * 60 * 1000).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          nextRun: new Date(Date.now() + 29 * 60 * 1000).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          uptime: '3h 20m',
          type: 'connectivity-check'
        },
        {
          id: 'anomaly-detector',
          name: 'Détecteur d\'Anomalies',
          status: 'OK',
          lastRun: new Date(Date.now() - 30 * 1000).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          nextRun: new Date(Date.now() + 30 * 1000).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          uptime: '5h 10m',
          type: 'anomaly-detection'
        }
      ]

      return {
        success: true,
        data: agentsStatus,
        count: agentsStatus.length,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      this.logger.error(`[AGENTS] Erreur récupération état agents: ${error.message}`)
      throw new HttpException("Erreur lors de la récupération de l'état des agents", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("/activity-log")
  async getActivityLog(@Query('limit') limit?: string) {
    try {
      const limitNumber = limit ? parseInt(limit, 10) : 20
      
      if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
        throw new HttpException(
          'Le paramètre limit doit être un nombre entre 1 et 100',
          HttpStatus.BAD_REQUEST
        )
      }

      // Simuler un journal d'activité (à remplacer par une vraie base de données)
      const activityLog = [
        {
          id: 'log1',
          user: 'admin',
          action: 'Modifié seuil de latence',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          type: 'config',
          details: 'Seuil CPU passé de 80% à 85%'
        },
        {
          id: 'log2',
          user: 'monitor',
          action: 'Lancé un scan manuel',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          type: 'scan',
          details: 'Scan complet du réseau 192.168.1.0/24'
        },
        {
          id: 'log3',
          user: 'system',
          action: 'Anomalie détectée',
          timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
          type: 'alert',
          details: 'CPU élevé détecté sur Server-DB (92%)'
        },
        {
          id: 'log4',
          user: 'admin',
          action: 'Ajouté nouvel appareil',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          type: 'device',
          details: 'Switch-Access-02 ajouté au monitoring'
        },
        {
          id: 'log5',
          user: 'system',
          action: 'Collecte automatique terminée',
          timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          type: 'stats',
          details: 'Collecte des statistiques MVP terminée (18 appareils)'
        }
      ]

      // Limiter le nombre d'entrées
      const limitedLog = activityLog.slice(0, limitNumber)

      return {
        success: true,
        data: limitedLog,
        count: limitedLog.length,
        total: activityLog.length,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      this.logger.error(`[ACTIVITY] Erreur récupération journal activité: ${error.message}`)
      throw new HttpException("Erreur lors de la récupération du journal d'activité", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post("/activity-log")
  async logActivity(@Body() activityData: {
    user: string
    action: string
    type: string
    details?: string
  }) {
    try {
      const { user, action, type, details } = activityData

      if (!user || !action || !type) {
        throw new HttpException(
          'Les champs user, action et type sont requis',
          HttpStatus.BAD_REQUEST
        )
      }

      // Simuler l'ajout d'une entrée au journal (à remplacer par une vraie base de données)
      const newEntry = {
        id: `log${Date.now()}`,
        user,
        action,
        timestamp: new Date().toISOString(),
        type,
        details: details || ''
      }

      this.logger.log(`[ACTIVITY] Nouvelle activité: ${user} - ${action}`)

      return {
        success: true,
        data: newEntry,
        message: 'Activité enregistrée avec succès',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      this.logger.error(`[ACTIVITY] Erreur enregistrement activité: ${error.message}`)
      throw new HttpException("Erreur lors de l'enregistrement de l'activité", HttpStatus.INTERNAL_SERVER_ERROR)
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
            // Exclusion des plages 10.0.0.0/8 et 172.16.0.0/12
            const ip = net.address
            if (
              ip.startsWith('10.') ||
              (ip.startsWith('172.') && (() => {
                const second = parseInt(ip.split('.')[1], 10)
                return second >= 16 && second <= 31
              })())
            ) {
              continue // On saute cette IP
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

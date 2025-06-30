import { Injectable, Logger } from "@nestjs/common"
import { NetworkService } from "./network.service"
import { WindowsPowerShellService } from "./agents/windows-powershell.service"
import { PythonAdvancedService } from "./agents/python-advanced.service"
import { NmapAgentService } from "./agents/nmap.service"
import { TracerouteAgentService } from "./agents/traceroute.service"
import { NetstatAgentService } from "./agents/netstat.service"
import type { Device, NmapScanConfig } from "./device.model"
import type { NetworkTopologyData } from "./network.types"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

interface EnhancedScanConfig extends NmapScanConfig {
  useWindowsPowerShell?: boolean
  usePythonAdvanced?: boolean
  useNmapFallback?: boolean
  scanMethod?: "auto" | "powershell" | "python" | "nmap" | "hybrid"
  deepScan?: boolean
  stealth?: boolean
  threads?: number
}

interface EnhancedScanResult {
  success: boolean
  devices: Device[]
  topology: NetworkTopologyData
  scanMethod: string
  scanDuration: number
  statistics: {
    totalDevices: number
    activeDevices: number
    vulnerableDevices: number
    averageResponseTime: number
    osDistribution: { [key: string]: number }
    deviceTypes: { [key: string]: number }
    topPorts: { [key: string]: number }
  }
  error?: string
}

export interface EnhancedDevice extends Device {
  zabbixData?: {
    hostId?: string;
    hostName?: string;
    status?: 'enabled' | 'disabled';
    available?: number;
    metrics?: {
      cpu: number;
      memory: number;
      disk: number;
      network: number;
    };
  };
  unifiedHealth?: {
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    lastUpdate: Date;
  };
}

@Injectable()
export class EnhancedNetworkService extends NetworkService {
  private readonly enhancedLogger = new Logger(EnhancedNetworkService.name)

  constructor(
    private readonly windowsPowerShell: WindowsPowerShellService,
    private readonly pythonAdvanced: PythonAdvancedService,
    // Injection des services parents
    nmapAgent: NmapAgentService,
    tracerouteAgent: TracerouteAgentService,
    netstatAgent: NetstatAgentService,
  ) {
    super(nmapAgent, tracerouteAgent, netstatAgent)
  }

  async executeEnhancedScan(config: EnhancedScanConfig, userId?: string): Promise<EnhancedScanResult> {
    const startTime = Date.now()

    try {
      this.enhancedLogger.log(`[ENHANCED] Démarrage scan amélioré: ${config.target}`)
      this.enhancedLogger.log(`[ENHANCED] Méthode: ${config.scanMethod || "auto"}`)

      // Détermination de la méthode de scan optimale
      const scanMethod = await this.determineBestScanMethod(config)
      this.enhancedLogger.log(`[ENHANCED] Méthode sélectionnée: ${scanMethod}`)

      let devices: Device[] = []
      let scanMethodUsed = scanMethod

      // Exécution du scan selon la méthode choisie
      switch (scanMethod) {
        case "powershell":
          devices = await this.executePowerShellScan(config)
          break

        case "python":
          devices = await this.executePythonScan(config)
          break

        case "hybrid":
          devices = await this.executeHybridScan(config)
          scanMethodUsed = "hybrid"
          break

        case "nmap":
        default:
          // Fallback vers le scan nmap original
          const originalResult = await this.scanNetwork(config.target, userId)
          devices = originalResult.devices
          scanMethodUsed = "nmap"
          break
      }

      // Enrichissement des données avec des informations supplémentaires
      const enrichedDevices = await this.enrichDevicesData(devices)

      // Génération de la topologie réseau
      const topology = await this.generateNetworkTopology(enrichedDevices)

      // Calcul des statistiques
      const statistics = this.calculateStatistics(enrichedDevices)

      const scanDuration = Date.now() - startTime

      this.enhancedLogger.log(`[ENHANCED] Scan terminé en ${scanDuration}ms`)
      this.enhancedLogger.log(`[ENHANCED] ${enrichedDevices.length} appareils détectés`)

      return {
        success: true,
        devices: enrichedDevices,
        topology,
        scanMethod: scanMethodUsed,
        scanDuration,
        statistics,
      }
    } catch (error) {
      this.enhancedLogger.error(`[ENHANCED] Erreur scan amélioré: ${error.message}`)

      return {
        success: false,
        devices: [],
        topology: {
          devices: [],
          connections: [],
          stats: {
            totalDevices: 0,
            activeDevices: 0,
            averageLatency: 0,
            averagePacketLoss: 0,
            totalBandwidth: { download: 0, upload: 0 },
          },
        },
        scanMethod: "error",
        scanDuration: Date.now() - startTime,
        statistics: {
          totalDevices: 0,
          activeDevices: 0,
          vulnerableDevices: 0,
          averageResponseTime: 0,
          osDistribution: {},
          deviceTypes: {},
          topPorts: {},
        },
        error: error.message,
      }
    }
  }

  private async determineBestScanMethod(config: EnhancedScanConfig): Promise<string> {
    // Si une méthode spécifique est demandée
    if (config.scanMethod && config.scanMethod !== "auto") {
      return config.scanMethod
    }

    try {
      // Détection de l'environnement
      const isWindows = process.platform === "win32"
      const hasAdminRights = await this.checkAdminRights()
      const hasPython = await this.checkPythonAvailability()
      const hasPowerShell = await this.checkPowerShellAvailability()

      this.enhancedLogger.log(`[ENHANCED] Environnement détecté:`, {
        isWindows,
        hasAdminRights,
        hasPython,
        hasPowerShell,
      })

      // Logique de sélection intelligente
      if (isWindows && hasPowerShell && hasAdminRights) {
        // Windows avec PowerShell et droits admin = méthode optimale
        return "powershell"
      }

      if (hasPython && (config.deepScan || (config.threads && config.threads > 30))) {
        // Python pour les scans approfondis ou haute performance
        return "python"
      }

      if (isWindows && hasPowerShell && hasPython) {
        // Environnement complet = scan hybride
        return "hybrid"
      }

      // Fallback vers nmap
      return "nmap"
    } catch (error) {
      this.enhancedLogger.warn(`[ENHANCED] Erreur détection environnement: ${error.message}`)
      return "nmap"
    }
  }

  private async executePowerShellScan(config: EnhancedScanConfig): Promise<Device[]> {
    try {
      const psConfig = {
        networkRange: config.target,
        ports: this.getPortsFromConfig(config),
        deepScan: config.deepScan || false,
        stealth: config.stealth || false,
        threads: config.threads || 20,
      }

      const result = await this.windowsPowerShell.executePowerShellScan(psConfig)

      if (!result.success) {
        throw new Error(result.error || "Scan PowerShell échoué")
      }

      return result.devices.map((device) => this.windowsPowerShell.convertToDeviceModel(device))
    } catch (error) {
      this.enhancedLogger.error(`[ENHANCED] Erreur scan PowerShell: ${error.message}`)
      throw error
    }
  }

  private async executePythonScan(config: EnhancedScanConfig): Promise<Device[]> {
    try {
      const pyConfig = {
        networkRange: config.target,
        ports: this.getPortsFromConfig(config),
        threads: config.threads || 50,
        timeout: config.stealth ? 2 : 1,
        enableNmap: true,
        enableScapy: false,
      }

      const result = await this.pythonAdvanced.executePythonScan(pyConfig)

      if (!result.success) {
        throw new Error(result.error || "Scan Python échoué")
      }

      return result.devices.map((device) => this.pythonAdvanced.convertToDeviceModel(device))
    } catch (error) {
      this.enhancedLogger.error(`[ENHANCED] Erreur scan Python: ${error.message}`)
      throw error
    }
  }

  private async executeHybridScan(config: EnhancedScanConfig): Promise<Device[]> {
    try {
      this.enhancedLogger.log(`[ENHANCED] Démarrage scan hybride`)

      // Exécution des scans en parallèle
      const [psResult, pyResult] = await Promise.allSettled([
        this.executePowerShellScan(config).catch((error) => {
          this.enhancedLogger.warn(`[HYBRID] PowerShell échoué: ${error.message}`)
          return []
        }),
        this.executePythonScan(config).catch((error) => {
          this.enhancedLogger.warn(`[HYBRID] Python échoué: ${error.message}`)
          return []
        }),
      ])

      const psDevices = psResult.status === "fulfilled" ? psResult.value : []
      const pyDevices = pyResult.status === "fulfilled" ? pyResult.value : []

      this.enhancedLogger.log(`[HYBRID] PowerShell: ${psDevices.length} appareils`)
      this.enhancedLogger.log(`[HYBRID] Python: ${pyDevices.length} appareils`)

      // Fusion intelligente des résultats
      const mergedDevices = this.mergeDeviceResults(psDevices, pyDevices)

      this.enhancedLogger.log(`[HYBRID] Fusion: ${mergedDevices.length} appareils uniques`)

      return mergedDevices
    } catch (error) {
      this.enhancedLogger.error(`[ENHANCED] Erreur scan hybride: ${error.message}`)
      throw error
    }
  }

  private mergeDeviceResults(psDevices: Device[], pyDevices: Device[]): Device[] {
    const deviceMap = new Map<string, Device>()

    // Ajout des appareils PowerShell (priorité haute pour Windows)
    psDevices.forEach((device) => {
      deviceMap.set(device.ipAddress, device)
    })

    // Fusion avec les appareils Python
    pyDevices.forEach((pyDevice) => {
      const existing = deviceMap.get(pyDevice.ipAddress)

      if (existing) {
        // Fusion des données (PowerShell prioritaire, Python complément)
        const merged: Device = {
          ...existing,
          // Garder le meilleur hostname
          hostname: existing.hostname || pyDevice.hostname,
          // Garder la meilleure détection MAC
          macAddress: existing.macAddress || pyDevice.macAddress,
          // Fusionner les ports ouverts
          stats: {
            ...existing.stats,
            services: [
              ...existing.stats.services,
              ...pyDevice.stats.services.filter((s) => !existing.stats.services.some((es) => es.port === s.port)),
            ],
          },
        }

        deviceMap.set(pyDevice.ipAddress, merged)
      } else {
        // Nouvel appareil détecté uniquement par Python
        deviceMap.set(pyDevice.ipAddress, pyDevice)
      }
    })

    return Array.from(deviceMap.values())
  }

  private async enrichDevicesData(devices: Device[]): Promise<Device[]> {
    // Enrichissement supplémentaire des données
    return Promise.all(
      devices.map(async (device) => {
        try {
          // Ajout d'informations de sécurité
          const securityInfo = await this.analyzeDeviceSecurity(device)

          // Mise à jour des statistiques en temps réel
          const realtimeStats = await this.getRealtimeDeviceStats(device.ipAddress)

          return {
            ...device,
            stats: {
              ...device.stats,
              ...realtimeStats,
              // Ajout des informations de sécurité
              ...securityInfo,
            },
          }
        } catch (error) {
          this.enhancedLogger.warn(`[ENRICH] Erreur enrichissement ${device.ipAddress}: ${error.message}`)
          return device
        }
      }),
    )
  }

  private async analyzeDeviceSecurity(device: Device): Promise<any> {
    try {
      const vulnerabilities = []
      const securityScore = 100

      // Analyse des ports ouverts pour détecter les vulnérabilités
      const dangerousPorts = [21, 23, 135, 445, 1433, 3306, 5432]
      const openDangerousPorts = device.stats.services
        .filter((service) => dangerousPorts.includes(service.port))
        .map((service) => service.port)

      if (openDangerousPorts.length > 0) {
        vulnerabilities.push(`Ports dangereux ouverts: ${openDangerousPorts.join(", ")}`)
      }

      // Analyse spécifique Windows
      if (device.os.toLowerCase().includes("windows")) {
        const hasRDP = device.stats.services.some((s) => s.port === 3389)
        const hasSMB = device.stats.services.some((s) => s.port === 445)

        if (hasRDP) {
          vulnerabilities.push("RDP exposé (risque de brute force)")
        }

        if (hasSMB) {
          vulnerabilities.push("SMB exposé (risque EternalBlue)")
        }
      }

      return {
        securityScore: Math.max(0, securityScore - vulnerabilities.length * 20),
        vulnerabilities,
        lastSecurityScan: new Date(),
      }
    } catch (error) {
      this.enhancedLogger.error(`[SECURITY] Erreur analyse sécurité: ${error.message}`)
      return {
        securityScore: 0,
        vulnerabilities: ["Erreur analyse sécurité"],
        lastSecurityScan: new Date(),
      }
    }
  }

  private async getRealtimeDeviceStats(ipAddress: string): Promise<any> {
    try {
      // Test de latence en temps réel
      const latency = await this.measureLatency(ipAddress)

      // Test de bande passante basique
      const bandwidth = await this.testBandwidth(ipAddress)

      return {
        latency,
        bandwidth,
        lastStatsUpdate: new Date(),
      }
    } catch (error) {
      return {
        latency: 999,
        bandwidth: { download: 0, upload: 0 },
        lastStatsUpdate: new Date(),
      }
    }
  }

  private async generateNetworkTopology(devices: Device[]): Promise<NetworkTopologyData> {
    try {
      const connections = []
      const deviceNodes = devices.map((device) => ({
        id: device.id,
        ip: device.ipAddress,
        type: device.deviceType,
        connections: [],
      }))

      // Détection des connexions entre appareils
      for (let i = 0; i < devices.length; i++) {
        for (let j = i + 1; j < devices.length; j++) {
          const device1 = devices[i]
          const device2 = devices[j]

          // Test de connectivité entre les appareils
          const connectionMetrics = await this.testDeviceConnection(device1.ipAddress, device2.ipAddress)

          if (connectionMetrics.isConnected) {
            const connection = {
              source: device1.ipAddress,
              target: device2.ipAddress,
              type: "LAN" as const,
              metrics: {
                bandwidth: connectionMetrics.bandwidth,
                latency: connectionMetrics.latency,
                packetLoss: connectionMetrics.packetLoss,
              },
            }

            connections.push(connection)

            // Ajout aux connexions des nœuds
            deviceNodes[i].connections.push({
              target: device2.ipAddress,
              type: "LAN",
              metrics: connection.metrics,
            })

            deviceNodes[j].connections.push({
              target: device1.ipAddress,
              type: "LAN",
              metrics: connection.metrics,
            })
          }
        }
      }

      // Calcul des statistiques globales
      const stats = {
        totalDevices: devices.length,
        activeDevices: devices.filter((d) => d.stats.status === "active").length,
        averageLatency:
          connections.length > 0
            ? connections.reduce((acc, conn) => acc + conn.metrics.latency, 0) / connections.length
            : 0,
        averagePacketLoss:
          connections.length > 0
            ? connections.reduce((acc, conn) => acc + conn.metrics.packetLoss, 0) / connections.length
            : 0,
        totalBandwidth: {
          download: connections.reduce((acc, conn) => acc + conn.metrics.bandwidth, 0),
          upload: connections.reduce((acc, conn) => acc + conn.metrics.bandwidth * 0.8, 0),
        },
      }

      return {
        devices: deviceNodes,
        connections,
        stats,
      }
    } catch (error) {
      this.enhancedLogger.error(`[TOPOLOGY] Erreur génération topologie: ${error.message}`)
      throw error
    }
  }

  private async testDeviceConnection(
    ip1: string,
    ip2: string,
  ): Promise<{
    isConnected: boolean
    bandwidth: number
    latency: number
    packetLoss: number
  }> {
    try {
      // Test de connectivité basique
      const latency1 = await this.measureLatency(ip1)
      const latency2 = await this.measureLatency(ip2)

      // Si les deux appareils répondent, on considère qu'ils sont connectés
      const isConnected = latency1 < 1000 && latency2 < 1000

      if (!isConnected) {
        return {
          isConnected: false,
          bandwidth: 0,
          latency: 999,
          packetLoss: 100,
        }
      }

      // Estimation de la bande passante basée sur la latence
      const avgLatency = (latency1 + latency2) / 2
      const estimatedBandwidth = Math.max(0, 100 - avgLatency / 10)

      return {
        isConnected: true,
        bandwidth: estimatedBandwidth,
        latency: avgLatency,
        packetLoss: 0,
      }
    } catch (error) {
      return {
        isConnected: false,
        bandwidth: 0,
        latency: 999,
        packetLoss: 100,
      }
    }
  }

  private calculateStatistics(devices: Device[]): any {
    const stats = {
      totalDevices: devices.length,
      activeDevices: devices.filter((d) => d.stats.status === "active").length,
      vulnerableDevices: 0,
      averageResponseTime: 0,
      osDistribution: {} as { [key: string]: number },
      deviceTypes: {} as { [key: string]: number },
      topPorts: {} as { [key: string]: number },
    }

    let totalResponseTime = 0
    let responseTimeCount = 0

    devices.forEach((device) => {
      // Distribution OS
      const os = device.os || "Unknown"
      stats.osDistribution[os] = (stats.osDistribution[os] || 0) + 1

      // Types d'appareils
      const deviceType = device.deviceType || "OTHER"
      stats.deviceTypes[deviceType] = (stats.deviceTypes[deviceType] || 0) + 1

      // Ports les plus ouverts
      device.stats.services.forEach((service) => {
        const portKey = service.port.toString()
        stats.topPorts[portKey] = (stats.topPorts[portKey] || 0) + 1
      })

      // Calcul temps de réponse moyen
      if (device.stats.latency && device.stats.latency > 0) {
        totalResponseTime += device.stats.latency
        responseTimeCount++
      }

      // Comptage appareils vulnérables
      if (device.stats.vulnerabilities && device.stats.vulnerabilities.length > 0) {
        stats.vulnerableDevices++
      }
    })

    stats.averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0

    return stats
  }

  private getPortsFromConfig(config: EnhancedScanConfig): number[] {
    if (config.ports) {
      return config.ports.split(",").map((p) => Number.parseInt(p.trim()))
    }

    // Ports par défaut selon le type de scan
    if (config.deepScan) {
      return [
        21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5432, 5900, 5985, 5986, 8080,
        8443,
      ]
    }

    return [22, 23, 53, 80, 135, 139, 443, 445, 993, 995, 1723, 3389, 5900, 8080]
  }

  private async checkAdminRights(): Promise<boolean> {
    try {
      if (process.platform === "win32") {
        const { stdout } = await execAsync("net session 2>nul")
        return stdout.length > 0
      }
      return process.getuid && process.getuid() === 0
    } catch {
      return false
    }
  }

  private async checkPythonAvailability(): Promise<boolean> {
    try {
      await execAsync("python --version")
      return true
    } catch {
      try {
        await execAsync("python3 --version")
        return true
      } catch {
        return false
      }
    }
  }

  private async checkPowerShellAvailability(): Promise<boolean> {
    try {
      await execAsync('powershell -Command "Get-Host"')
      return true
    } catch {
      return false
    }
  }
}

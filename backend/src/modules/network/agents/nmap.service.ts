import { Injectable, Logger } from "@nestjs/common"
import { exec } from "child_process"
import { promisify } from "util"
import { type Device, type NmapScanConfig, type NmapScanResult, DeviceType, DeviceStatus } from "../device.model"
import { v4 as uuidv4 } from "uuid"
import * as os from "os"
import * as snmp from "net-snmp"
import { sequelize } from "../../../database"
import { QueryTypes } from "sequelize"
import { AppareilRepository } from "../appareil.repository"
import { OuiService } from "../services/oui.service"
import { DeviceTypeService } from "../services/device-type.service"
import pLimit from 'p-limit';
import { NETWORK_TIMEOUTS } from '../../../config/network.config'
// Supprimer l'import ipaddr.js
// Ajouter la fonction utilitaire IPv4 CIDR
function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0)
}
function isIPv4InCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/')
  const ipNum = ipToInt(ip)
  const rangeNum = ipToInt(range)
  const mask = ~(2 ** (32 - Number(bits)) - 1)
  return (ipNum & mask) === (rangeNum & mask)
}

const execAsync = promisify(exec)

interface NetworkStats {
  bandwidth: number
  latency: number
  packetLoss: number
  cpuUsage: number
  memoryUsage: number
}

interface SNMPConfig {
  community: string
  version: "1" | "2c" | "2"
  timeout: number
  retries: number
}

// Declaration des types pour net-snmp
declare module "net-snmp" {
  export function createSession(target: string, community: string, options?: any): Session

  interface Session {
    get(oids: string[], callback: (error: Error | null, varbinds: any[]) => void): void
    close(): void
  }
}

// Ajout d'un cache en mémoire pour retenir la communauté SNMP fonctionnelle par IP
const snmpCommunityCache: { [ip: string]: string } = {}

@Injectable()
export class NmapAgentService {
  private readonly logger = new Logger(NmapAgentService.name)
  private readonly snmpConfig: SNMPConfig = {
    community: "public",
    version: "2",
    timeout: 5000,
    retries: 1,
  }

  constructor(
    private readonly appareilRepository: AppareilRepository,
    private readonly ouiService: OuiService,
    private readonly deviceTypeService: DeviceTypeService,
  ) {}

  async execute(config: NmapScanConfig, userId?: string): Promise<NmapScanResult> {
    const startTime = Date.now()
    const actionId = uuidv4()

    try {
      // Enregistrement de l'action dans l'historique
      await this.logAction(actionId, userId, "network_scan_start", "Démarrage du scan réseau")

      // Verification des outils necessaires
      const tools = await this.checkRequiredTools()
      if (!tools.allInstalled) {
        const error = new Error(`Outils manquants: ${tools.missing.join(", ")}`)
        await this.saveErrorLog("system", error, "checkRequiredTools")
        throw error
      }

      // 1. Scan rapide du reseau local uniquement
      await this.logAction(actionId, userId, "network_scan", `Scan du réseau ${config.target}`)
      const nmapDevices = await this.executeQuickScan(config.target, config.deepMode, config.customPorts)
      this.logger.log(`[SCAN] Appareils trouves: ${nmapDevices.length}`)

      // 2. Enrichissement des informations de base
      const enrichedDevices = await this.enrichBasicInfo(nmapDevices)
      await this.logAction(actionId, userId, "network_scan", `${enrichedDevices.length} appareils enrichis`)

      // 3. CRITIQUE: Upsert de tous les appareils AVANT de collecter les statistiques
      const upsertedIds = await this.appareilRepository.upsertMany(enrichedDevices)
      const savedDevices: Device[] = enrichedDevices.map((d, i) => ({ ...d, id: upsertedIds[i] || d.id }))

      // 4. Collecte des statistiques pour chaque appareil SAUVEGARDÉ
      for (const device of savedDevices) {
        try {
          const networkStats = await this.collectNetworkStatsWithSNMP(device.ipAddress)
          // Propagation du message d'erreur dans Device.stats
          device.stats = {
            ...device.stats,
            cpu: networkStats.cpuUsage ?? 0,
            memory: networkStats.memoryUsage ?? 0,
            bandwidth: typeof networkStats.bandwidth === 'object' ? networkStats.bandwidth : { download: networkStats.bandwidth ?? 0, upload: 0 },
            latency: networkStats.latency ?? 0,
            lastStatsError: networkStats.lastStatsError,
          }
          await this.saveNetworkStats(device.id, networkStats)
          await this.logAction(actionId, userId, "device_stats_collected", `Stats collectées pour ${device.ipAddress}`)
          await this.saveScanLogs(device)
        } catch (error) {
          await this.saveErrorLog(device.id, error, "deviceProcessing")
          this.logger.error(`[SCAN] Erreur traitement appareil ${device.ipAddress}: ${error.message}`)
        }
      }

      await this.logAction(
        actionId,
        userId,
        "network_scan_complete",
        `Scan terminé. ${savedDevices.length} appareils trouvés en ${Date.now() - startTime}ms`,
      )

      return {
        success: true,
        devices: savedDevices,
        scanTime: new Date(),
        scanDuration: Date.now() - startTime,
      }
    } catch (error) {
      await this.saveErrorLog("system", error, "execute")
      this.logger.error(`[SCAN] Erreur scan: ${error.message}`)
      return {
        success: false,
        devices: [],
        error: error.message,
        scanTime: new Date(),
        scanDuration: Date.now() - startTime,
      }
    }
  }

  private async logAction(actionId: string, userId: string | undefined, action: string, detail: string): Promise<void> {
    try {
      // Si pas d'ID utilisateur, on ne log pas l'action
      if (!userId) {
        this.logger.debug(`[HISTORIQUE] Pas d'ID utilisateur, action non loggee: ${action}`)
        return
      }

      // Pour les scans automatiques, on ne log pas dans l'historique
      if (userId === "system-auto-scan") {
        this.logger.debug(`[HISTORIQUE] Scan automatique, action non loggee: ${action}`)
        return
      }

      // Enregistrement uniquement des actions utilisateur dans l'historique
      if (action.startsWith("network_scan") || action === "device_stats_collected") {
        await sequelize.query(
          `INSERT INTO historiques (
            id, userId, action, targetType, targetId,
            timestamp, detail, ipAddress
          ) VALUES (
            :id, :userId, :action, 'network', :targetId,
            CURRENT_TIMESTAMP, :detail, :ipAddress
          )`,
          {
            replacements: {
              id: uuidv4(),
              userId, // Utilisation directe de l'ID utilisateur
              action,
              targetId: actionId,
              detail,
              ipAddress: this.getLocalIP(),
            },
            type: QueryTypes.INSERT,
          },
        )
      }
    } catch (error) {
      this.logger.error(`[HISTORIQUE] Erreur enregistrement action: ${error.message}`)
    }
  }

  private async checkRequiredTools(): Promise<{ allInstalled: boolean; missing: string[] }> {
    const tools = ["nmap", "ping"]
    const missing: string[] = []

    for (const tool of tools) {
      try {
        if (tool === "nmap") {
          await execAsync("nmap --version")
        } else if (tool === "ping") {
          await execAsync("ping -n 1 127.0.0.1")
        }
      } catch (error) {
        missing.push(tool)
      }
    }

    return {
      allInstalled: missing.length === 0,
      missing,
    }
  }

  private getOptimizedPorts(deepMode: boolean, customPorts?: string | number[]): string {
    // Liste discriminante rapide
    const fastPorts = [22, 80, 443, 445, 3389, 515, 9100, 161, 8080];
    // Liste plus large pour le mode complet
    const fullPorts = [21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 993, 995, 1723, 3306, 3389, 5900, 8080, 515, 9100, 161];
    if (customPorts) {
      if (Array.isArray(customPorts)) return customPorts.join(',');
      if (typeof customPorts === 'string') return customPorts;
    }
    return (deepMode ? fullPorts : fastPorts).join(',');
  }

  // Ajout d'un paramètre optionnel pour le mode (rapide/complet)
  private async executeQuickScan(network: string, deepMode = false, customPorts?: string | number[]): Promise<Device[]> {
    try {
      this.logger.log(`[SCAN] Démarrage scan du réseau: ${network}`);
      const isWindows = os.platform() === "win32";
      const mode = deepMode ? 'complet' : 'rapide';
      const { hostTimeout, maxRetries, timing } = NETWORK_TIMEOUTS.nmap[mode];
      const ports = this.getOptimizedPorts(deepMode, customPorts);
      let nmapCommand: string;
      nmapCommand = `nmap -sn -PE -PP -PS${ports} -PA${ports} -T5 --min-parallelism 100 --max-parallelism 256 --max-retries 1 --host-timeout 500ms ${network}`;
      this.logger.log(`[SCAN] Commande nmap: ${nmapCommand}`);
      const { stdout, stderr } = await execAsync(nmapCommand);
      this.logger.log(`[SCAN] Sortie nmap (${stdout.length} caractères):`);
      this.logger.log(`[SCAN] ${stdout.substring(0, 500)}...`);
      if (stderr) {
        this.logger.warn(`[SCAN] Stderr nmap: ${stderr}`);
      }
      let devices = this.parseNmapOutput(stdout, network);
      this.logger.log(`[SCAN] Appareils trouvés après scan ping: ${devices.length}`);
      if (devices.length <= 1) {
        this.logger.log(`[SCAN] Peu d'appareils trouvés, tentative de scan de ports...`);
        const portScanDevices = await this.executePortScan(network, deepMode, customPorts);
        this.logger.log(`[SCAN] Appareils trouvés après scan de ports: ${portScanDevices.length}`);
        const allDevices = [...devices];
        for (const portDevice of portScanDevices) {
          if (!allDevices.find(d => d.ipAddress === portDevice.ipAddress)) {
            allDevices.push(portDevice);
          }
        }
        devices = allDevices;
      }
      if (devices.length <= 1) {
        this.logger.log(`[SCAN] Peu d'appareils trouvés, tentative de scan ARP...`);
        const arpDevices = await this.executeArpScan(network);
        this.logger.log(`[SCAN] Appareils trouvés après scan ARP: ${arpDevices.length}`);
        const allDevices = [...devices];
        for (const arpDevice of arpDevices) {
          if (!allDevices.find(d => d.ipAddress === arpDevice.ipAddress)) {
            allDevices.push(arpDevice);
          }
        }
        devices = allDevices;
      }
      this.logger.log(`[SCAN] Total appareils trouvés: ${devices.length}`);
      return devices;
    } catch (error) {
      this.logger.error(`[SCAN] Erreur scan nmap: ${error.message}`);
      return [];
    }
  }

  private async executePortScan(network: string, deepMode = false, customPorts?: string | number[]): Promise<Device[]> {
    try {
      this.logger.log(`[SCAN] Démarrage scan de ports du réseau: ${network}`);
      const isWindows = os.platform() === "win32";
      const mode = deepMode ? 'complet' : 'rapide';
      const { hostTimeout, maxRetries, timing } = NETWORK_TIMEOUTS.nmap[mode];
      const ports = this.getOptimizedPorts(deepMode, customPorts);
      const nmapCommand = `nmap -sS -p ${ports} -T5 --min-parallelism 100 --max-parallelism 256 --max-retries 1 --host-timeout 500ms ${network}`;
      this.logger.log(`[SCAN] Commande scan de ports: ${nmapCommand}`);
      const { stdout, stderr } = await execAsync(nmapCommand);
      if (stderr) {
        this.logger.warn(`[SCAN] Stderr scan de ports: ${stderr}`);
      }
      const devices = this.parseNmapPortScanOutput(stdout);
      this.logger.log(`[SCAN] Appareils trouvés par scan de ports: ${devices.length}`);
      return devices;
    } catch (error) {
      this.logger.error(`[SCAN] Erreur scan de ports: ${error.message}`);
      return [];
    }
  }

  private async executeArpScan(network: string): Promise<Device[]> {
    try {
      this.logger.log(`[SCAN] Démarrage scan ARP du réseau: ${network}`)
      
      const isWindows = os.platform() === "win32"
      const devices: Device[] = []
      
      // Extraire la plage d'IPs du réseau
      const networkParts = network.split('.')
      const baseIP = networkParts.slice(0, 3).join('.')
      
      // Scanner les IPs de 1 à 254
      for (let i = 1; i <= 254; i++) {
        const ip = `${baseIP}.${i}`
        
        try {
          if (isWindows) {
            // Windows: utiliser arp -a
            const { stdout } = await execAsync(`arp -a ${ip}`)
            const macMatch = stdout.match(/([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})/i)
            
            if (macMatch && this.isValidDeviceIP(ip, network)) {
              this.logger.log(`[SCAN] Appareil trouvé par ARP: ${ip} (MAC: ${macMatch[1]})`)
              devices.push({
                id: uuidv4(),
                hostname: ip,
                ipAddress: ip,
                macAddress: macMatch[1].replace(/-/g, ":"),
                os: "Unknown",
                deviceType: DeviceType.OTHER,
                stats: {
                  cpu: 0,
                  memory: 0,
                  uptime: "0",
                  status: DeviceStatus.ACTIVE,
                  services: [],
                },
                lastSeen: new Date(),
                firstDiscovered: new Date(),
              })
            }
          } else {
            // Linux/Mac: utiliser ping + arp
            await execAsync(`ping -c 1 -W 1 ${ip}`)
            const { stdout } = await execAsync(`arp -n ${ip}`)
            const macMatch = stdout.match(/([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i)
            
            if (macMatch && this.isValidDeviceIP(ip, network)) {
              this.logger.log(`[SCAN] Appareil trouvé par ARP: ${ip} (MAC: ${macMatch[1]})`)
              devices.push({
                id: uuidv4(),
                hostname: ip,
                ipAddress: ip,
                macAddress: macMatch[1],
                os: "Unknown",
                deviceType: DeviceType.OTHER,
                stats: {
                  cpu: 0,
                  memory: 0,
                  uptime: "0",
                  status: DeviceStatus.ACTIVE,
                  services: [],
                },
                lastSeen: new Date(),
                firstDiscovered: new Date(),
              })
            }
          }
        } catch (error) {
          // Ignorer les erreurs pour les IPs non répondues
          continue
        }
      }
      
      this.logger.log(`[SCAN] Appareils trouvés par scan ARP: ${devices.length}`)
      return devices
    } catch (error) {
      this.logger.error(`[SCAN] Erreur scan ARP: ${error.message}`)
      return []
    }
  }

  public async enrichBasicInfo(devices: Device[]): Promise<Device[]> {
    const limit = pLimit(5); // Limite à 5 enrichissements en parallèle
    const start = Date.now();
    this.logger.log(`[ENRICH] Début enrichissement de ${devices.length} devices (max 5 en parallèle)`);
    const enrichedDevices = await Promise.all(
      devices.map(device => limit(async () => {
        try {
          // 1. MAC address (ARP)
          let macAddress = device.macAddress
          if (!macAddress) {
            const mac = await this.getMACAddress(device.ipAddress)
            if (mac) {
              macAddress = mac
              this.logger.debug(`[ENRICH] MAC enrichi via ARP pour ${device.ipAddress}: ${mac}`)
            }
          }
          // 2. Hostname (DNS)
          let hostname = device.hostname
          if (!hostname || hostname === device.ipAddress) {
            const dnsName = await this.getHostname(device.ipAddress)
            if (dnsName && dnsName !== device.ipAddress) {
              hostname = dnsName
              this.logger.debug(`[ENRICH] Hostname enrichi via DNS pour ${device.ipAddress}: ${dnsName}`)
            }
          }
          // 3. OS (Nmap)
          let os = device.os
          if (!os || os === 'Unknown') {
            os = await this.getOSFromNmap(device.ipAddress) || os
            if (os && os !== 'Unknown') {
              this.logger.debug(`[ENRICH] OS enrichi via Nmap pour ${device.ipAddress}: ${os}`)
            }
          }
          // 3.5. Scan de ports rapide pour améliorer la détection de type
          let openPorts: number[] = []
          if (!device.stats.services || device.stats.services.length === 0) {
            try {
              openPorts = await this.getOpenPorts(device.ipAddress)
              this.logger.debug(`[ENRICH] Ports ouverts détectés pour ${device.ipAddress}: ${openPorts.join(', ')}`)
            } catch (error) {
              this.logger.debug(`[ENRICH] Erreur scan ports pour ${device.ipAddress}: ${error.message}`)
            }
          } else {
            openPorts = device.stats.services.map(s => s.port)
          }
          // 4. Type d'appareil via service centralisé (APRÈS enrichissement OS/hostname/ports)
          let deviceType = device.deviceType
          if (macAddress) {
            const detectionResult = this.deviceTypeService.detectDeviceType({
              macAddress,
              openPorts: openPorts,
              hostname: hostname, // ← Utiliser le hostname enrichi
              os: os              // ← Utiliser l'OS enrichi
            })
            deviceType = detectionResult.deviceType
            this.logger.debug(`[ENRICH] Type d'appareil détecté pour ${device.ipAddress}: ${deviceType} (méthode: ${detectionResult.method}, confiance: ${detectionResult.confidence})`)
          }
          // 5. Fusion intelligente
          const enrichedDevice: Device = {
            ...device,
            hostname: hostname || device.hostname,
            macAddress: macAddress || device.macAddress,
            os: os || device.os,
            deviceType: deviceType || device.deviceType,
            stats: {
              ...device.stats,
              services: openPorts.length > 0 ? openPorts.map(port => ({
                port,
                protocol: 'tcp' as const,
                service: this.getServiceName(port)
              })) : device.stats.services
            },
            lastSeen: new Date(),
            firstDiscovered: device.firstDiscovered || new Date(),
          }
          return enrichedDevice
        } catch (error) {
          this.logger.error(`[SCAN] Erreur enrichissement info ${device.ipAddress}: ${error.message}`)
          return device
        }
      }))
    );
    const duration = Date.now() - start;
    this.logger.log(`[ENRICH] Enrichissement terminé (${devices.length} devices) en ${duration} ms.`);
    return enrichedDevices;
  }

  /**
   * Récupère les ports ouverts pour une IP donnée
   */
  private async getOpenPorts(ipAddress: string, deepMode = false, customPorts?: string | number[]): Promise<number[]> {
    try {
      const isWindows = os.platform() === "win32";
      const mode = deepMode ? 'complet' : 'rapide';
      const { hostTimeout, maxRetries, timing } = NETWORK_TIMEOUTS.nmap[mode];
      const ports = this.getOptimizedPorts(deepMode, customPorts);
      const nmapCommand = `nmap -sS -p ${ports} -T5 --min-parallelism 100 --max-parallelism 256 --max-retries 1 --host-timeout 500ms ${ipAddress}`;
      const { stdout } = await execAsync(nmapCommand);
      const openPorts: number[] = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        const portMatch = line.match(/(\d+)\/(tcp|udp)\s+(open|filtered)/);
        if (portMatch) {
          const port = parseInt(portMatch[1]);
          const status = portMatch[3];
          if (status === 'open') {
            openPorts.push(port);
          }
        }
      }
      return openPorts;
    } catch (error) {
      this.logger.debug(`[PORTS] Erreur scan ports ${ipAddress}: ${error.message}`);
      return [];
    }
  }

  /**
   * Retourne le nom du service pour un port donné
   */
  private getServiceName(port: number): string {
    const serviceMap: Record<number, string> = {
      21: 'ftp',
      22: 'ssh',
      23: 'telnet',
      25: 'smtp',
      53: 'dns',
      80: 'http',
      110: 'pop3',
      111: 'rpcbind',
      135: 'msrpc',
      139: 'netbios-ssn',
      143: 'imap',
      443: 'https',
      993: 'imaps',
      995: 'pop3s',
      1723: 'pptp',
      3306: 'mysql',
      3389: 'ms-wbt-server',
      5900: 'vnc',
      8080: 'http-proxy'
    }
    return serviceMap[port] || 'unknown'
  }

  private async getMACAddress(ip: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`arp -a ${ip}`)
      const macMatch = stdout.match(
        /([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})/i,
      )
      return macMatch ? macMatch[1].replace(/-/g, ":") : ""
    } catch (error) {
      this.logger.error(`[SCAN] Erreur recuperation MAC ${ip}: ${error.message}`)
      return ""
    }
  }

  private async getHostname(ipAddress: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`nslookup ${ipAddress}`)
      const match = stdout.match(/Name:\s*(.+)/)
      return match ? match[1].trim() : ipAddress
    } catch (error) {
      return ipAddress
    }
  }

  private detectDeviceType(macAddress: string): DeviceType {
    if (!macAddress) return DeviceType.OTHER

    const detectionResult = this.deviceTypeService.detectDeviceType({
      macAddress
    })
    
    return detectionResult.deviceType
  }

  private parseNmapOutput(stdout: string, cidr: string): Device[] {
    const devices: Device[] = []
    const lines = stdout.split("\n")
    
    this.logger.log(`[SCAN] Parsing de ${lines.length} lignes de sortie nmap`)

    for (const line of lines) {
      // Recherche d'IPs avec différents patterns
      const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/)
      
      if (ipMatch) {
        const ip = ipMatch[1]
        
        // Vérification que ce n'est pas localhost ni broadcast
        if (this.isValidDeviceIP(ip, cidr)) {
          this.logger.log(`[SCAN] IP trouvée: ${ip}`)
          
          // Recherche d'informations supplémentaires dans la ligne
          let hostname = ip
          let status = "up"
          
          // Extraction du hostname si présent
          const hostnameMatch = line.match(/\(([^)]+)\)/)
          if (hostnameMatch) {
            hostname = hostnameMatch[1]
          }
          
          // Vérification du statut
          if (line.toLowerCase().includes("down") || line.toLowerCase().includes("filtered")) {
            status = "down"
          }
          
        devices.push({
          id: uuidv4(),
            hostname: hostname,
            ipAddress: ip,
          macAddress: "",
          os: "Unknown",
          deviceType: DeviceType.OTHER,
          stats: {
            cpu: 0,
            memory: 0,
            uptime: "0",
              status: status === "up" ? DeviceStatus.ACTIVE : DeviceStatus.INACTIVE,
            services: [],
          },
          lastSeen: new Date(),
          firstDiscovered: new Date(),
        })
        }
      }
    }

    this.logger.log(`[SCAN] Total appareils parsés: ${devices.length}`)
    return devices
  }

  private isLocalhost(ip: string): boolean {
    return ip === "127.0.0.1" || ip === "::1" || ip === this.getLocalIP()
  }

  // Ajout des fonctions utilitaires pour le filtrage
  private isMulticast(ip: string): boolean {
    const first = Number(ip.split('.')[0])
    return first >= 224 && first <= 239
  }

  private isAPIPA(ip: string): boolean {
    return ip.startsWith("169.254.")
  }

  private isInCIDR(ip: string, cidr: string): boolean {
    // Utilise la fonction maison IPv4
    return isIPv4InCIDR(ip, cidr)
  }

  private isBroadcast(ip: string, cidr?: string): boolean {
    const parts = ip.split('.')
    if (parts.length === 4 && parts[3] === '255') return true
    if (ip === '255.255.255.255' || ip === '0.0.0.0') return true
    if (cidr) {
      try {
        const [base, mask] = cidr.split('/')
        const baseParts = base.split('.').map(Number)
        const maskNum = parseInt(mask, 10)
        if (maskNum >= 24 && parts.length === 4) {
          const broadcast = [...baseParts]
          broadcast[3] = 255
          if (ip === broadcast.join('.')) return true
        }
      } catch {}
    }
    return false
  }

  private isValidDeviceIP(ip: string, cidr: string): boolean {
    return (
      !this.isLocalhost(ip) &&
      !this.isBroadcast(ip, cidr) &&
      !this.isMulticast(ip) &&
      !this.isAPIPA(ip) &&
      this.isInCIDR(ip, cidr)
    )
  }

  private getLocalIP(): string {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address
        }
      }
    }
    return "127.0.0.1"
  }

  public async collectNetworkStatsWithSNMP(ip: string): Promise<NetworkStats & { lastStatsError?: string }> {
    // Liste des communautés à tester
    const communities = snmpCommunityCache[ip]
      ? [snmpCommunityCache[ip], "public", "private", "community", "public1"]
      : ["public", "private", "community", "public1"]
    let lastError = ""
    for (const community of communities) {
      try {
        const session = snmp.createSession(ip, community, {
          version: this.snmpConfig.version,
          timeout: this.snmpConfig.timeout,
          retries: this.snmpConfig.retries,
        })
        const oids = [
          "1.3.6.1.2.1.25.3.3.1.2.1", // CPU usage
          "1.3.6.1.2.1.25.2.3.1.6.1", // Memory usage
          "1.3.6.1.2.1.2.2.1.10.1", // Interface in octets
          "1.3.6.1.2.1.2.2.1.16.1", // Interface out octets
        ]
        // Promisify SNMP get
        const snmpGet = () => new Promise<any[]>((resolve, reject) => {
          session.get(oids, (error, varbinds) => {
            session.close()
            if (error) reject(error)
            else resolve(varbinds)
          })
        })
        const varbinds = await snmpGet()
        // Si on arrive ici, la communauté fonctionne
        snmpCommunityCache[ip] = community
        const [cpu, memory, inOctets, outOctets] = varbinds.map((v) => v.value)
        // Mesure de la latence en complément
        const { stdout: pingOutput } = await execAsync(`ping -n 1 ${ip}`)
        const latency = this.parsePingLatency(pingOutput)
        const packetLoss = this.parsePingPacketLoss(pingOutput)
        return {
          cpuUsage: cpu || 0,
          memoryUsage: memory || 0,
          bandwidth: inOctets + outOctets || 0,
          latency,
          packetLoss,
          lastStatsError: undefined,
        }
      } catch (error) {
        lastError = error.message
        continue
      }
    }
    // Si aucune communauté ne fonctionne, fallback ping
    this.logger.log(`[SNMP] SNMP indisponible pour ${ip} (testé: ${communities.join(", ")}), fallback ping utilisé: ${lastError}`)
    try {
      const stats = await this.collectNetworkStats(ip)
      return { ...stats, lastStatsError: `[SNMP] ${lastError}` }
    } catch (err) {
      this.logger.log(`[SNMP] Fallback ping aussi indisponible pour ${ip}: ${err.message}`)
      return {
        bandwidth: 0,
        latency: 0,
        packetLoss: 100,
        cpuUsage: 0,
        memoryUsage: 0,
        lastStatsError: `[SNMP+PING] ${lastError} / ${err.message}`,
      }
    }
  }

  private async collectNetworkStats(ip: string): Promise<NetworkStats> {
    try {
      // Mesure de la latence et perte de paquets
      const { stdout: pingOutput } = await execAsync(`ping -n 4 ${ip}`)
      const latency = this.parsePingLatency(pingOutput)
      const packetLoss = this.parsePingPacketLoss(pingOutput)

      // Mesure de la bande passante (simplifiee)
      const bandwidth = await this.measureBandwidth(ip)

      // Mesure CPU et memoire (simplifiee)
      const { cpuUsage, memoryUsage } = await this.measureResourceUsage(ip)

      return {
        bandwidth,
        latency,
        packetLoss,
        cpuUsage,
        memoryUsage,
      }
    } catch (error) {
      this.logger.error(`[SCAN] Erreur collecte stats ${ip}: ${error.message}`)
      return {
        bandwidth: 0,
        latency: 0,
        packetLoss: 100,
        cpuUsage: 0,
        memoryUsage: 0,
      }
    }
  }

  public async saveNetworkStats(deviceId: string, stats: NetworkStats): Promise<void> {
    try {
      await sequelize.query(
        `INSERT INTO statistiques_reseau (
          id, deviceId, bandwidth, latency, packetLoss,
          cpuUsage, memoryUsage, timestamp, intervalLabel
        ) VALUES (
          :id, :deviceId, :bandwidth, :latency, :packetLoss,
          :cpuUsage, :memoryUsage, CURRENT_TIMESTAMP, '1m'
        )`,
        {
          replacements: {
            id: uuidv4(),
            deviceId,
            ...stats,
          },
          type: QueryTypes.INSERT,
        },
      )
    } catch (error) {
      this.logger.error(`[SCAN] Erreur sauvegarde stats ${deviceId}: ${error.message}`)
    }
  }

  private async saveErrorLog(deviceId: string, error: Error, context: string): Promise<void> {
    try {
      await sequelize.query(
        `INSERT INTO journaux (
          id, deviceId, port, protocol, timestamp,
          rawData, parsedData, logType, severity
        ) VALUES (
          :id, :deviceId, NULL, 'error', CURRENT_TIMESTAMP,
          :rawData, :parsedData, 'error', 'error'
        )`,
        {
          replacements: {
            id: uuidv4(),
            deviceId,
            rawData: JSON.stringify({
              error: error.message,
              stack: error.stack,
              context,
              timestamp: new Date(),
            }),
            parsedData: JSON.stringify({
              errorType: error.name,
              message: error.message,
              context,
            }),
          },
          type: QueryTypes.INSERT,
        },
      )
    } catch (err) {
      this.logger.error(`[JOURNAL] Erreur sauvegarde log erreur: ${err.message}`)
    }
  }

  public async saveScanLogs(device: Device): Promise<void> {
    try {
      await sequelize.query(
        `INSERT INTO journaux (
          id, deviceId, port, protocol, timestamp,
          rawData, parsedData, logType, severity
        ) VALUES (
          :id, :deviceId, NULL, 'scan', CURRENT_TIMESTAMP,
          :rawData, :parsedData, 'network_scan', 'info'
        )`,
        {
          replacements: {
            id: uuidv4(),
            deviceId: device.id,
            rawData: JSON.stringify({
              scanType: "quick",
              scanTime: new Date(),
              deviceInfo: {
                ip: device.ipAddress,
                mac: device.macAddress,
                type: device.deviceType,
                os: device.os,
              },
              technicalDetails: {
                services: device.stats.services,
              },
            }),
            parsedData: JSON.stringify({
              status: device.stats.status,
              deviceType: device.deviceType,
              scanResult: "success",
              metrics: {
                cpu: device.stats.cpu,
                memory: device.stats.memory,
                uptime: device.stats.uptime,
              },
            }),
          },
          type: QueryTypes.INSERT,
        },
      )
    } catch (error) {
      await this.saveErrorLog(device.id, error, "saveScanLogs")
    }
  }

  private parsePingLatency(pingOutput: string): number {
    try {
      const match = pingOutput.match(/Average = (\d+)ms/)
      return match ? Number.parseInt(match[1]) : 0
    } catch {
      return 0
    }
  }

  private parsePingPacketLoss(pingOutput: string): number {
    try {
      const match = pingOutput.match(/(\d+)% loss/)
      return match ? Number.parseInt(match[1]) : 100
    } catch {
      return 100
    }
  }

  private async measureBandwidth(ip: string): Promise<number> {
    try {
      // Simulation simple de mesure de bande passante
      const startTime = Date.now()
      await execAsync(`ping -n 1 -l 1024 ${ip}`)
      const duration = Date.now() - startTime
      // Calcul simplifie: 1KB / duration en ms
      return duration > 0 ? (1024 / duration) * 1000 : 0
    } catch {
      return 0
    }
  }

  private async measureResourceUsage(ip: string): Promise<{ cpuUsage: number; memoryUsage: number }> {
    try {
      const session = snmp.createSession(ip, this.snmpConfig.community, {
        version: this.snmpConfig.version,
        timeout: this.snmpConfig.timeout,
        retries: this.snmpConfig.retries,
      })

      const oids = [
        "1.3.6.1.2.1.25.3.3.1.2.1", // CPU usage
        "1.3.6.1.2.1.25.2.3.1.6.1", // Memory usage
      ]

      return new Promise((resolve, reject) => {
        session.get(oids, (error, varbinds) => {
          session.close()

          if (error) {
            this.logger.warn(`[SNMP] Erreur ressources ${ip}: ${error.message}`)
            resolve({ cpuUsage: 0, memoryUsage: 0 })
            return
          }

          resolve({
            cpuUsage: varbinds[0].value || 0,
            memoryUsage: varbinds[1].value || 0,
          })
        })
      })
    } catch (error) {
      this.logger.error(`[SNMP] Erreur session ressources ${ip}: ${error.message}`)
      return { cpuUsage: 0, memoryUsage: 0 }
    }
  }

  private parseNmapPortScanOutput(stdout: string): Device[] {
    const devices: Device[] = []
    const lines = stdout.split("\n")
    
    this.logger.log(`[SCAN] Parsing scan de ports: ${lines.length} lignes`)

    let currentIP = ""
    let currentHostname = ""
    let currentPorts: string[] = []

    for (const line of lines) {
      // Recherche d'une nouvelle IP
      const ipMatch = line.match(/Nmap scan report for ([^\s]+)/)
      if (ipMatch) {
        // Sauvegarder l'appareil précédent s'il existe
        if (currentIP && this.isValidDeviceIP(currentIP, currentIP)) { // This line was not in the edit, but should be changed for consistency
          this.logger.log(`[SCAN] Appareil trouvé par scan de ports: ${currentIP} (ports: ${currentPorts.join(', ')})`)
          devices.push({
            id: uuidv4(),
            hostname: currentHostname || currentIP,
            ipAddress: currentIP,
            macAddress: "",
            os: "Unknown",
            deviceType: DeviceType.OTHER,
            stats: {
              cpu: 0,
              memory: 0,
              uptime: "0",
              status: DeviceStatus.ACTIVE,
              services: currentPorts.map(port => ({ port: parseInt(port), service: "unknown", protocol: "tcp" })),
            },
            lastSeen: new Date(),
            firstDiscovered: new Date(),
          })
        }
        
        // Nouvelle IP
        const target = ipMatch[1]
        if (target.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
          currentIP = target
          currentHostname = target
        } else {
          // Hostname trouvé, extraire l'IP
          const ipInLine = line.match(/\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)/)
          if (ipInLine) {
            currentIP = ipInLine[1]
            currentHostname = target
          }
        }
        currentPorts = []
        continue
      }

      // Recherche de ports ouverts
      const portMatch = line.match(/(\d+)\/(\w+)\s+(\w+)/)
      if (portMatch && currentIP) {
        const port = portMatch[1]
        const state = portMatch[3]
        if (state === "open") {
          currentPorts.push(port)
        }
      }
    }

    // Sauvegarder le dernier appareil
    if (currentIP && this.isValidDeviceIP(currentIP, currentIP)) { // This line was not in the edit, but should be changed for consistency
      this.logger.log(`[SCAN] Dernier appareil trouvé par scan de ports: ${currentIP} (ports: ${currentPorts.join(', ')})`)
      devices.push({
        id: uuidv4(),
        hostname: currentHostname || currentIP,
        ipAddress: currentIP,
        macAddress: "",
        os: "Unknown",
        deviceType: DeviceType.OTHER,
        stats: {
          cpu: 0,
          memory: 0,
          uptime: "0",
          status: DeviceStatus.ACTIVE,
          services: currentPorts.map(port => ({ port: parseInt(port), service: "unknown", protocol: "tcp" })),
        },
        lastSeen: new Date(),
        firstDiscovered: new Date(),
      })
    }

    this.logger.log(`[SCAN] Total appareils trouvés par scan de ports: ${devices.length}`)
    return devices
  }

  private async getOSFromNmap(ip: string): Promise<string> {
    try {
      const ports = [22, 23, 80, 135, 139, 443, 445, 515, 548, 631, 9100, 3389, 554, 8080, 8888, 1900]
      const openPorts: number[] = []
      const banners: Record<number, string> = {}
      const net = require('net')
      const timeout = 1000
      for (const port of ports) {
        await new Promise<void>(resolve => {
          const socket = new net.Socket()
          let banner = ''
          let isOpen = false
          socket.setTimeout(timeout)
          socket.connect(port, ip, () => {
            isOpen = true
          })
          socket.on('data', (data: Buffer) => {
            banner += data.toString('utf8')
            socket.destroy()
          })
          socket.on('timeout', () => {
            socket.destroy()
          })
          socket.on('error', () => {
            socket.destroy()
          })
          socket.on('close', () => {
            if (isOpen) {
              openPorts.push(port)
              if (banner) banners[port] = banner.slice(0, 100)
            }
            resolve()
          })
        })
      }
      let ttl = 0
      try {
        const { stdout } = await execAsync(`ping -n 1 -w 1000 ${ip}`)
        const ttlMatch = stdout.match(/TTL=(\d+)/i)
        if (ttlMatch) ttl = parseInt(ttlMatch[1], 10)
      } catch {}
      const hostname = await this.getHostname(ip)
      const mac = await this.getMACAddress(ip)
      let macVendor = ''
      if (mac) {
        const oui = mac.slice(0, 8).toUpperCase()
        if (oui.startsWith('00:1A:2B') || oui.startsWith('00:50:56')) macVendor = 'Cisco/VMware'
        else if (oui.startsWith('B8:27:EB') || oui.startsWith('DC:A6:32')) macVendor = 'Raspberry Pi'
        else if (oui.startsWith('00:1B:63') || oui.startsWith('00:1C:B3')) macVendor = 'Apple'
        else if (oui.startsWith('00:1A:79')) macVendor = 'Router'
        else if (oui.startsWith('00:1D:7D') || oui.startsWith('00:1F:5B')) macVendor = 'Desktop'
        else if (oui.startsWith('00:1E:8C') || oui.startsWith('00:1F:3F')) macVendor = 'Mobile'
        else if (oui.startsWith('00:80:77') || oui.startsWith('00:21:5C')) macVendor = 'HP/Printer'
      }
      let score: Record<string, number> = { Windows: 0, Linux: 0, Mac: 0, Printer: 0, IoT: 0 }
      if (openPorts.some(p => [135, 139, 445, 3389, 5985, 5986].includes(p))) score.Windows += 3
      if (openPorts.includes(22)) score.Linux += 2
      if (openPorts.includes(548)) score.Mac += 2
      if (openPorts.some(p => [9100, 515, 631].includes(p))) score.Printer += 3
      if (openPorts.some(p => [80, 443, 23, 554, 8080, 8888, 1900].includes(p))) score.IoT += 1
      if (ttl >= 120 && ttl <= 130) score.Windows += 2
      if (ttl >= 60 && ttl <= 70) score.Linux += 2
      if (ttl >= 240) score.Printer += 1
      if (banners[22]?.toLowerCase().includes('openssh')) score.Linux += 3
      if (banners[3389]?.toLowerCase().includes('rdp')) score.Windows += 2
      if (banners[9100]?.toLowerCase().includes('hp')) score.Printer += 2
      if (hostname.match(/router|box|tplink|dlink/i)) score.IoT += 2
      if (hostname.match(/hp|canon|epson|brother|printer/i)) score.Printer += 2
      if (hostname.match(/mac|apple/i)) score.Mac += 2
      if (macVendor.match(/HP|Printer/i)) score.Printer += 2
      if (macVendor.match(/Apple/i)) score.Mac += 2
      if (macVendor.match(/Cisco|Router/i)) score.IoT += 1
      this.logger.debug(`[OS DETECTION] ${ip} - Ports: ${openPorts.join(', ')} | TTL: ${ttl} | Hostname: ${hostname} | MAC: ${mac} (${macVendor}) | Banners: ${JSON.stringify(banners)}`)
      this.logger.debug(`[OS DETECTION] Scores: ${JSON.stringify(score)}`)
      const maxScore = Math.max(...Object.values(score))
      const probableOS = Object.keys(score).find(os => score[os] === maxScore && maxScore > 0)
      return probableOS || 'Unknown'
    } catch (error) {
      this.logger.error(`[OS DETECTION] Erreur détection OS pour ${ip}: ${error.message}`)
      return 'Unknown'
    }
  }

  // Map string (OUI type ou vendor) vers DeviceType enum - DÉPRÉCIÉ, utiliser DeviceTypeService
  private mapStringToDeviceType(type: string): DeviceType {
    if (!type) return DeviceType.OTHER
    const t = type.toLowerCase()
    if (t.includes('router')) return DeviceType.ROUTER
    if (t.includes('switch')) return DeviceType.SWITCH
    if (t.includes('access point') || t === 'ap') return DeviceType.AP
    if (t.includes('server') || t.includes('nas')) return DeviceType.SERVER
    if (t.includes('desktop') || t.includes('workstation')) return DeviceType.DESKTOP
    if (t.includes('laptop') || t.includes('notebook')) return DeviceType.LAPTOP
    if (t.includes('mobile') || t.includes('phone') || t.includes('tablet')) return DeviceType.MOBILE
    if (t.includes('printer')) return DeviceType.PRINTER
    return DeviceType.OTHER
  }

  // Ajout d'un setter pour le mode profond sur la config SNMP
  setSnmpMode(deepMode: boolean) {
    const mode = deepMode ? 'complet' : 'rapide'
    this.snmpConfig.timeout = NETWORK_TIMEOUTS.snmp[mode].timeout
    this.snmpConfig.retries = NETWORK_TIMEOUTS.snmp[mode].retries
  }
}

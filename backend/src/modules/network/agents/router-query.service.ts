import { Injectable, Logger } from '@nestjs/common';
import { OuiService } from '../services/oui.service';
import { DeviceTypeService } from '../services/device-type.service';
import { exec } from "child_process"
import { promisify } from "util"
import { type Device, DeviceType, DeviceStatus } from "../device.model"
import { v4 as uuidv4 } from "uuid"
import * as os from "os"
const net = require('net')
// Supprimer l'import de oui-util et la logique associée
import * as path from "path";
import * as fs from "fs"



const execAsync = promisify(exec)

interface RouterInfo {
  ip: string
  model: string
  vendor: string
  snmpCommunity: string
}

interface ConnectedClient {
  ip: string
  mac: string
  hostname?: string
  deviceType?: string
  lastSeen: Date
}

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
function isMulticast(ip: string): boolean {
  const first = Number(ip.split('.')[0])
  return first >= 224 && first <= 239
}
function isAPIPA(ip: string): boolean {
  return ip.startsWith("169.254.")
}
function isBroadcast(ip: string, cidr?: string): boolean {
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
function isValidDeviceIP(ip: string, cidr: string): boolean {
  return (
    ip !== "127.0.0.1" &&
    ip !== "::1" &&
    !isBroadcast(ip, cidr) &&
    !isMulticast(ip) &&
    !isAPIPA(ip) &&
    isIPv4InCIDR(ip, cidr)
  )
}

@Injectable()
export class RouterQueryService {
  private readonly logger = new Logger(RouterQueryService.name)

  constructor(
    private readonly ouiService: OuiService,
    private readonly deviceTypeService: DeviceTypeService,
  ) {}

  /**
   * Récupère les statistiques de trafic par port sur le routeur via SNMP
   * Retourne un mapping { macAddress: { in: number, out: number, port: number } }
   */
  private async getPortTrafficStats(routerInfo: RouterInfo): Promise<Record<string, { in: number, out: number, port: number }>> {
    const stats: Record<string, { in: number, out: number, port: number }> = {}
    try {
      // Récupérer la table des adresses MAC par port (BRIDGE-MIB)
      // 1.3.6.1.2.1.17.4.3.1.2 : port associé à une MAC
      // 1.3.6.1.2.1.17.4.3.1.1 : MAC
      // 1.3.6.1.2.1.2.2.1.10 : octets entrants par port
      // 1.3.6.1.2.1.2.2.1.16 : octets sortants par port
      const { stdout: macPortOut } = await execAsync(`snmpwalk -v 2c -c ${routerInfo.snmpCommunity} ${routerInfo.ip} 1.3.6.1.2.1.17.4.3.1.2`)
      const { stdout: inOctetsOut } = await execAsync(`snmpwalk -v 2c -c ${routerInfo.snmpCommunity} ${routerInfo.ip} 1.3.6.1.2.1.2.2.1.10`)
      const { stdout: outOctetsOut } = await execAsync(`snmpwalk -v 2c -c ${routerInfo.snmpCommunity} ${routerInfo.ip} 1.3.6.1.2.1.2.2.1.16`)
      // MAC -> port
      const macToPort: Record<string, number> = {}
      macPortOut.split('\n').forEach(line => {
        const match = line.match(/([0-9a-fA-F:]+)\s*=\s*INTEGER:\s*(\d+)/)
        if (match) {
          const mac = match[1].replace(/ /g, ":").toLowerCase()
          const port = parseInt(match[2], 10)
          macToPort[mac] = port
        }
      })
      // Port -> in/out octets
      const inOctets: Record<number, number> = {}
      inOctetsOut.split('\n').forEach(line => {
        const match = line.match(/\.([0-9]+)\s*=\s*Counter32:\s*(\d+)/)
        if (match) {
          const port = parseInt(match[1], 10)
          const value = parseInt(match[2], 10)
          inOctets[port] = value
        }
      })
      const outOctets: Record<number, number> = {}
      outOctetsOut.split('\n').forEach(line => {
        const match = line.match(/\.([0-9]+)\s*=\s*Counter32:\s*(\d+)/)
        if (match) {
          const port = parseInt(match[1], 10)
          const value = parseInt(match[2], 10)
          outOctets[port] = value
        }
      })
      // Construction du mapping final
      for (const mac in macToPort) {
        const port = macToPort[mac]
        stats[mac] = {
          port,
          in: inOctets[port] || 0,
          out: outOctets[port] || 0
        }
      }
    } catch (error) {
      this.logger.warn(`[ROUTER] SNMP stats ports échoué: ${error.message}`)
    }
    return stats
  }

  async getConnectedDevices(): Promise<Device[]> {
    try {
      this.logger.log(`[ROUTER] Démarrage interrogation de l'équipement central`)

      // 1. Détecter l'équipement central (gateway)
      const gateway = await this.detectGateway()
      this.logger.log(`[ROUTER] Gateway détecté: ${gateway}`)

      // 2. Identifier le type d'équipement
      const routerInfo = await this.identifyRouter(gateway)
      this.logger.log(`[ROUTER] Équipement identifié: ${routerInfo.model} (${routerInfo.vendor})`)

      // 3. Récupérer la liste des clients connectés
      const clients = await this.getConnectedClients(routerInfo)
      this.logger.log(`[ROUTER] Clients connectés trouvés: ${clients.length}`)

      // 4. Récupérer les stats de trafic par port
      const portStats = await this.getPortTrafficStats(routerInfo)

      // 5. Convertir en objets Device enrichis
      const devices = clients.map(client => {
        const mac = client.mac.toLowerCase()
        const stats = portStats[mac]
        return {
          ...this.convertToDevice(client),
          stats: {
            ...this.convertToDevice(client).stats,
            bandwidth: stats ? { download: stats.in, upload: stats.out } : { download: 0, upload: 0 }
          }
        }
      })

      return devices
    } catch (error) {
      this.logger.error(`[ROUTER] Erreur interrogation routeur: ${error.message}`)
      return []
    }
  }

  public async detectGateway(): Promise<string> {
    try {
      const isWindows = os.platform() === "win32"
      
      if (isWindows) {
        // Windows: route print
        const { stdout } = await execAsync("route print")
        const gatewayMatch = stdout.match(/0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)/)
        if (gatewayMatch) {
          return gatewayMatch[1]
        }
      } else {
        // Linux/Mac: route -n
        const { stdout } = await execAsync("route -n")
        const gatewayMatch = stdout.match(/0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)/)
        if (gatewayMatch) {
          return gatewayMatch[1]
        }
      }

      // Fallback: utiliser la première interface non-loopback
      const interfaces = os.networkInterfaces()
      for (const name of Object.keys(interfaces)) {
        const nets = interfaces[name]
        if (!nets) continue
        
        for (const iface of nets) {
          if (iface.family === "IPv4" && !iface.internal && iface.address) {
            const ipParts = iface.address.split(".")
            return `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.1` // Généralement .1
          }
        }
      }

      throw new Error("Impossible de détecter la gateway")
    } catch (error) {
      this.logger.error(`[ROUTER] Erreur détection gateway: ${error.message}`)
      throw error
    }
  }

  private async identifyRouter(gateway: string): Promise<RouterInfo> {
    try {
      // Test SNMP avec différentes communautés
      const communities = ["public", "private", "admin", "cisco", "router"]
      
      for (const community of communities) {
        try {
          // Test de connectivité SNMP
          const { stdout } = await execAsync(`snmpwalk -v 2c -c ${community} ${gateway} 1.3.6.1.2.1.1.1.0`)
          
          // Détecter le vendor/model
          let vendor = "Unknown"
          let model = "Unknown"
          
          if (stdout.toLowerCase().includes("cisco")) {
            vendor = "Cisco"
            model = "Cisco Router"
          } else if (stdout.toLowerCase().includes("huawei")) {
            vendor = "Huawei"
            model = "Huawei Router"
          } else if (stdout.toLowerCase().includes("tp-link")) {
            vendor = "TP-Link"
            model = "TP-Link Router"
          } else if (stdout.toLowerCase().includes("netgear")) {
            vendor = "Netgear"
            model = "Netgear Router"
          } else if (stdout.toLowerCase().includes("asus")) {
            vendor = "ASUS"
            model = "ASUS Router"
          } else if (stdout.toLowerCase().includes("linksys")) {
            vendor = "Linksys"
            model = "Linksys Router"
          }

          return {
            ip: gateway,
            model,
            vendor,
            snmpCommunity: community
          }
        } catch (error) {
          // Continuer avec la communauté suivante
          continue
        }
      }

      // Si SNMP échoue, essayer d'autres méthodes
      return await this.identifyRouterAlternative(gateway)
    } catch (error) {
      this.logger.error(`[ROUTER] Erreur identification routeur: ${error.message}`)
      throw error
    }
  }

  private async identifyRouterAlternative(gateway: string): Promise<RouterInfo> {
    try {
      // Essayer de détecter via HTTP/HTTPS
      const { stdout } = await execAsync(`curl -s --connect-timeout 5 http://${gateway}`)
      
      let vendor = "Unknown"
      let model = "Unknown"
      
      if (stdout.toLowerCase().includes("cisco")) {
        vendor = "Cisco"
        model = "Cisco Router"
      } else if (stdout.toLowerCase().includes("huawei")) {
        vendor = "Huawei"
        model = "Huawei Router"
      } else if (stdout.toLowerCase().includes("tp-link")) {
        vendor = "TP-Link"
        model = "TP-Link Router"
      } else if (stdout.toLowerCase().includes("netgear")) {
        vendor = "Netgear"
        model = "Netgear Router"
      } else if (stdout.toLowerCase().includes("asus")) {
        vendor = "ASUS"
        model = "ASUS Router"
      } else if (stdout.toLowerCase().includes("linksys")) {
        vendor = "Linksys"
        model = "Linksys Router"
      }

      return {
        ip: gateway,
        model,
        vendor,
        snmpCommunity: "public"
      }
    } catch (error) {
      // Fallback par défaut
      return {
        ip: gateway,
        model: "Generic Router",
        vendor: "Unknown",
        snmpCommunity: "public"
      }
    }
  }

  private async getConnectedClients(routerInfo: RouterInfo): Promise<ConnectedClient[]> {
    const clients: ConnectedClient[] = []
    // Déduire le CIDR du réseau à partir de la gateway (ex: 192.168.1.1 => 192.168.1.0/24)
    let cidr = ""
    if (routerInfo.ip) {
      const parts = routerInfo.ip.split('.')
      if (parts.length === 4) {
        cidr = `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
      }
    }

    try {
      // Méthode 1: SNMP ARP Table
      try {
        const { stdout } = await execAsync(`snmpwalk -v 2c -c ${routerInfo.snmpCommunity} ${routerInfo.ip} 1.3.6.1.2.1.4.22.1.2`)
        
        const lines = stdout.split("\n")
        for (const line of lines) {
          const match = line.match(/IP-MIB::ipNetToMediaPhysAddress\.(\d+\.\d+\.\d+\.\d+)\s*=\s*STRING:\s*([0-9A-Fa-f:]+)/)
          if (match) {
            const ip = match[1]
            const mac = match[2]
            
            if (isValidDeviceIP(ip, cidr)) {
              clients.push({
                ip,
                mac,
                lastSeen: new Date()
              })
            }
          }
        }
      } catch (error) {
        if (error.message && error.message.includes("'snmpwalk' n'est pas reconnu")) {
          this.logger.warn(`[ROUTER] SNMP ARP échoué : snmpwalk non installé ou non trouvé sur le système. Veuillez installer snmpwalk pour une détection complète des clients via SNMP.`)
        } else {
          this.logger.warn(`[ROUTER] SNMP ARP échoué: ${error.message}`)
        }
      }

      // Méthode 2: DHCP Leases (si accessible)
      try {
        const { stdout } = await execAsync(`snmpwalk -v 2c -c ${routerInfo.snmpCommunity} ${routerInfo.ip} 1.3.6.1.2.1.67.1.3.1.1`)
        
        const lines = stdout.split("\n")
        for (const line of lines) {
          const match = line.match(/IP-MIB::ipNetToMediaPhysAddress\.(\d+\.\d+\.\d+\.\d+)\s*=\s*STRING:\s*([0-9A-Fa-f:]+)/)
          if (match) {
            const ip = match[1]
            const mac = match[2]
            
            if (isValidDeviceIP(ip, cidr) && !clients.find(c => c.ip === ip)) {
              clients.push({
                ip,
                mac,
                lastSeen: new Date()
              })
            }
          }
        }
      } catch (error) {
        if (error.message && error.message.includes("'snmpwalk' n'est pas reconnu")) {
          this.logger.warn(`[ROUTER] SNMP DHCP échoué : snmpwalk non installé ou non trouvé sur le système. Veuillez installer snmpwalk pour une détection complète des baux DHCP via SNMP.`)
        } else {
          this.logger.warn(`[ROUTER] SNMP DHCP échoué: ${error.message}`)
        }
      }

      // Méthode 3: ARP local comme fallback
      if (clients.length === 0) {
        try {
          const isWindows = os.platform() === "win32"
          const { stdout } = await execAsync(isWindows ? "arp -a" : "arp -n")
          
          const lines = stdout.split("\n")
          for (const line of lines) {
            const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9A-Fa-f:]+)/)
            if (match) {
              const ip = match[1]
              const mac = match[2]
              
              if (isValidDeviceIP(ip, cidr)) {
                clients.push({
                  ip,
                  mac,
                  lastSeen: new Date()
                })
              }
            }
          }
        } catch (error) {
          this.logger.warn(`[ROUTER] ARP local échoué: ${error.message}`)
        }
      }

      this.logger.log(`[ROUTER] Total clients trouvés: ${clients.length}`)
      return clients
    } catch (error) {
      this.logger.error(`[ROUTER] Erreur récupération clients: ${error.message}`)
      return []
    }
  }

  private convertToDevice(client: ConnectedClient): Device {
    return {
      id: uuidv4(),
      hostname: client.hostname || client.ip,
      ipAddress: client.ip,
      macAddress: client.mac,
      os: "Unknown",
      deviceType: this.detectDeviceTypeFromMAC(client.mac),
      stats: {
        cpu: 0,
        memory: 0,
        uptime: "0",
        status: DeviceStatus.ACTIVE,
        services: [],
      },
      lastSeen: client.lastSeen,
      firstDiscovered: new Date(),
    }
  }

  private detectDeviceTypeFromMAC(mac: string): DeviceType {
    if (!mac) return DeviceType.OTHER
    
    const detectionResult = this.deviceTypeService.detectDeviceType({ macAddress: mac })
    return detectionResult.deviceType
  }

  private isLocalhost(ip: string): boolean {
    return ip === "127.0.0.1" || ip === "::1" || ip === this.getLocalIP()
  }

  private getLocalIP(): string {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name]
      if (!nets) continue
      
      for (const iface of nets) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address
        }
      }
    }
    return "127.0.0.1"
  }

  private async getOSFromSNMP(ip: string): Promise<string> {
    try {
      const ports = [22, 23, 80, 135, 139, 443, 445, 515, 548, 631, 9100, 3389, 554, 8080, 8888, 1900]
      const openPorts: number[] = []
      const banners: Record<number, string> = {}
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
      const hostname = await this.getHostnameFromDNS(ip)
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

  async enrichDeviceInfo(device: Device): Promise<Device> {
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
      const dns = await this.getHostnameFromDNS(device.ipAddress)
      if (dns && dns !== device.ipAddress) {
        hostname = dns
        this.logger.debug(`[ENRICH] Hostname enrichi via DNS pour ${device.ipAddress}: ${dns}`)
      }
    }
    // 3. OS (SNMP)
    let os = device.os
    if (!os || os === 'Unknown') {
      os = await this.getOSFromSNMP(device.ipAddress) || os
      if (os && os !== 'Unknown') {
        this.logger.debug(`[ENRICH] OS enrichi via SNMP/Router pour ${device.ipAddress}: ${os}`)
      }
    }
    // 4. Type d'appareil via service centralisé
    let deviceType = device.deviceType
    if (macAddress) {
      const detectionResult = this.deviceTypeService.detectDeviceType({ macAddress })
      deviceType = detectionResult.deviceType
    }
    // 5. Fusion intelligente
    return {
      ...device,
      macAddress: macAddress || device.macAddress,
      hostname: hostname || device.hostname,
      os: os || device.os,
      deviceType: deviceType || device.deviceType,
    }
  }

  // Map string (OUI type ou vendor) vers DeviceType enum
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

  private async getHostnameFromDNS(ip: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`nslookup ${ip}`)
      const match = stdout.match(/Name:\s*(.+)/)
      return match ? match[1].trim() : ip
    } catch (error) {
      return ip
    }
  }

  private async getMACAddress(ip: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`arp -a ${ip}`)
      const macMatch = stdout.match(/([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})/i)
      return macMatch ? macMatch[1].replace(/-/g, ":") : ""
    } catch (error) {
      this.logger.error(`[ENRICH] Erreur récupération MAC ${ip}: ${error.message}`)
      return ""
    }
  }
} 
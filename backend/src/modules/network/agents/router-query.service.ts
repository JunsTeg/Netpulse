import { Injectable, Logger } from "@nestjs/common"
import { exec } from "child_process"
import { promisify } from "util"
import { type Device, DeviceType, DeviceStatus } from "../device.model"
import { v4 as uuidv4 } from "uuid"
import * as os from "os"

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

@Injectable()
export class RouterQueryService {
  private readonly logger = new Logger(RouterQueryService.name)

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

      // 4. Convertir en objets Device
      const devices = clients.map(client => this.convertToDevice(client))

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
            
            if (!this.isLocalhost(ip)) {
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
            
            if (!this.isLocalhost(ip) && !clients.find(c => c.ip === ip)) {
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
              
              if (!this.isLocalhost(ip)) {
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

    const macPrefix = mac.substring(0, 8).toUpperCase()

    // Détection basée sur les préfixes MAC des fabricants
    if (macPrefix.startsWith("00:50:56") || macPrefix.startsWith("00:0C:29")) {
      return DeviceType.SERVER // Machines virtuelles
    } else if (macPrefix.startsWith("B8:27:EB") || macPrefix.startsWith("DC:A6:32")) {
      return DeviceType.SERVER // Raspberry Pi
    } else if (macPrefix.startsWith("00:1A:79")) {
      return DeviceType.ROUTER
    } else if (macPrefix.startsWith("00:1B:63") || macPrefix.startsWith("00:1C:B3")) {
      return DeviceType.SWITCH
    } else if (macPrefix.startsWith("00:1A:2B") || macPrefix.startsWith("00:1C:0E")) {
      return DeviceType.AP
    } else if (macPrefix.startsWith("00:1E:8C") || macPrefix.startsWith("00:1F:3F")) {
      return DeviceType.LAPTOP
    } else if (macPrefix.startsWith("00:1D:7D") || macPrefix.startsWith("00:1F:5B")) {
      return DeviceType.DESKTOP
    } else if (macPrefix.startsWith("00:1E:8C") || macPrefix.startsWith("00:1F:3F")) {
      return DeviceType.MOBILE
    }

    return DeviceType.OTHER
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
} 
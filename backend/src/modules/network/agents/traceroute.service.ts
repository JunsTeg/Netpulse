import { Injectable, Logger } from "@nestjs/common"
import { exec } from "child_process"
import { promisify } from "util"
import type { Device } from "../device.model"
import * as os from "os"

const execAsync = promisify(exec)

interface TracerouteConfig {
  target: string
  maxHops?: number
  timeout?: number
}

interface TracerouteHop {
  hop: number
  ip: string
  hostname?: string
  rtt: number[]
}

interface TracerouteResult {
  success: boolean
  target: string
  hops: TracerouteHop[]
  error?: string
  scanTime: Date
}

@Injectable()
export class TracerouteAgentService {
  private readonly logger = new Logger(TracerouteAgentService.name)
  private readonly isWindows = os.platform() === "win32"

  private isMulticastIP(ip: string): boolean {
    // Vérifie si l'IP est une adresse multicast (224.0.0.0 à 239.255.255.255)
    const parts = ip.split(".")
    if (parts.length !== 4) return false
    const firstOctet = Number.parseInt(parts[0])
    return firstOctet >= 224 && firstOctet <= 239
  }

  async execute(config: TracerouteConfig): Promise<TracerouteResult> {
    try {
      // Ignorer les adresses multicast
      if (this.isMulticastIP(config.target)) {
        return {
          success: false,
          target: config.target,
          hops: [],
          error: "Adresse multicast non supportee",
          scanTime: new Date(),
        }
      }

      const isWindows = os.platform() === "win32"
      const command = isWindows
        ? `tracert -d -h ${config.maxHops || 30} -w ${config.timeout || 1000} ${config.target}`
        : `traceroute -n -m ${config.maxHops || 30} -w ${config.timeout || 1} ${config.target}`

      this.logger.debug(`[TRACEROUTE] Commande executee: ${command}`)
      const { stdout } = await execAsync(command)

      // Parsing des resultats selon le systeme d'exploitation
      const hops: TracerouteHop[] = []
      const lines = stdout.split("\n")

      for (const line of lines) {
        // Ignorer les lignes vides
        if (!line.trim()) continue

        if (this.isWindows) {
          // Parsing pour Windows (tracert)
          const hopMatch = line.match(/^\s*(\d+)\s+(\d+)\s+ms\s+(\d+)\s+ms\s+(\d+)\s+ms\s+(.*?)(?:\s+|$)/)
          if (hopMatch) {
            const [, hop, rtt1, rtt2, rtt3, ipHost] = hopMatch

            // Extraire IP et hostname
            const ipHostParts = ipHost.split(" ")
            const ip = ipHostParts[0]
            const hostname = ipHostParts.length > 1 ? ipHostParts[1].replace(/[[\]]/g, "") : undefined

            hops.push({
              hop: Number.parseInt(hop),
              ip,
              hostname,
              rtt: [Number.parseFloat(rtt1), Number.parseFloat(rtt2), Number.parseFloat(rtt3)],
            })
          }
        } else {
          // Parsing pour Unix (traceroute)
          const hopMatch = line.match(/^\s*(\d+)\s+(.*?)\s+(\d+\.\d+)\s+ms/)
          if (hopMatch) {
            const [, hop, ipHost, rtt] = hopMatch

            // Extraire IP et hostname
            const ipHostParts = ipHost.split(" ")
            const ip = ipHostParts[0]
            const hostname = ipHostParts.length > 1 ? ipHostParts[1].replace(/[()]/g, "") : undefined

            hops.push({
              hop: Number.parseInt(hop),
              ip,
              hostname,
              rtt: [Number.parseFloat(rtt)],
            })
          }
        }
      }

      return {
        success: true,
        target: config.target,
        hops,
        scanTime: new Date(),
      }
    } catch (error) {
      this.logger.error(`[TRACEROUTE] Erreur: ${error.message}`)
      return {
        success: false,
        target: config.target,
        hops: [],
        error: error.message,
        scanTime: new Date(),
      }
    }
  }

  // Fonction pour generer la topologie a partir des resultats traceroute
  generateTopology(devices: Device[], tracerouteResults: TracerouteResult[]): any {
    const topology = {
      nodes: devices.map((device) => ({
        id: device.id,
        hostname: device.hostname,
        ipAddress: device.ipAddress,
        deviceType: device.deviceType,
        stats: device.stats,
      })),
      links: [],
    }

    // Creation des liens a partir des resultats traceroute
    tracerouteResults.forEach((result) => {
      if (!result.success) return

      for (let i = 0; i < result.hops.length - 1; i++) {
        const currentHop = result.hops[i]
        const nextHop = result.hops[i + 1]

        // Trouver les appareils correspondants
        const sourceDevice = devices.find((d) => d.ipAddress === currentHop.ip)
        const targetDevice = devices.find((d) => d.ipAddress === nextHop.ip)

        if (sourceDevice && targetDevice) {
          // Verifier si le lien existe deja
          const linkExists = topology.links.some(
            (link) =>
              (link.source === sourceDevice.id && link.target === targetDevice.id) ||
              (link.source === targetDevice.id && link.target === sourceDevice.id),
          )

          if (!linkExists) {
            topology.links.push({
              source: sourceDevice.id,
              target: targetDevice.id,
              type: "gigabit", // Par defaut
              bandwidth: "1Gbps", // Par defaut
            })
          }
        }
      }
    })

    return topology
  }
}

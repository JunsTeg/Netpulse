import { Controller, Get, Post, UseGuards, Logger, HttpException, HttpStatus } from "@nestjs/common"
import type { NetworkService } from "./network.service"
import type { NetworkDetectorService } from "./network-detector.service"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import type { RequestWithUser } from "../auth/auth.types"

interface ScanConfigDto {
  target: string
  ports?: string
  osDetection?: boolean
  serviceDetection?: boolean
  timing?: number
  sudo?: boolean
}

@Controller("network")
@UseGuards(JwtAuthGuard)
export class NetworkController {
  private readonly logger = new Logger(NetworkController.name)

  constructor(
    private readonly networkService: NetworkService,
    private readonly networkDetector: NetworkDetectorService,
  ) {}

  @Post("scan")
  async scanNetwork(config: ScanConfigDto, req: RequestWithUser) {
    try {
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
      throw new HttpException(`Erreur lors du scan réseau: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("devices")
  async getDevices() {
    try {
      const devices = this.networkDetector.getDevices()
      return {
        success: true,
        data: devices,
        count: devices.length,
      }
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur récupération appareils: ${error.message}`)
      throw new HttpException("Erreur lors de la récupération des appareils", HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get("topology")
  async getTopology() {
    try {
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
}

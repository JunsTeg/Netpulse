import { Injectable, Logger, Inject } from "@nestjs/common"
import { NmapAgentService } from "./agents/nmap.service"
import { TracerouteAgentService } from "./agents/traceroute.service"
import { NetstatAgentService } from "./agents/netstat.service"
import type { Device, NmapScanConfig, NmapScanResult } from "./device.model"
import type { NetworkTopologyData } from "./network.types"
import pLimit from 'p-limit';
import { ExecutionManagerService } from '../../execution-manager/execution-manager.service';
import { ScanTask } from '../../execution-manager/tasks/scan.task';

@Injectable()
export class NetworkService {
  private readonly logger = new Logger(NetworkService.name)

  constructor(
    private readonly nmapAgent: NmapAgentService,
    private readonly tracerouteAgent: TracerouteAgentService,
    private readonly netstatAgent: NetstatAgentService,
    @Inject(ExecutionManagerService)
    private readonly executionManager: ExecutionManagerService,
  ) {}

  async scanNetwork(target: string, userId?: string): Promise<NmapScanResult> {
    try {
      this.logger.log(`[NETWORK] Démarrage scan réseau: ${target}`)

      const config: NmapScanConfig = {
        target,
        osDetection: true,
        serviceDetection: true,
        timing: 4,
      }

      const result = await this.nmapAgent.execute(config, userId)

      this.logger.log(`[NETWORK] Scan terminé: ${result.devices.length} appareils trouvés`)

      return result
    } catch (error) {
      this.logger.error(`[NETWORK] Erreur scan: ${error.message}`)
      throw error
    }
  }

  async submitScan(config: NmapScanConfig, userId?: string) {
    const task = new ScanTask(
      () => this.scanNetwork(config.target, userId),
      { userId, priority: 10 }
    );
    this.executionManager.submit(task);
    return task.id;
  }

  async updateDeviceStats(device: Device): Promise<Device> {
    try {
      return await this.netstatAgent.execute(device)
    } catch (error) {
      this.logger.error(`[STATS] Erreur mise à jour stats ${device.ipAddress}: ${error.message}`)
      return device
    }
  }

  private calculateAverageLatency(devices: Device[]): number {
    const latencies = devices.map((d) => d.stats.latency).filter((l) => l !== undefined && l > 0) as number[]

    return latencies.length > 0 ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0
  }

  async measureLatency(ipAddress: string): Promise<number> {
    try {
      const { exec } = require("child_process")
      const { promisify } = require("util")
      const execAsync = promisify(exec)

      const { stdout } = await execAsync(`ping -n 1 ${ipAddress}`)
      const match = stdout.match(/Average = (\d+)ms/)
      return match ? Number.parseInt(match[1]) : 999
    } catch (error) {
      return 999
    }
  }

  async testBandwidth(ipAddress: string): Promise<{ download: number; upload: number }> {
    try {
      // Test de bande passante simplifié
      const startTime = Date.now()
      await this.measureLatency(ipAddress)
      const duration = Date.now() - startTime

      // Estimation basée sur la latence
      const estimatedBandwidth = Math.max(0, 100 - duration / 10)

      return {
        download: estimatedBandwidth,
        upload: estimatedBandwidth * 0.8,
      }
    } catch (error) {
      return { download: 0, upload: 0 }
    }
  }
}
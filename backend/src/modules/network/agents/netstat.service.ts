import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Device, DeviceStatus } from '../device.model';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

@Injectable()
export class NetstatAgentService {
  private readonly logger = new Logger(NetstatAgentService.name);

  async execute(device: Device): Promise<Device> {
    try {
      // Collecte des stats de base
      const [pingResult, cpuResult, memoryResult] = await Promise.all([
        this.getPingStats(device.ipAddress),
        this.getCpuUsage(),
        this.getMemoryUsage()
      ]);

      // Mise a jour des stats de l'appareil
      device.stats = {
        ...device.stats,
        cpu: cpuResult,
        memory: memoryResult,
        uptime: device.stats.uptime,
        status: this.determineStatus(cpuResult, memoryResult, pingResult.packetLoss)
      };

      device.lastSeen = new Date();
      return device;

    } catch (error) {
      this.logger.error(`Erreur stats: ${error.message}`);
      return device;
    }
  }

  private async getPingStats(ipAddress: string): Promise<{ latency: number; packetLoss: number }> {
    try {
      const { stdout } = await execAsync(`ping -c 4 ${ipAddress}`);
      const lossMatch = stdout.match(/(\d+)% packet loss/);
      return {
        latency: 0, // A implementer
        packetLoss: lossMatch ? parseFloat(lossMatch[1]) : 100
      };
    } catch (error) {
      return { latency: 0, packetLoss: 100 };
    }
  }

  private async getCpuUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\'');
      return parseFloat(stdout) || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync('free | grep Mem | awk \'{print $3/$2 * 100.0}\'');
      return parseFloat(stdout) || 0;
    } catch (error) {
      return 0;
    }
  }

  private determineStatus(cpu: number, memory: number, packetLoss: number): DeviceStatus {
    if (packetLoss >= 50) return DeviceStatus.INACTIVE;
    if (cpu > 80 || memory > 80) return DeviceStatus.DANGER;
    if (cpu > 60 || memory > 60) return DeviceStatus.WARNING;
    return DeviceStatus.ACTIVE;
  }
}

import { Controller, Get, Post, Body, Param, Query, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { NetworkService } from './network.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Device, NmapScanConfig } from './device.model';

@Controller('network')
@UseGuards(JwtAuthGuard)
export class NetworkController {
  private readonly logger = new Logger(NetworkController.name);

  constructor(private readonly networkService: NetworkService) {}

  @Post('scan')
  async scanNetwork(@Body('target') target: string): Promise<Device[]> {
    this.logger.log(`[BACKEND] Demarrage du scan reseau pour la cible: ${target}`);
    try {
      const devices = await this.networkService.scanNetwork(target);
      this.logger.log(`[BACKEND] Scan termine. ${devices.length} appareils trouves`);
      return devices;
    } catch (error) {
      this.logger.error(`[BACKEND] Erreur lors du scan: ${error.message}`);
      throw error;
    }
  }

  @Get('devices')
  async getAllDevices(): Promise<Device[]> {
    this.logger.log('[BACKEND] Recuperation de la liste des appareils');
    try {
      const devices = await this.networkService.getAllDevices();
      this.logger.log(`[BACKEND] ${devices.length} appareils recuperes`);
      return devices;
    } catch (error) {
      this.logger.error(`[BACKEND] Erreur lors de la recuperation des appareils: ${error.message}`);
      throw error;
    }
  }

  @Get('devices/:id')
  async getDeviceById(@Param('id') id: string): Promise<Device> {
    return this.networkService.getDeviceById(id);
  }

  @Get('topology')
  async getLatestTopology() {
    return this.networkService.getLatestTopology();
  }

  @Get('devices/:id/stats')
  async getDeviceStats(
    @Param('id') deviceId: string,
    @Query('interval') interval: string = '1h'
  ) {
    try {
      this.logger.log(`Recuperation des stats pour l'appareil ${deviceId}`);
      const stats = await this.networkService.getDeviceStats(deviceId, interval);
      return stats;
    } catch (error) {
      this.logger.error(`Erreur recuperation stats appareil: ${error.message}`);
      throw error;
    }
  }

  @Get('detect')
  async detectNetwork() {
    this.logger.log('[BACKEND] Demarrage de la detection du reseau');
    try {
      const network = await this.networkService.detectLocalNetwork();
      this.logger.log(`[BACKEND] Reseau detecte: ${JSON.stringify(network)}`);
      return {
        success: true,
        network
      };
    } catch (error) {
      this.logger.error(`[BACKEND] Erreur lors de la detection: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getNetworkStats(@Query('timeRange') timeRange: string = '24h') {
    try {
      this.logger.log(`Recuperation des stats reseau pour la periode: ${timeRange}`);
      const stats = await this.networkService.getNetworkStats(timeRange);
      return stats;
    } catch (error) {
      this.logger.error(`Erreur recuperation stats: ${error.message}`);
      throw error;
    }
  }
} 
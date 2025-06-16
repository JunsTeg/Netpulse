import { Controller, Get, Post, Body, Param, Query, UseGuards, Logger, HttpException, HttpStatus, Req, Put, Delete, ValidationPipe } from '@nestjs/common';
import { NetworkService } from './network.service';
import { NetworkDetectorService } from './network-detector.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Device, NmapScanConfig, CreateDeviceDto, UpdateDeviceDto } from './device.model';
import { NetworkTopology } from './network.types';
import { RequestWithUser } from '../../auth/auth.types';

@Controller('network')
@UseGuards(JwtAuthGuard)
export class NetworkController {
  private readonly logger = new Logger(NetworkController.name);

  constructor(
    private readonly networkService: NetworkService,
    private readonly networkDetector: NetworkDetectorService,
  ) {}

  @Post('scan')
  async scanNetwork(@Body() config: NmapScanConfig, @Req() req: RequestWithUser) {
    try {
      const userId = req.user.id; // L'ID est maintenant correctement typé
      this.logger.log(`[SCAN] Demarrage du scan par l'utilisateur ${userId}`);
      return await this.networkService.scanNetwork(config.target, userId);
    } catch (error) {
      this.logger.error(`[SCAN] Erreur scan: ${error.message}`);
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
  async getLatestTopology(): Promise<NetworkTopology | null> {
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
      const networkInfo = await this.networkService.detectLocalNetwork();
      this.logger.log(`[BACKEND] Reseau detecte: ${JSON.stringify(networkInfo)}`);

      // Formatage de la reponse pour correspondre a ce qu'attend le frontend
      return {
        success: true,
        network: {
          startIP: networkInfo.startIP,
          endIP: networkInfo.endIP,
          gateway: networkInfo.gateway,
          netmask: networkInfo.netmask
        }
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

  @Get('test-network')
  @UseGuards(JwtAuthGuard)
  async testNetwork() {
    try {
      const result = await this.networkDetector.testNetworkSetup();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Post('devices')
  async createDevice(
    @Body(new ValidationPipe({ transform: true })) createDeviceDto: CreateDeviceDto,
    @Req() req: RequestWithUser
  ): Promise<Device> {
    try {
      this.logger.log(`[BACKEND] Creation d'un nouvel appareil: ${JSON.stringify(createDeviceDto)}`);
      
      // Verification de l'unicite de l'adresse IP
      const existingDevice = await this.networkService.getDeviceByIP(createDeviceDto.ipAddress);
      if (existingDevice) {
        throw new HttpException(
          'Un appareil avec cette adresse IP existe deja',
          HttpStatus.CONFLICT
        );
      }

      // Verification de l'unicite de l'adresse MAC
      const existingMacDevice = await this.networkService.getDeviceByMAC(createDeviceDto.macAddress);
      if (existingMacDevice) {
        throw new HttpException(
          'Un appareil avec cette adresse MAC existe deja',
          HttpStatus.CONFLICT
        );
      }

      const device = await this.networkService.createDevice(createDeviceDto);
      this.logger.log(`[BACKEND] Appareil cree avec succes: ${device.id}`);
      return device;
    } catch (error) {
      this.logger.error(`[BACKEND] Erreur creation appareil: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la creation de l\'appareil',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put('devices/:id')
  async updateDevice(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) updateDeviceDto: UpdateDeviceDto,
    @Req() req: RequestWithUser
  ): Promise<Device> {
    try {
      this.logger.log(`[BACKEND] Mise a jour de l'appareil ${id}: ${JSON.stringify(updateDeviceDto)}`);

      // Verification de l'existence de l'appareil
      const existingDevice = await this.networkService.getDeviceById(id);
      if (!existingDevice) {
        throw new HttpException(
          'Appareil non trouve',
          HttpStatus.NOT_FOUND
        );
      }

      // Si l'IP est modifiee, verification de l'unicite
      if (updateDeviceDto.ipAddress && updateDeviceDto.ipAddress !== existingDevice.ipAddress) {
        const deviceWithIP = await this.networkService.getDeviceByIP(updateDeviceDto.ipAddress);
        if (deviceWithIP && deviceWithIP.id !== id) {
          throw new HttpException(
            'Un appareil avec cette adresse IP existe deja',
            HttpStatus.CONFLICT
          );
        }
      }

      // Si la MAC est modifiee, verification de l'unicite
      if (updateDeviceDto.macAddress && updateDeviceDto.macAddress !== existingDevice.macAddress) {
        const deviceWithMAC = await this.networkService.getDeviceByMAC(updateDeviceDto.macAddress);
        if (deviceWithMAC && deviceWithMAC.id !== id) {
          throw new HttpException(
            'Un appareil avec cette adresse MAC existe deja',
            HttpStatus.CONFLICT
          );
        }
      }

      const updatedDevice = await this.networkService.updateDevice(id, updateDeviceDto);
      this.logger.log(`[BACKEND] Appareil ${id} mis a jour avec succes`);
      return updatedDevice;
    } catch (error) {
      this.logger.error(`[BACKEND] Erreur mise a jour appareil ${id}: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la mise a jour de l\'appareil',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete('devices/:id')
  async deleteDevice(
    @Param('id') id: string,
    @Req() req: RequestWithUser
  ): Promise<{ message: string }> {
    try {
      this.logger.log(`[BACKEND] Suppression de l'appareil ${id}`);

      // Verification de l'existence de l'appareil
      const existingDevice = await this.networkService.getDeviceById(id);
      if (!existingDevice) {
        throw new HttpException(
          'Appareil non trouve',
          HttpStatus.NOT_FOUND
        );
      }

      // Suppression des statistiques associees
      await this.networkService.deleteDeviceStats(id);
      
      // Suppression de l'appareil
      await this.networkService.deleteDevice(id);
      
      this.logger.log(`[BACKEND] Appareil ${id} supprime avec succes`);
      return { message: 'Appareil supprime avec succes' };
    } catch (error) {
      this.logger.error(`[BACKEND] Erreur suppression appareil ${id}: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erreur lors de la suppression de l\'appareil',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 
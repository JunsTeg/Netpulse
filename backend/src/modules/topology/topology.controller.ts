import { Controller, Post, Get, Body, Param, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { TopologyService } from './topology.service';
import { Topology, TopologyOptions } from './topology.types';
import { CentralNodeService } from './services/central-node.service';
import { Logger } from '@nestjs/common';

@Controller('topology')
export class TopologyController {
  private readonly logger = new Logger(TopologyController.name);

  constructor(
    private readonly topologyService: TopologyService,
    private readonly centralNodeService: CentralNodeService,
  ) {}

  @Post('generate')
  async generate(@Body() body: { devices?: any[]; options?: TopologyOptions; userId?: string }) {
    try {
      const { devices = [], options = {}, userId } = body;
      
      if (!devices || devices.length === 0) {
        throw new HttpException(
          'Aucun appareil fourni pour la génération de topologie',
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.topologyService.generateTopologyFromDatabase(options, userId);
      const topology = result.topology;
      
      return {
        success: true,
        data: topology,
        message: 'Topologie générée avec succès',
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la génération de topologie: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('generate-from-database')
  async generateFromDatabase(@Body() body: { options?: TopologyOptions; userId?: string }) {
    try {
      const { options = {}, userId } = body;
      
      const result = await this.topologyService.generateTopologyFromDatabase(options, userId);
      
      return {
        success: true,
        data: result.topology,
        metrics: result.metrics,
        message: 'Topologie générée depuis la base de données avec succès',
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la génération de topologie depuis la BD: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('last')
  async getLastTopology() {
    try {
    const topology = await this.topologyService.getLastTopology();
      
      if (!topology) {
        return {
          success: false,
          data: null,
          message: 'Aucune topologie disponible',
        };
      }

      return {
        success: true,
        data: topology,
        message: 'Dernière topologie récupérée',
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la récupération de la topologie: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async getTopologyById(@Param('id') id: string) {
    try {
      const topology = await this.topologyService.getTopologyById(id);
      
      if (!topology) {
        throw new HttpException(
          'Topologie introuvable',
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        data: topology,
        message: 'Topologie récupérée',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erreur lors de la récupération de la topologie: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async deleteTopology(@Param('id') id: string) {
    try {
      const deleted = await this.topologyService.deleteTopology(id);
      
      if (!deleted) {
        throw new HttpException(
          'Topologie introuvable ou déjà supprimée',
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        message: 'Topologie supprimée avec succès',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Erreur lors de la suppression de la topologie: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('cleanup')
  async cleanupOldTopologies(@Body() body: { keepDays?: number }) {
    try {
      const { keepDays = 30 } = body;
      const deletedCount = await this.topologyService.cleanupOldTopologies(keepDays);
      
      return {
        success: true,
        data: { deletedCount },
        message: `${deletedCount} anciennes topologies supprimées`,
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors du nettoyage: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('stats/snmp')
  async getSnmpStats() {
    try {
      const stats = this.topologyService.getSnmpStats();
      
      return {
        success: true,
        data: stats,
        message: 'Statistiques SNMP récupérées',
      };
    } catch (error) {
      throw new HttpException(
        `Erreur lors de la récupération des statistiques SNMP: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Obtient les statistiques du cache de topologie
   */
  @Get('cache/stats')
  async getCacheStats() {
    try {
      const topologyCacheStats = await this.topologyService.getCacheStats();
      const centralNodeCacheStats = this.centralNodeService.getCacheStats();
      
      return {
        topology: topologyCacheStats,
        centralNode: centralNodeCacheStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur récupération stats cache: ${error.message}`);
      throw new HttpException(
        `Erreur lors de la récupération des statistiques du cache: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Vide le cache de topologie
   */
  @Delete('cache/clear')
  async clearTopologyCache() {
    try {
      await this.topologyService.clearTopologyCache();
      this.centralNodeService.clearCache();
      
      this.logger.log('[CONTROLLER] Cache de topologie vidé');
      return {
        message: 'Cache de topologie vidé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur vidage cache: ${error.message}`);
      throw new HttpException(
        `Erreur lors du vidage du cache: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Vérifie la cohérence de l'équipement central
   */
  @Post('central-node/consistency')
  async checkCentralNodeConsistency(@Body() body: { devices: any[]; options?: any }) {
    try {
      // Simuler les résultats de connectivité pour la démonstration
      const connectivityResults = new Map<string, boolean>();
      body.devices.forEach(device => {
        connectivityResults.set(device.id, true); // Tous accessibles pour la démo
      });

      const consistency = await this.centralNodeService.checkCentralNodeConsistency(
        body.devices,
        connectivityResults,
        body.options || {}
      );

      return {
        ...consistency,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur vérification cohérence: ${error.message}`);
      throw new HttpException(
        `Erreur lors de la vérification de cohérence: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Force le recalcul de l'équipement central
   */
  @Post('central-node/recalculate')
  async forceRecalculateCentralNode(@Body() body: { devices: any[]; options?: any }) {
    try {
      // Simuler les résultats de connectivité pour la démonstration
      const connectivityResults = new Map<string, boolean>();
      body.devices.forEach(device => {
        connectivityResults.set(device.id, true); // Tous accessibles pour la démo
      });

      const result = await this.centralNodeService.forceRecalculateCentralNode(
        body.devices,
        connectivityResults,
        body.options || {}
      );

      return {
        ...result,
        timestamp: new Date().toISOString(),
        message: 'Équipement central recalculé avec succès',
      };
    } catch (error) {
      this.logger.error(`[CONTROLLER] Erreur recalcul équipement central: ${error.message}`);
      throw new HttpException(
        `Erreur lors du recalcul de l'équipement central: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 
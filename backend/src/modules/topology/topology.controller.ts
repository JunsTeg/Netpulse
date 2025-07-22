import { Controller, Post, Get, Body } from '@nestjs/common';
import { TopologyService } from './topology.service';

@Controller('topology')
export class TopologyController {
  constructor(private readonly topologyService: TopologyService) {}

  @Post('generate')
  async generate(@Body('devices') devices: any[]) {
    const topology = await this.topologyService.generateTopology(devices);
    // TODO: persister la topologie générée
    return { success: true, data: topology };
  }

  @Get('last')
  async getLast() {
    const topology = await this.topologyService.getLastTopology();
    return { success: !!topology, data: topology };
  }
} 
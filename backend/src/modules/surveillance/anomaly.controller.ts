import { Controller, Get, Post, Body, Param, Put, Query } from '@nestjs/common';
import { Anomaly } from './anomaly.model';

@Controller('anomalies')
export class AnomalyController {
  @Get()
  async findAll(@Query() query: any): Promise<Anomaly[]> {
    // TODO: Implementer la logique de recuperation des anomalies
    return [];
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Anomaly> {
    // TODO: Implementer la logique de recuperation d'une anomalie
    return null;
  }

  @Post()
  async create(@Body() anomaly: Partial<Anomaly>): Promise<Anomaly> {
    // TODO: Implementer la logique de creation d'une anomalie
    return null;
  }

  @Put(':id/resolve')
  async resolveAnomaly(
    @Param('id') id: string,
    @Body() data: { resolvedBy: string },
  ): Promise<Anomaly> {
    // TODO: Implementer la logique de resolution d'une anomalie
    return null;
  }
} 
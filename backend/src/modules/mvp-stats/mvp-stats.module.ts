import { Module } from '@nestjs/common';
import { MvpStatsController } from './mvp-stats.controller';
import { MvpStatsService } from './mvp-stats.service';
import { MvpDataProcessor } from './services/mvp-data-processor.service';
import { MvpAnomalyDetector } from './services/mvp-anomaly-detector.service';
import { MvpDeviceCollector } from './services/mvp-device-collector.service';
import { MvpResponseFormatter } from './services/mvp-response-formatter.service';
import { MvpStatsRepository } from './repositories/mvp-stats.repository';
import { AppareilRepository } from '../network/appareil.repository';

@Module({
  controllers: [MvpStatsController],
  providers: [
    MvpStatsService,
    MvpDataProcessor,
    MvpAnomalyDetector,
    MvpDeviceCollector,
    MvpResponseFormatter,
    MvpStatsRepository,
    AppareilRepository
  ],
  exports: [MvpStatsService]
})
export class MvpStatsModule {} 
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnomalyController } from './anomaly.controller';
import { AlertController } from './alert.controller';
import { ThresholdController } from './threshold.controller';
import { Anomaly, AnomalySchema } from './anomaly.model';
import { Alert, AlertSchema } from './alert.model';
import { Threshold, ThresholdSchema } from './threshold.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Anomaly.name, schema: AnomalySchema },
      { name: Alert.name, schema: AlertSchema },
      { name: Threshold.name, schema: ThresholdSchema },
    ]),
  ],
  controllers: [AnomalyController, AlertController, ThresholdController],
  exports: [MongooseModule],
})
export class SurveillanceModule {} 
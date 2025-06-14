import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ThresholdDocument = Threshold & Document;

@Schema({ timestamps: true })
export class Threshold {
  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  metric: string;

  @Prop({ required: true })
  minValue: number;

  @Prop({ required: true })
  maxValue: number;

  @Prop({ required: true })
  severity: 'low' | 'medium' | 'high';

  @Prop()
  description: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastUpdatedBy: string;
}

export const ThresholdSchema = SchemaFactory.createForClass(Threshold); 
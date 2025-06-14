import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnomalyDocument = Anomaly & Document;

@Schema({ timestamps: true })
export class Anomaly {
  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  metric: string;

  @Prop({ required: true })
  value: number;

  @Prop({ required: true })
  threshold: number;

  @Prop({ required: true })
  severity: 'low' | 'medium' | 'high';

  @Prop()
  description: string;

  @Prop({ default: false })
  isResolved: boolean;

  @Prop()
  resolvedAt: Date;
}

export const AnomalySchema = SchemaFactory.createForClass(Anomaly); 
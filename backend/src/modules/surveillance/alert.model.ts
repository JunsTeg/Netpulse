import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AlertDocument = Alert & Document;

@Schema({ timestamps: true })
export class Alert {
  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  severity: 'info' | 'warning' | 'error' | 'critical';

  @Prop({ default: false })
  isAcknowledged: boolean;

  @Prop()
  acknowledgedBy: string;

  @Prop()
  acknowledgedAt: Date;

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export const AlertSchema = SchemaFactory.createForClass(Alert); 
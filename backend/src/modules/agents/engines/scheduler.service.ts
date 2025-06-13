import { Injectable } from '@nestjs/common';
import { SchedulerAgentService } from '../../surveillance/agents/scheduler.service';

@Injectable()
export class SchedulerEngineService extends SchedulerAgentService {
  // Service qui fait un alias vers le service scheduler de surveillance
} 
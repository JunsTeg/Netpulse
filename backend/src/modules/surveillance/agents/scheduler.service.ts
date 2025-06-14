import { Injectable } from '@nestjs/common';

@Injectable()
export class SchedulerAgentService {
  async scheduleTask(task: any): Promise<any> {
    // Implementation du scheduler
    throw new Error('Non implemente');
  }
} 
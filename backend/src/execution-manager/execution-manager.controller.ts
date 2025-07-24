import { Controller, Get, Param, Delete } from '@nestjs/common';
import { ExecutionManagerService } from './execution-manager.service';

@Controller('internal/execution-manager')
export class ExecutionManagerController {
  constructor(private readonly executionManager: ExecutionManagerService) {}

  @Get('tasks')
  listTasks() {
    return this.executionManager.listTasks();
  }

  @Get('tasks/:id')
  getTask(@Param('id') id: string) {
    return this.executionManager.getTaskById(id);
  }

  @Delete('tasks/:id')
  cancelTask(@Param('id') id: string) {
    return { success: this.executionManager.cancelTask(id) };
  }

  @Get('logs')
  getLogs() {
    return this.executionManager.getLogs();
  }

  @Get('metrics')
  getMetrics() {
    return this.executionManager.getMetrics();
  }
} 
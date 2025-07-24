import { Module } from '@nestjs/common';
import { ExecutionManagerService } from './execution-manager.service';
import { ExecutionManagerController } from './execution-manager.controller';

@Module({
  providers: [ExecutionManagerService],
  controllers: [ExecutionManagerController],
  exports: [ExecutionManagerService],
})
export class ExecutionManagerModule {} 
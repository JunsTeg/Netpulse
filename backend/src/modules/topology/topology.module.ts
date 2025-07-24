import { Module, forwardRef } from '@nestjs/common';
import { TopologyService } from './topology.service';
import { TopologyController } from './topology.controller';
import { NetworkModule } from '../network/network.module';
import { ExecutionManagerModule } from '../../execution-manager/execution-manager.module';

@Module({
  imports: [
    forwardRef(() => NetworkModule),
    ExecutionManagerModule,
  ],
  providers: [TopologyService],
  controllers: [TopologyController],
  exports: [TopologyService],
})
export class TopologyModule {} 
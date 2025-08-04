import { Module } from '@nestjs/common';
import { TopologyService } from './topology.service';
import { TopologyController } from './topology.controller';
import { SnmpService } from './services/snmp.service';
import { ValidationService } from './services/validation.service';
import { LinkGenerationService } from './services/link-generation.service';
import { TopologyRepository } from './repositories/topology.repository';
import { TopologyCacheService } from './services/topology-cache.service';
import { ConnectivityService } from './services/connectivity.service';
import { CentralNodeService } from './services/central-node.service';
import { DeviceRepository } from './repositories/device.repository';



@Module({
  providers: [
    TopologyService,
    SnmpService,
    ValidationService,
    LinkGenerationService,
    TopologyRepository,
    TopologyCacheService,
    ConnectivityService,
    CentralNodeService,
    DeviceRepository,
  ],
  controllers: [TopologyController],
  exports: [TopologyService],
})
export class TopologyModule {} 
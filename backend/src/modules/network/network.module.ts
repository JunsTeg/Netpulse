import { Module } from '@nestjs/common';
import { NetworkService } from './network.service';
import { NmapAgentService } from './agents/nmap.service';
import { TracerouteAgentService } from './agents/traceroute.service';
import { NetstatAgentService } from './agents/netstat.service';
import { NetworkController } from './network.controller';
import { NetworkDetectorService } from './network-detector.service';

@Module({
  controllers: [NetworkController],
  providers: [
    NetworkService,
    NmapAgentService,
    TracerouteAgentService,
    NetstatAgentService,
    NetworkDetectorService
  ],
  exports: [NetworkService, NetworkDetectorService]
})
export class NetworkModule {} 
import { Module } from '@nestjs/common';
import { NetworkService } from './network.service';
import { NmapAgentService } from './agents/nmap.service';
import { TracerouteAgentService } from './agents/traceroute.service';
import { NetstatAgentService } from './agents/netstat.service';
import { NetworkController } from './network.controller';

@Module({
  controllers: [NetworkController],
  providers: [
    NetworkService,
    NmapAgentService,
    TracerouteAgentService,
    NetstatAgentService
  ],
  exports: [NetworkService]
})
export class NetworkModule {} 
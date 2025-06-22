import { Module } from "@nestjs/common"
import { NetworkService } from "./network.service"
import { EnhancedNetworkService } from "./enhanced-network.service"
import { WindowsPowerShellService } from "./agents/windows-powershell.service"
import { PythonAdvancedService } from "./agents/python-advanced.service"
import { NmapAgentService } from "./agents/nmap.service"
import { TracerouteAgentService } from "./agents/traceroute.service"
import { NetstatAgentService } from "./agents/netstat.service"
import { NetworkController } from "./network.controller"
import { NetworkDetectorService } from "./network-detector.service"
import { NetworkGateway } from "./network.gateway"

@Module({
  controllers: [NetworkController],
  providers: [
    // Services originaux
    NetworkService,
    NmapAgentService,
    TracerouteAgentService,
    NetstatAgentService,
    NetworkDetectorService,

    // Nouveaux services améliorés
    WindowsPowerShellService,
    PythonAdvancedService,
    EnhancedNetworkService,

    // Gateway WebSocket
    NetworkGateway,
  ],
  exports: [
    NetworkService,
    EnhancedNetworkService,
    NetworkDetectorService,
    WindowsPowerShellService,
    PythonAdvancedService,
  ],
})
export class NetworkModule {}

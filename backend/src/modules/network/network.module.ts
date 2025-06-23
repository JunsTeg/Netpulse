import { Module } from "@nestjs/common"
import { ScheduleModule } from "@nestjs/schedule"
import { NetworkService } from "./network.service"
import { EnhancedNetworkService } from "./enhanced-network.service"
import { WindowsPowerShellService } from "./agents/windows-powershell.service"
import { PythonAdvancedService } from "./agents/python-advanced.service"
import { NmapAgentService } from "./agents/nmap.service"
import { TracerouteAgentService } from "./agents/traceroute.service"
import { NetstatAgentService } from "./agents/netstat.service"
import { RouterQueryService } from "./agents/router-query.service"
import { NetworkController } from "./network.controller"
import { NetworkDetectorService } from "./network-detector.service"
import { NetworkGateway } from "./network.gateway"
import { AuthModule } from "../../auth/auth.module"
import { JwtStrategy } from "../../auth/strategies/jwt.strategy"
import { AppareilRepository } from "./appareil.repository"

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule
  ],
  controllers: [NetworkController],
  providers: [
    // Services d'agents (dépendances de base)
    NmapAgentService,
    TracerouteAgentService,
    NetstatAgentService,
    RouterQueryService,
    
    // Services Windows et Python
    WindowsPowerShellService,
    PythonAdvancedService,
    
    // Services principaux (dépendent des agents)
    NetworkService,
    EnhancedNetworkService,
    
    // Services de détection et gateway (dépendent des services principaux)
    NetworkDetectorService,
    NetworkGateway,
    
    // Stratégie JWT pour l'authentification
    JwtStrategy,
    AppareilRepository,
  ],
  exports: [
    NetworkService,
    EnhancedNetworkService,
    NetworkDetectorService,
    WindowsPowerShellService,
    PythonAdvancedService,
    RouterQueryService,
  ],
})
export class NetworkModule {}

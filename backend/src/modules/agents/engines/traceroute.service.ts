import { Injectable } from '@nestjs/common';
import { TracerouteAgentService } from '../../network/agents/traceroute.service';

@Injectable()
export class TracerouteEngineService extends TracerouteAgentService {
  // Service qui fait un alias vers le service traceroute de network
} 
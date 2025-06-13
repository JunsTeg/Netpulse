import { Injectable } from '@nestjs/common';
import { NmapAgentService } from '../../network/agents/nmap.service';

@Injectable()
export class NmapEngineService extends NmapAgentService {
  // Service qui fait un alias vers le service nmap de network
}

export const runNmap = async (config: any) => {
  const service = new NmapEngineService();
  return service.execute(config);
}; 
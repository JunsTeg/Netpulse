import { Injectable } from '@nestjs/common';
import { PcapAgentService } from '../../logs/agents/pcap.service';

@Injectable()
export class PcapEngineService extends PcapAgentService {
  // Service qui fait un alias vers le service pcap de logs
}

export const runPcap = async (config: any) => {
  const service = new PcapEngineService();
  return service.execute(config);
}; 
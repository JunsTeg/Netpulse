import { runNmap } from './engines/nmap.service';
import { runPcap } from './engines/pcap.service';

export async function executeAgent(agent) {
  switch (agent.type) {
    case 'nmap':
      return runNmap(agent.config);
    case 'pcap':
      return runPcap(agent.config);
    default:
      throw new Error('Agent non reconnu');
  }
}
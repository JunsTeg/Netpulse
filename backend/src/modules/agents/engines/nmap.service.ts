import { Injectable } from '@nestjs/common';
import { NmapAgentService } from '../../network/agents/nmap.service';
import { AppareilRepository } from '../../network/appareil.repository';

@Injectable()
export class NmapEngineService extends NmapAgentService {
  constructor(appareilRepository: AppareilRepository) {
    super(appareilRepository);
  }
}

export const runNmap = async (config: any) => {
  // Pour l'utilisation standalone, créer une instance avec un repository temporaire
  // Cette fonction est probablement utilisée en dehors du contexte NestJS
  const appareilRepository = new AppareilRepository();
  const service = new NmapEngineService(appareilRepository);
  return service.execute(config);
}; 
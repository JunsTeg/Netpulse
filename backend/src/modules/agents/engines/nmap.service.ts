import { Injectable } from '@nestjs/common';
import { NmapAgentService } from '../../network/agents/nmap.service';
import { AppareilRepository } from '../../network/appareil.repository';
import { OuiService } from '../../network/services/oui.service';
import { DeviceTypeService } from '../../network/services/device-type.service';

@Injectable()
export class NmapEngineService extends NmapAgentService {
  constructor(
    appareilRepository: AppareilRepository,
    ouiService: OuiService,
    deviceTypeService: DeviceTypeService,
  ) {
    super(appareilRepository, ouiService, deviceTypeService);
  }
}

export const runNmap = async (config: any) => {
  // Pour l'utilisation standalone, créer une instance avec un repository temporaire
  // Cette fonction est probablement utilisée en dehors du contexte NestJS
  const appareilRepository = new AppareilRepository();
  const ouiService = new OuiService();
  const deviceTypeService = new DeviceTypeService(ouiService);
  const service = new NmapEngineService(appareilRepository, ouiService, deviceTypeService);
  return service.execute(config);
}; 
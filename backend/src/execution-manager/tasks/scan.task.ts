import { ExecutionTask } from '../execution-task.interface';
import { v4 as uuidv4 } from 'uuid';

export class ScanTask implements ExecutionTask {
  id = uuidv4();
  type = 'scan';
  priority: number;
  isImmediate = false;
  userId?: string;
  context?: any;
  dependencies?: string[];
  onComplete?: () => void;
  onError?: (error: any) => void;
  cancel?: () => void;
  logError?: (error: any) => void;

  constructor(
    public run: () => Promise<any>,
    opts: Partial<Omit<ScanTask, 'run' | 'id' | 'type'>> = {}
  ) {
    Object.assign(this, opts);
  }
} 
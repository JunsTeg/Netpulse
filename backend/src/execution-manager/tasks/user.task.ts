import { ExecutionTask } from '../execution-task.interface';
import { v4 as uuidv4 } from 'uuid';

export class UserTask implements ExecutionTask {
  id = uuidv4();
  type = 'user';
  priority: number;
  isImmediate = true;
  userId?: string;
  context?: any;
  dependencies?: string[];
  onComplete?: () => void;
  onError?: (error: any) => void;
  cancel?: () => void;
  logError?: (error: any) => void;

  constructor(
    public run: () => Promise<any>,
    opts: Partial<Omit<UserTask, 'run' | 'id' | 'type'>> = {}
  ) {
    Object.assign(this, opts);
  }
} 
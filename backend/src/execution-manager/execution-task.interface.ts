export interface ExecutionTask {
  id: string;
  type: string;
  priority: number;
  isImmediate: boolean;
  userId?: string;
  context?: any;
  run: () => Promise<any>;
  cancel?: () => void;
  onComplete?: () => void;
  onError?: (error: any) => void;
  dependencies?: string[];
  logError?: (error: any) => void;
} 
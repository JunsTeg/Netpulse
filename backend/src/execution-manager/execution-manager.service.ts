import { Injectable } from '@nestjs/common';
import { ExecutionTask } from './execution-task.interface';
import * as Tasks from './tasks';

@Injectable()
export class ExecutionManagerService {
  private queue: ExecutionTask[] = [];
  private running: ExecutionTask[] = [];
  private maxWorkers = 4;
  private reservedSlotBusy = false;
  private disconnected = false;
  private logs: string[] = [];
  private metrics = {
    totalSubmitted: 0,
    totalCompleted: 0,
    totalCancelled: 0,
    totalFailed: 0,
  };
  private autoScanTask: ExecutionTask | null = null;
  private autoScanRunning = false;

  private log(message: string) {
    const entry = `[${new Date().toISOString()}] ${message}`;
    this.logs.push(entry);
    if (this.logs.length > 1000) this.logs.shift();
    console.log(entry);
  }

  private logError(message: string) {
    const entry = `[${new Date().toISOString()}] ERROR: ${message}`;
    this.logs.push(entry);
    if (this.logs.length > 1000) this.logs.shift();
    console.error(entry);
  }

  private handleTaskError(task: ExecutionTask, error: any) {
    if (task.logError) {
      task.logError(error);
    } else {
      this.logError(`Erreur centralisée: ${task.type} (${task.id}) - ${error}`);
    }
  }

  launchAutoScan(scanTaskFactory: () => ExecutionTask) {
    if (this.autoScanRunning) return;
    this.autoScanTask = scanTaskFactory();
    this.autoScanRunning = true;
    this.autoScanTask.cancel = () => {
      this.autoScanRunning = false;
      this.log('Scan auto interrompu par scan manuel ou déconnexion');
    };
    this.submit(this.autoScanTask);
  }

  interruptAutoScanIfManualScan(task: ExecutionTask) {
    if (task.type === 'scan' && !task.isImmediate && this.autoScanRunning && this.autoScanTask) {
      this.autoScanTask.cancel && this.autoScanTask.cancel();
      this.autoScanTask = null;
      this.autoScanRunning = false;
      this.log('Scan auto interrompu car scan manuel lancé');
    }
  }

  submit(task: ExecutionTask) {
    if (task.type === 'scan' && !task.isImmediate) {
      this.interruptAutoScanIfManualScan(task);
    }
    this.metrics.totalSubmitted++;
    this.log(`Tâche soumise: ${task.type} (${task.id}) par ${task.userId || 'système'}`);
    if (this.disconnected) throw new Error('Déconnecté : aucune tâche acceptée');
    if (task.isImmediate) {
      return this.executeImmediate(task);
    } else {
      this.queue.push(task);
      this.tryRunNext();
    }
  }

  private executeImmediate(task: ExecutionTask) {
    if (this.reservedSlotBusy) {
      setTimeout(() => this.executeImmediate(task), 10);
    } else {
      this.reservedSlotBusy = true;
      this.log(`Tâche immédiate démarrée: ${task.type} (${task.id})`);
      task.run().then(() => {
        this.metrics.totalCompleted++;
        this.log(`Tâche immédiate terminée: ${task.type} (${task.id})`);
      }).catch(e => {
        this.metrics.totalFailed++;
        this.handleTaskError(task, e);
      }).finally(() => {
        this.reservedSlotBusy = false;
      });
    }
  }

  private tryRunNext() {
    while (this.running.length < this.maxWorkers && this.queue.length > 0 && !this.disconnected) {
      this.queue.sort((a, b) => b.priority - a.priority);
      const nextTask = this.queue.shift();
      this.running.push(nextTask);
      this.log(`Tâche longue démarrée: ${nextTask.type} (${nextTask.id})`);
      nextTask.run().then(() => {
        this.metrics.totalCompleted++;
        this.log(`Tâche longue terminée: ${nextTask.type} (${nextTask.id})`);
      }).catch(e => {
        this.metrics.totalFailed++;
        this.handleTaskError(nextTask, e);
      }).finally(() => {
        this.running = this.running.filter(t => t !== nextTask);
        this.tryRunNext();
      });
    }
  }

  disconnect() {
    this.disconnected = true;
    this.running.forEach(task => task.cancel && task.cancel());
    this.queue.forEach(task => task.cancel && task.cancel());
    this.running = [];
    this.queue = [];
    this.reservedSlotBusy = false;
  }

  reconnect() {
    this.disconnected = false;
    this.tryRunNext();
  }

  listTasks() {
    return {
      running: this.running.map(t => ({ id: t.id, type: t.type, userId: t.userId, state: 'running' })),
      queued: this.queue.map(t => ({ id: t.id, type: t.type, userId: t.userId, state: 'queued' })),
      reservedSlot: this.reservedSlotBusy ? 'busy' : 'free',
    };
  }

  getTaskById(id: string) {
    return (
      this.running.find(t => t.id === id) ||
      this.queue.find(t => t.id === id)
    );
  }

  cancelTask(id: string) {
    const task = this.getTaskById(id);
    if (task && task.cancel) {
      task.cancel();
      this.metrics.totalCancelled++;
      this.log(`Tâche annulée: ${task.type} (${task.id})`);
      this.queue = this.queue.filter(t => t.id !== id);
      this.running = this.running.filter(t => t.id !== id);
      return true;
    }
    return false;
  }

  getLogs() {
    return this.logs;
  }

  getMetrics() {
    return this.metrics;
  }
} 
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { TaskStatus, ProcessParams, SimulationResult, RealtimeMetrics } from '../types';

const STATUS_FLOW: TaskStatus[] = [
  'pending',
  'model_building',
  'plasma_calculation',
  'rate_analysis',
  'profile_evolution',
  'completed'
];

const STATUS_DURATIONS = {
  model_building: 3000,
  plasma_calculation: 5000,
  rate_analysis: 3000,
  profile_evolution: 4000,
};

class SimulationEngine {
  private io: Server | null = null;
  private runningTasks: Map<string, NodeJS.Timeout[]> = new Map();

  initialize(io: Server) {
    this.io = io;
    console.log('Simulation engine initialized');
  }

  async startTask(taskId: string) {
    const task = db.findOne('tasks', (t) => t.id === taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const batch = db.findOne('batches', (b) => b.id === task.batchId);
    if (batch && batch.status === 'paused') {
      throw new Error('Batch is paused, cannot start task');
    }

    const updatedTask = db.update('tasks', (t) => t.id === taskId, {
      status: 'model_building',
      startedAt: new Date(),
      progress: 5,
      realtimeMetrics: []
    });

    this.notifyTaskUpdate(updatedTask!);
    this.processNextStatus(taskId);
  }

  private async processNextStatus(taskId: string) {
    const task = db.findOne('tasks', (t) => t.id === taskId);
    if (!task || task.status === 'completed' || task.status === 'error') {
      return;
    }

    const currentIndex = STATUS_FLOW.indexOf(task.status);
    if (currentIndex === -1 || currentIndex >= STATUS_FLOW.length - 1) {
      return;
    }

    const nextStatus = STATUS_FLOW[currentIndex + 1] as TaskStatus;
    const duration = STATUS_DURATIONS[nextStatus as keyof typeof STATUS_DURATIONS] || 2000;

    const progressSteps = 10;
    const stepDuration = duration / progressSteps;
    const baseProgress = (currentIndex / (STATUS_FLOW.length - 1)) * 100;
    const nextBaseProgress = ((currentIndex + 1) / (STATUS_FLOW.length - 1)) * 100;
    const progressRange = nextBaseProgress - baseProgress;

    let step = 0;
    const intervalId = setInterval(async () => {
      step++;
      const progress = Math.min(95, baseProgress + (progressRange * step / progressSteps));
      
      const currentTask = db.findOne('tasks', (t) => t.id === taskId);
      if (!currentTask) {
        clearInterval(intervalId);
        return;
      }
      
      const metrics = this.generateRealtimeMetrics(currentTask, progress, nextStatus);
      
      const updatedRealtimeMetrics = currentTask.realtimeMetrics ? [...currentTask.realtimeMetrics] : [];
      updatedRealtimeMetrics.push(metrics);
      if (updatedRealtimeMetrics.length > 100) {
        updatedRealtimeMetrics.splice(0, updatedRealtimeMetrics.length - 100);
      }
      
      const updatedTask = db.update('tasks', (t) => t.id === taskId, {
        progress,
        realtimeMetrics: updatedRealtimeMetrics
      });
      
      if (updatedTask) {
        this.notifyTaskUpdate(updatedTask);
        this.notifyMetrics(taskId, metrics);
        await this.checkWarnings(updatedTask, metrics);
      }

      if (step >= progressSteps) {
        clearInterval(intervalId);
        await this.advanceStatus(taskId, nextStatus);
      }
    }, stepDuration);

    this.addTaskTimeout(taskId, intervalId);
  }

  private async advanceStatus(taskId: string, nextStatus: TaskStatus) {
    const task = db.findOne('tasks', (t) => t.id === taskId);
    if (!task) return;

    const updates: any = { status: nextStatus };

    if (nextStatus === 'completed') {
      updates.progress = 100;
      updates.completedAt = new Date();
      updates.result = this.generateSimulationResult(task.parameters);
    }

    const updatedTask = db.update('tasks', (t) => t.id === taskId, updates);
    
    if (updatedTask) {
      this.notifyTaskUpdate(updatedTask);

      if (nextStatus === 'completed') {
        await this.updateBatchAfterTaskCompletion(updatedTask);
        await this.checkBatchNonuniformity(updatedTask.batchId);
      }
    }

    if (nextStatus !== 'completed') {
      setTimeout(() => this.processNextStatus(taskId), 500);
    }
  }

  private generateRealtimeMetrics(task: any, progress: number, status: TaskStatus): RealtimeMetrics {
    const params = task.parameters;
    
    const baseAngle = 88 + (params.rf_power / 1000) * 2 - (params.pressure / 100) * 1;
    const angleVariation = Math.sin(progress / 10) * 1.5;
    const profileAngle = baseAngle + angleVariation + (Math.random() - 0.5) * 0.5;

    const baseSelectivity = 15 + (params.gas_ratio.CF4 / 50) * 5 + (params.bias_power / 500) * 3;
    const selectivity = Math.max(5, baseSelectivity + (Math.random() - 0.5) * 2);

    const baseRate = 100 + (params.rf_power / 1000) * 50 + (params.pressure / 100) * 20;
    const etchRate = baseRate + (Math.random() - 0.5) * 10;

    const roughness = 1.5 + (100 - progress) / 50 + Math.random() * 0.5;

    return {
      timestamp: new Date(),
      profileAngle: Number(profileAngle.toFixed(2)),
      selectivity: Number(selectivity.toFixed(2)),
      etchRate: Number(etchRate.toFixed(2)),
      roughness: Number(roughness.toFixed(3)),
      progress: Number(progress.toFixed(1))
    };
  }

  private generateSimulationResult(params: ProcessParams): SimulationResult {
    const points = 50;
    const rate_distribution = Array.from({ length: points }, (_, i) => {
      const center = points / 2;
      const distance = Math.abs(i - center) / center;
      const baseRate = 100 + (params.rf_power / 1000) * 50;
      return baseRate * (1 - distance * 0.3) + (Math.random() - 0.5) * 10;
    });

    const roughness_curve = Array.from({ length: 200 }, (_, i) => {
      return 1 + Math.sin(i / 10) * 0.3 + Math.sin(i / 3) * 0.1 + Math.random() * 0.2;
    });

    const profile_coords = Array.from({ length: 100 }, (_, i) => {
      const x = i;
      const depthFactor = i / 100;
      const etchDepth = 500 + (params.rf_power / 1000) * 200;
      const sidewallAngle = 88 + (params.rf_power / 1000) * 2;
      const sidewallOffset = (depthFactor * etchDepth) / Math.tan(sidewallAngle * Math.PI / 180);
      return { x, y: 50 - sidewallOffset + (Math.random() - 0.5) * 2 };
    });

    const time_series = Array.from({ length: 50 }, (_, i) => ({
      time: i * 10,
      angle: 88 + Math.sin(i / 5) * 1.5 + (Math.random() - 0.5) * 0.5,
      selectivity: 15 + Math.sin(i / 8) * 2 + (Math.random() - 0.5),
      rate: 100 + Math.sin(i / 6) * 10 + (Math.random() - 0.5) * 5
    }));

    return {
      profile_angle: 89.5 + (params.rf_power / 1000) * 1.5,
      selectivity: 16 + (params.gas_ratio.CF4 / 50) * 4,
      uniformity: 95 + Math.random() * 4,
      etch_depth: 520 + (params.rf_power / 1000) * 180,
      etch_rate: 105 + (params.rf_power / 1000) * 45,
      rate_distribution,
      roughness_curve,
      profile_coords,
      time_series
    };
  }

  private async checkWarnings(task: any, metrics: RealtimeMetrics) {
    const warnings = [];

    const targetAngle = 90;
    if (Math.abs(metrics.profileAngle - targetAngle) > 2) {
      warnings.push({
        type: 'angle_deviation' as const,
        message: `刻蚀剖面角度偏差过大: ${metrics.profileAngle.toFixed(2)}°，目标角度: ${targetAngle}°`,
        threshold: 2,
        actualValue: Math.abs(metrics.profileAngle - targetAngle)
      });
    }

    const minSelectivity = 10;
    if (metrics.selectivity < minSelectivity) {
      warnings.push({
        type: 'selectivity_low' as const,
        message: `刻蚀选择性过低: ${metrics.selectivity.toFixed(2)}，最低阈值: ${minSelectivity}`,
        threshold: minSelectivity,
        actualValue: metrics.selectivity
      });
    }

    for (const w of warnings) {
      const existingWarning = db.findOne('warnings', (warn: any) => 
        warn.taskId === task.id && warn.type === w.type && !warn.acknowledged
      );

      if (!existingWarning) {
        const warning = db.create('warnings', {
          id: uuidv4(),
          taskId: task.id,
          acknowledged: false,
          createdAt: new Date(),
          ...w
        });
        this.notifyWarning(warning);
      }
    }
  }

  private async updateBatchAfterTaskCompletion(task: any) {
    const batch = db.findOne('batches', (b: any) => b.id === task.batchId);
    if (batch) {
      db.update('batches', (b: any) => b.id === task.batchId, {
        completedCount: (batch.completedCount || 0) + 1
      });
    }
  }

  private async checkBatchNonuniformity(batchId: string) {
    const batch = db.findOne('batches', (b: any) => b.id === batchId);
    
    if (!batch) return;

    const tasks = db.find('tasks', (t: any) => t.batchId === batchId);
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.result);
    if (completedTasks.length < 3) return;

    const recentTasks = completedTasks.slice(-3);
    const nonuniformCount = recentTasks.filter(t => {
      if (!t.result) return false;
      return t.result.uniformity < 95;
    }).length;

    const updates: any = { nonuniformCount };

    if (nonuniformCount >= 3) {
      updates.status = 'paused';
      updates.pauseReason = '连续三次模拟刻蚀不均匀度超过5%';
    }

    const updatedBatch = db.update('batches', (b: any) => b.id === batchId, updates);
    
    if (updatedBatch && nonuniformCount >= 3) {
      this.notifyBatchPaused(updatedBatch);
    }
  }

  async adjustParameters(taskId: string, newParams: Partial<ProcessParams>, reason: string, adjustedBy: string) {
    const task = db.findOne('tasks', (t: any) => t.id === taskId);
    if (!task) throw new Error('Task not found');

    this.stopTask(taskId);

    const updatedTask = db.update('tasks', (t: any) => t.id === taskId, {
      parameters: { ...task.parameters, ...newParams },
      adjustCount: (task.adjustCount || 0) + 1,
      status: 'model_building',
      progress: 5,
      realtimeMetrics: [],
      result: undefined,
      startedAt: new Date(),
      completedAt: undefined
    });

    if (updatedTask) {
      this.notifyTaskUpdate(updatedTask);
    }

    setTimeout(() => this.processNextStatus(taskId), 500);

    return updatedTask;
  }

  stopTask(taskId: string) {
    const timeouts = this.runningTasks.get(taskId);
    if (timeouts) {
      timeouts.forEach(t => clearInterval(t));
      this.runningTasks.delete(taskId);
    }
  }

  private addTaskTimeout(taskId: string, timeout: NodeJS.Timeout) {
    const timeouts = this.runningTasks.get(taskId) || [];
    timeouts.push(timeout);
    this.runningTasks.set(taskId, timeouts);
  }

  private notifyTaskUpdate(task: any) {
    if (this.io) {
      this.io.emit('task:update', {
        taskId: task.id,
        status: task.status,
        progress: task.progress
      });
    }
  }

  private notifyMetrics(taskId: string, metrics: RealtimeMetrics) {
    if (this.io) {
      this.io.emit(`task:${taskId}:metrics`, metrics);
    }
  }

  private notifyWarning(warning: any) {
    if (this.io) {
      this.io.emit('warning:new', warning);
    }
  }

  private notifyBatchPaused(batch: any) {
    if (this.io) {
      this.io.emit('batch:paused', batch);
    }
  }
}

export const simulationEngine = new SimulationEngine();

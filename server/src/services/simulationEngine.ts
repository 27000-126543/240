import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../data-source';
import { Task } from '../entities/Task';
import { Batch } from '../entities/Batch';
import { Warning } from '../entities/Warning';
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
  private taskRepository = AppDataSource.getRepository(Task);
  private batchRepository = AppDataSource.getRepository(Batch);
  private warningRepository = AppDataSource.getRepository(Warning);

  initialize(io: Server) {
    this.io = io;
    console.log('Simulation engine initialized');
  }

  async startTask(taskId: string) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) {
      throw new Error('Task not found');
    }

    const batch = await this.batchRepository.findOne({ where: { id: task.batchId } });
    if (batch && batch.status === 'paused') {
      throw new Error('Batch is paused, cannot start task');
    }

    task.status = 'model_building';
    task.startedAt = new Date();
    task.progress = 5;
    task.realtimeMetrics = [];
    await this.taskRepository.save(task);

    this.notifyTaskUpdate(task);
    this.processNextStatus(taskId);
  }

  private async processNextStatus(taskId: string) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
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
      
      const metrics = this.generateRealtimeMetrics(task, progress, nextStatus);
      
      task.progress = progress;
      if (task.realtimeMetrics) {
        task.realtimeMetrics.push(metrics);
        if (task.realtimeMetrics.length > 100) {
          task.realtimeMetrics = task.realtimeMetrics.slice(-100);
        }
      }
      
      await this.taskRepository.save(task);
      this.notifyTaskUpdate(task);
      this.notifyMetrics(task.id, metrics);

      await this.checkWarnings(task, metrics);

      if (step >= progressSteps) {
        clearInterval(intervalId);
        await this.advanceStatus(taskId, nextStatus);
      }
    }, stepDuration);

    this.addTaskTimeout(taskId, intervalId);
  }

  private async advanceStatus(taskId: string, nextStatus: TaskStatus) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) return;

    task.status = nextStatus;

    if (nextStatus === 'completed') {
      task.progress = 100;
      task.completedAt = new Date();
      task.result = this.generateSimulationResult(task.parameters);
      
      await this.updateBatchAfterTaskCompletion(task);
      await this.checkBatchNonuniformity(task.batchId);
    }

    await this.taskRepository.save(task);
    this.notifyTaskUpdate(task);

    if (nextStatus !== 'completed') {
      setTimeout(() => this.processNextStatus(taskId), 500);
    }
  }

  private generateRealtimeMetrics(task: Task, progress: number, status: TaskStatus): RealtimeMetrics {
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

  private async checkWarnings(task: Task, metrics: RealtimeMetrics) {
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
      const existingWarning = await this.warningRepository.findOne({
        where: {
          taskId: task.id,
          type: w.type,
          acknowledged: false
        }
      });

      if (!existingWarning) {
        const warning = this.warningRepository.create({
          id: uuidv4(),
          taskId: task.id,
          ...w
        });
        await this.warningRepository.save(warning);
        this.notifyWarning(warning);
      }
    }
  }

  private async updateBatchAfterTaskCompletion(task: Task) {
    const batch = await this.batchRepository.findOne({ where: { id: task.batchId } });
    if (batch) {
      batch.completedCount = (batch.completedCount || 0) + 1;
      await this.batchRepository.save(batch);
    }
  }

  private async checkBatchNonuniformity(batchId: string) {
    const batch = await this.batchRepository.findOne({ 
      where: { id: batchId },
      relations: ['tasks']
    });
    
    if (!batch) return;

    const completedTasks = batch.tasks.filter(t => t.status === 'completed' && t.result);
    if (completedTasks.length < 3) return;

    const recentTasks = completedTasks.slice(-3);
    const nonuniformCount = recentTasks.filter(t => {
      if (!t.result) return false;
      return t.result.uniformity < 95;
    }).length;

    batch.nonuniformCount = nonuniformCount;

    if (nonuniformCount >= 3) {
      batch.status = 'paused';
      batch.pauseReason = '连续三次模拟刻蚀不均匀度超过5%';
      this.notifyBatchPaused(batch);
    }

    await this.batchRepository.save(batch);
  }

  async adjustParameters(taskId: string, newParams: Partial<ProcessParams>, reason: string, adjustedBy: string) {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');

    this.stopTask(taskId);

    const beforeParams = { ...task.parameters };
    task.parameters = { ...task.parameters, ...newParams };
    task.adjustCount = (task.adjustCount || 0) + 1;
    task.status = 'model_building';
    task.progress = 5;
    task.realtimeMetrics = [];
    task.result = undefined;
    task.startedAt = new Date();
    task.completedAt = undefined;

    await this.taskRepository.save(task);
    this.notifyTaskUpdate(task);

    setTimeout(() => this.processNextStatus(taskId), 500);

    return task;
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

  private notifyTaskUpdate(task: Task) {
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

  private notifyWarning(warning: Warning) {
    if (this.io) {
      this.io.emit('warning:new', warning);
    }
  }

  private notifyBatchPaused(batch: Batch) {
    if (this.io) {
      this.io.emit('batch:paused', batch);
    }
  }
}

export const simulationEngine = new SimulationEngine();

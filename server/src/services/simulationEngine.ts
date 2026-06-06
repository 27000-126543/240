import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/sqlite';
import { TaskStatus, ProcessParams, SimulationResult, RealtimeMetrics } from '../types';
import { physicsEngine } from './physicsEngine';
import { maskParser } from './maskParser';

const STATUS_FLOW: TaskStatus[] = [
  'pending',
  'model_building',
  'plasma_calculation',
  'rate_analysis',
  'profile_evolution',
  'completed'
];

const STATUS_DURATIONS = {
  model_building: { min: 3000, max: 5000 },
  plasma_calculation: { min: 4000, max: 6000 },
  rate_analysis: { min: 3000, max: 4000 },
  profile_evolution: { min: 5000, max: 7000 },
};

interface RunningTaskInfo {
  intervals: NodeJS.Timeout[];
  startTime: number;
  metricsHistory: RealtimeMetrics[];
  currentStatus: TaskStatus;
  params: ProcessParams;
  maskModel?: any;
  plasmaState?: any;
  rateDistribution?: number[];
}

class SimulationEngine {
  private io: Server | null = null;
  private runningTasks: Map<string, RunningTaskInfo> = new Map();

  initialize(io: Server) {
    this.io = io;
    console.log('Simulation engine initialized');
  }

  async startTask(taskId: string) {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    const batch = db.get('SELECT * FROM batches WHERE id = ?', [task.batch_id]);
    if (batch && batch.status === 'paused') {
      throw new Error('Batch is paused, cannot start task');
    }

    const params = typeof task.parameters === 'string' ? JSON.parse(task.parameters) : task.parameters;
    
    this.stopTask(taskId);

    const taskInfo: RunningTaskInfo = {
      intervals: [],
      startTime: Date.now(),
      metricsHistory: [],
      currentStatus: 'model_building',
      params
    };
    this.runningTasks.set(taskId, taskInfo);

    db.run(
      'UPDATE tasks SET status = ?, started_at = ?, progress = ?, realtime_metrics = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['model_building', new Date().toISOString(), 5, JSON.stringify([]), taskId]
    );

    this.notifyTaskUpdate(taskId, 'model_building', 5);
    this.processStatus(taskId, 'model_building');
  }

  private async processStatus(taskId: string, status: TaskStatus) {
    const taskInfo = this.runningTasks.get(taskId);
    if (!taskInfo) return;

    taskInfo.currentStatus = status;

    const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task || task.status === 'completed' || task.status === 'error') {
      this.stopTask(taskId);
      return;
    }

    const durationRange = STATUS_DURATIONS[status as keyof typeof STATUS_DURATIONS];
    if (!durationRange) {
      if (status === 'completed') return;
      await this.advanceToNextStatus(taskId, status);
      return;
    }

    const duration = durationRange.min + Math.random() * (durationRange.max - durationRange.min);
    const currentIndex = STATUS_FLOW.indexOf(status);
    const baseProgress = (currentIndex / (STATUS_FLOW.length - 1)) * 100;
    const nextBaseProgress = ((currentIndex + 1) / (STATUS_FLOW.length - 1)) * 100;
    const progressRange = nextBaseProgress - baseProgress;

    const startTime = Date.now();
    const elapsedBefore = (Date.now() - taskInfo.startTime) / 1000;

    if (status === 'model_building') {
      try {
        const maskFile = task.mask_file;
        if (maskFile) {
          taskInfo.maskModel = await maskParser.parseFile(maskFile, taskId);
        } else {
          taskInfo.maskModel = {
            layers: [],
            boundingBox: { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 },
            featuresCount: 50,
            threeDModel: { voxels: [], resolution: 1, depth: 50 }
          };
        }
      } catch (e) {
        console.error('Mask parsing failed:', e);
        taskInfo.maskModel = {
          layers: [],
          boundingBox: { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 },
          featuresCount: 50,
          threeDModel: { voxels: [], resolution: 1, depth: 50 }
        };
      }
    }

    if (status === 'plasma_calculation') {
      taskInfo.plasmaState = physicsEngine.calculatePlasmaState(taskInfo.params);
    }

    if (status === 'rate_analysis') {
      taskInfo.rateDistribution = physicsEngine.generateRateDistribution(taskInfo.params, 100);
    }

    const metricsInterval = setInterval(() => {
      const now = Date.now();
      const elapsedInStatus = (now - startTime) / duration;
      const progress = Math.min(95, baseProgress + progressRange * Math.min(1, elapsedInStatus));
      const totalElapsed = (now - taskInfo.startTime) / 1000;

      const metrics = this.calculateRealtimeMetrics(taskInfo, progress, totalElapsed, status);
      taskInfo.metricsHistory.push(metrics);

      if (taskInfo.metricsHistory.length > 500) {
        taskInfo.metricsHistory = taskInfo.metricsHistory.slice(-500);
      }

      db.run(
        'UPDATE tasks SET progress = ?, realtime_metrics = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [progress, JSON.stringify(taskInfo.metricsHistory), taskId]
      );

      this.notifyTaskUpdate(taskId, status, progress);
      this.notifyMetrics(taskId, metrics);
      this.checkWarnings(taskId, task, metrics);

      if (elapsedInStatus >= 1) {
        clearInterval(metricsInterval);
        this.advanceToNextStatus(taskId, status);
      }
    }, 5000);

    taskInfo.intervals.push(metricsInterval);

    setTimeout(() => {
      clearInterval(metricsInterval);
      if (taskInfo.currentStatus === status) {
        this.advanceToNextStatus(taskId, status);
      }
    }, duration);
  }

  private calculateRealtimeMetrics(
    taskInfo: RunningTaskInfo,
    progress: number,
    timeElapsed: number,
    status: TaskStatus
  ): RealtimeMetrics {
    const metrics = physicsEngine.calculateAllMetrics(taskInfo.params, progress, timeElapsed);

    const timeFactor = Math.min(1, timeElapsed / 30);
    const fluctuation = 1 + (Math.random() - 0.5) * 0.1 * timeFactor;

    return {
      timestamp: new Date(),
      profileAngle: Number((metrics.profileAngle * fluctuation).toFixed(2)),
      selectivity: Number((metrics.selectivity * (1 + (Math.random() - 0.5) * 0.05)).toFixed(2)),
      etchRate: Number((metrics.etchRate * fluctuation).toFixed(2)),
      roughness: Number(metrics.roughness.toFixed(3)),
      progress: Number(progress.toFixed(1))
    };
  }

  private async advanceToNextStatus(taskId: string, currentStatus: TaskStatus) {
    const taskInfo = this.runningTasks.get(taskId);
    if (!taskInfo) return;

    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex === -1 || currentIndex >= STATUS_FLOW.length - 1) {
      return;
    }

    const nextStatus = STATUS_FLOW[currentIndex + 1] as TaskStatus;

    if (nextStatus === 'completed') {
      await this.completeTask(taskId);
    } else {
      db.run(
        'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [nextStatus, taskId]
      );
      this.notifyTaskUpdate(taskId, nextStatus, taskInfo.metricsHistory[taskInfo.metricsHistory.length - 1]?.progress || 0);
      setTimeout(() => this.processStatus(taskId, nextStatus), 300);
    }
  }

  private async completeTask(taskId: string) {
    const taskInfo = this.runningTasks.get(taskId);
    if (!taskInfo) return;

    const totalElapsed = (Date.now() - taskInfo.startTime) / 1000;
    const finalMetrics = physicsEngine.calculateAllMetrics(taskInfo.params, 100, totalElapsed);

    const rateDistribution = physicsEngine.generateRateDistribution(taskInfo.params, 100);
    const roughnessCurve = physicsEngine.generateRoughnessCurve(taskInfo.params, totalElapsed, 200);
    const profileCoords = physicsEngine.generateProfileCoords(taskInfo.params, finalMetrics.etchDepth, 100);

    const timeSeries = taskInfo.metricsHistory.map((m, i) => ({
      time: i * 5,
      angle: m.profileAngle,
      selectivity: m.selectivity,
      rate: m.etchRate
    }));

    const result: SimulationResult = {
      profile_angle: finalMetrics.profileAngle,
      selectivity: finalMetrics.selectivity,
      uniformity: finalMetrics.uniformity,
      etch_depth: finalMetrics.etchDepth,
      etch_rate: finalMetrics.etchRate,
      rate_distribution: rateDistribution,
      roughness_curve: roughnessCurve,
      profile_coords: profileCoords,
      time_series: timeSeries
    };

    db.run(
      'UPDATE tasks SET status = ?, progress = ?, completed_at = ?, result = ?, realtime_metrics = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', 100, new Date().toISOString(), JSON.stringify(result), JSON.stringify(taskInfo.metricsHistory), taskId]
    );

    this.notifyTaskUpdate(taskId, 'completed', 100);
    this.notifyTaskCompleted(taskId, result);

    this.stopTask(taskId);
    await this.updateBatchAfterTaskCompletion(taskId);
    await this.checkBatchNonuniformity(taskId);
  }

  private checkWarnings(taskId: string, task: any, metrics: RealtimeMetrics) {
    const targetAngle = 90;
    if (Math.abs(metrics.profileAngle - targetAngle) > 2) {
      this.createWarning(taskId, 'angle_deviation',
        `刻蚀剖面角度偏差过大: ${metrics.profileAngle.toFixed(2)}°，目标角度: ${targetAngle}°`,
        2, Math.abs(metrics.profileAngle - targetAngle)
      );
    }

    const minSelectivity = 10;
    if (metrics.selectivity < minSelectivity) {
      this.createWarning(taskId, 'selectivity_low',
        `刻蚀选择性过低: ${metrics.selectivity.toFixed(2)}，最低阈值: ${minSelectivity}`,
        minSelectivity, metrics.selectivity
      );
    }
  }

  private createWarning(taskId: string, type: string, message: string, threshold: number, actualValue: number) {
    const existing = db.get(
      'SELECT * FROM warnings WHERE task_id = ? AND type = ? AND acknowledged = 0',
      [taskId, type]
    );

    if (!existing) {
      const id = uuidv4();
      db.run(
        'INSERT INTO warnings (id, task_id, type, message, threshold, actual_value, acknowledged, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)',
        [id, taskId, type, message, threshold, actualValue]
      );
      this.notifyWarning({
        id,
        taskId,
        type,
        message,
        threshold,
        actualValue,
        acknowledged: false,
        createdAt: new Date()
      });
    }
  }

  private async updateBatchAfterTaskCompletion(taskId: string) {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return;

    const batch = db.get('SELECT * FROM batches WHERE id = ?', [task.batch_id]);
    if (batch) {
      db.run(
        'UPDATE batches SET completed_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [(batch.completed_count || 0) + 1, task.batch_id]
      );
    }
  }

  private async checkBatchNonuniformity(taskId: string) {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return;

    const tasks = db.all('SELECT * FROM tasks WHERE batch_id = ? AND status = ?', [task.batch_id, 'completed']);
    const completedTasks = tasks.filter(t => t.result);
    if (completedTasks.length < 3) return;

    const recentTasks = completedTasks.slice(-3);
    const nonuniformCount = recentTasks.filter(t => {
      const result = typeof t.result === 'string' ? JSON.parse(t.result) : t.result;
      return result && result.uniformity < 95;
    }).length;

    const updates: any[] = [nonuniformCount];
    let sql = 'UPDATE batches SET nonuniform_count = ?';
    const params: any[] = [...updates];

    if (nonuniformCount >= 3) {
      sql += ', status = ?, pause_reason = ?';
      params.push('paused', '连续三次模拟刻蚀不均匀度超过5%');
    }

    sql += ', updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    params.push(task.batch_id);

    db.run(sql, params);

    if (nonuniformCount >= 3) {
      const batch = db.get('SELECT * FROM batches WHERE id = ?', [task.batch_id]);
      if (batch) {
        this.notifyBatchPaused(batch);
      }
    }
  }

  async adjustParameters(taskId: string, newParams: Partial<ProcessParams>, reason: string, adjustedBy: string = 'system') {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) throw new Error('Task not found');

    const oldParams = typeof task.parameters === 'string' ? JSON.parse(task.parameters) : task.parameters;
    const updatedParams = { ...oldParams, ...newParams };

    db.run(
      'INSERT INTO adjustments (id, task_id, before_params, after_params, reason, adjusted_by, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [uuidv4(), taskId, JSON.stringify(oldParams), JSON.stringify(updatedParams), reason, adjustedBy]
    );

    this.stopTask(taskId);

    db.run(
      'UPDATE tasks SET parameters = ?, adjust_count = ?, status = ?, progress = ?, realtime_metrics = ?, result = NULL, started_at = ?, completed_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(updatedParams), (task.adjust_count || 0) + 1, 'model_building', 5, JSON.stringify([]), new Date().toISOString(), taskId]
    );

    const taskInfo: RunningTaskInfo = {
      intervals: [],
      startTime: Date.now(),
      metricsHistory: [],
      currentStatus: 'model_building',
      params: updatedParams
    };
    this.runningTasks.set(taskId, taskInfo);

    this.notifyTaskUpdate(taskId, 'model_building', 5);
    setTimeout(() => this.processStatus(taskId, 'model_building'), 500);

    return db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
  }

  stopTask(taskId: string) {
    const taskInfo = this.runningTasks.get(taskId);
    if (taskInfo) {
      taskInfo.intervals.forEach(t => clearInterval(t));
      this.runningTasks.delete(taskId);
    }
  }

  private notifyTaskUpdate(taskId: string, status: string, progress: number) {
    if (this.io) {
      this.io.emit('task:update', { taskId, status, progress });
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

  private notifyTaskCompleted(taskId: string, result: SimulationResult) {
    if (this.io) {
      this.io.emit(`task:${taskId}:completed`, result);
    }
  }
}

export const simulationEngine = new SimulationEngine();

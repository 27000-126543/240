import { create } from 'zustand';
import type { Task, TaskStatus, ProcessParams, Warning, ParamAdjustment, ApprovalRecord, Batch } from '@/types';
import { api } from '@/services/api';

function convertTaskFromApi(t: any): Task {
  return {
    id: t.id,
    batchId: t.batch_id || t.batchId,
    name: t.name,
    maskFile: t.mask_file || t.maskFile,
    status: t.status,
    progress: t.progress,
    parameters: typeof t.parameters === 'string' ? JSON.parse(t.parameters) : t.parameters,
    result: t.result ? (typeof t.result === 'string' ? JSON.parse(t.result) : t.result) : undefined,
    realtimeMetrics: t.realtime_metrics || t.realtimeMetrics,
    warnings: (t.warnings || []).map((w: any) => ({
      id: w.id,
      taskId: w.task_id || w.taskId,
      type: w.type,
      message: w.message,
      threshold: w.threshold,
      actualValue: w.actual_value || w.actualValue,
      acknowledged: Boolean(w.acknowledged),
      acknowledgedBy: w.acknowledged_by || w.acknowledgedBy,
      ackComment: w.ack_comment || w.ackComment,
      createdAt: new Date(w.created_at || w.createdAt)
    })),
    adjustments: (t.adjustments || []).map((a: any) => ({
      id: a.id,
      taskId: a.task_id || a.taskId,
      beforeParams: typeof a.before_params === 'string' ? JSON.parse(a.before_params) : a.beforeParams || a.before_params,
      afterParams: typeof a.after_params === 'string' ? JSON.parse(a.after_params) : a.afterParams || a.after_params,
      reason: a.reason,
      adjustedBy: a.adjusted_by || a.adjustedBy,
      createdAt: new Date(a.created_at || a.createdAt)
    })),
    approvals: (t.approvals || []).map((a: any) => ({
      id: a.id,
      taskId: a.task_id || a.taskId,
      level: a.level,
      approver: a.approver,
      status: a.status,
      comment: a.comment,
      createdAt: new Date(a.created_at || a.createdAt),
      decidedAt: a.decided_at || a.decidedAt ? new Date(a.decided_at || a.decidedAt) : undefined
    })),
    adjustCount: t.adjust_count || t.adjustCount || 0,
    createdAt: new Date(t.created_at || t.createdAt),
    startedAt: t.started_at || t.startedAt ? new Date(t.started_at || t.startedAt) : undefined,
    completedAt: t.completed_at || t.completedAt ? new Date(t.completed_at || t.completedAt) : undefined,
    updatedAt: t.updated_at || t.updatedAt ? new Date(t.updated_at || t.updatedAt) : undefined,
  };
}

function convertBatchFromApi(b: any): Batch {
  return {
    id: b.id,
    name: b.name,
    status: b.status,
    nonuniformCount: b.nonuniform_count || b.nonuniformCount || 0,
    taskCount: b.task_count || b.taskCount || 0,
    completedCount: b.completed_count || b.completedCount || 0,
    pauseReason: b.pause_reason || b.pauseReason,
    tasks: (b.tasks || []).map((t: any) => convertTaskFromApi(t)),
    createdAt: new Date(b.created_at || b.createdAt)
  };
}

interface TaskStore {
  tasks: Task[];
  batches: Batch[];
  selectedTaskId: string | null;
  loading: boolean;
  error: string | null;
  setSelectedTaskId: (id: string | null) => void;
  getTaskById: (id: string) => Task | undefined;
  getTasksByBatch: (batchId: string) => Task[];
  fetchTasks: (params?: { batchId?: string; status?: string; page?: number; limit?: number }) => Promise<void>;
  fetchTask: (taskId: string) => Promise<void>;
  createTask: (data: { name: string; batchId: string; parameters?: any }) => Promise<Task>;
  startTask: (taskId: string) => Promise<void>;
  uploadMask: (taskId: string, file: File) => Promise<void>;
  adjustTaskParams: (taskId: string, data: { parameters: any; reason: string; adjustedBy?: string }) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus, progress?: number) => void;
  updateTaskProgress: (taskId: string, progress: number) => void;
  setTaskResult: (taskId: string, result: Task['result']) => void;
  addWarning: (taskId: string, warning: Omit<Warning, 'id' | 'createdAt'>) => void;
  acknowledgeWarning: (taskId: string, warningId: string) => void;
  addAdjustment: (taskId: string, adjustment: Omit<ParamAdjustment, 'id' | 'createdAt'>) => void;
  addApproval: (taskId: string, approval: Omit<ApprovalRecord, 'id' | 'createdAt'>) => void;
  updateApproval: (taskId: string, approvalId: string, status: ApprovalRecord['status'], comment: string) => void;
  updateTaskParams: (taskId: string, params: ProcessParams) => void;
  fetchBatches: () => Promise<void>;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  batches: [],
  selectedTaskId: null,
  loading: false,
  error: null,
  
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  
  getTaskById: (id) => get().tasks.find(t => t.id === id),
  
  getTasksByBatch: (batchId) => get().tasks.filter(t => t.batchId === batchId),
  
  fetchTasks: async (params) => {
    set({ loading: true, error: null });
    try {
      const data = await api.tasks.list(params) as any;
      const tasksData = Array.isArray(data) ? data : data.data || data.tasks || [];
      set({ tasks: tasksData.map((t: any) => convertTaskFromApi(t)) });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchTask: async (taskId) => {
    set({ loading: true, error: null });
    try {
      const t = await api.tasks.get(taskId) as any;
      const task = convertTaskFromApi(t);
      set(state => {
        const exists = state.tasks.some(t => t.id === taskId);
        if (exists) {
          return { tasks: state.tasks.map(t => t.id === taskId ? task : t) };
        } else {
          return { tasks: [task, ...state.tasks] };
        }
      });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  
  createTask: async (data) => {
    set({ loading: true, error: null });
    try {
      const newTask = await api.tasks.create(data) as any;
      const task = convertTaskFromApi(newTask);
      set(state => ({ tasks: [task, ...state.tasks] }));
      return task;
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  
  startTask: async (taskId) => {
    set({ loading: true, error: null });
    try {
      await api.tasks.start(taskId);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  
  uploadMask: async (taskId, file) => {
    set({ loading: true, error: null });
    try {
      await api.tasks.uploadMask(taskId, file);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  
  adjustTaskParams: async (taskId, data) => {
    set({ loading: true, error: null });
    try {
      await api.tasks.adjustParams(taskId, data);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  
  updateTaskStatus: (taskId, status, progress) => {
    set(state => ({
      tasks: state.tasks.map(t => {
        if (t.id === taskId) {
          const updates: Partial<Task> = { status };
          if (progress !== undefined) updates.progress = progress;
          if (status === 'model_building' && !t.startedAt) updates.startedAt = new Date();
          if (status === 'completed') updates.completedAt = new Date();
          return { ...t, ...updates };
        }
        return t;
      })
    }));
  },
  
  updateTaskProgress: (taskId, progress) => {
    set(state => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, progress } : t)
    }));
  },
  
  setTaskResult: (taskId, result) => {
    set(state => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, result } : t)
    }));
  },
  
  addWarning: (taskId, warning) => {
    set(state => ({
      tasks: state.tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            warnings: [...t.warnings, { ...warning, id: generateId(), createdAt: new Date() }]
          };
        }
        return t;
      })
    }));
  },
  
  acknowledgeWarning: (taskId, warningId) => {
    set(state => ({
      tasks: state.tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            warnings: t.warnings.map(w => w.id === warningId ? { ...w, acknowledged: true } : w)
          };
        }
        return t;
      })
    }));
  },
  
  addAdjustment: (taskId, adjustment) => {
    set(state => ({
      tasks: state.tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            adjustments: [...t.adjustments, { ...adjustment, id: generateId(), createdAt: new Date() }],
            adjustCount: t.adjustCount + 1,
          };
        }
        return t;
      })
    }));
  },
  
  addApproval: (taskId, approval) => {
    set(state => ({
      tasks: state.tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            approvals: [...t.approvals, { ...approval, id: generateId(), createdAt: new Date() }]
          };
        }
        return t;
      })
    }));
  },
  
  updateApproval: (taskId, approvalId, status, comment) => {
    set(state => ({
      tasks: state.tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            approvals: t.approvals.map(a => 
              a.id === approvalId ? { ...a, status, comment } : a
            )
          };
        }
        return t;
      })
    }));
  },
  
  updateTaskParams: (taskId, params) => {
    set(state => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, parameters: params } : t)
    }));
  },

  fetchBatches: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.batches.list() as any;
      const batchesData = Array.isArray(data) ? data : data.batches || [];
      set({ batches: batchesData.map((b: any) => convertBatchFromApi(b)) });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));

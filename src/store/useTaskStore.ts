import { create } from 'zustand';
import type { Task, TaskStatus, ProcessParams, Warning, ParamAdjustment, ApprovalRecord, Batch } from '@/types';
import { api } from '@/services/api';

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
      const tasks = Array.isArray(data) ? data : data.tasks || [];
      set({ tasks: tasks.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        startedAt: t.startedAt ? new Date(t.startedAt) : undefined,
        completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
        warnings: t.warnings?.map((w: any) => ({ ...w, createdAt: new Date(w.createdAt) })) || [],
        adjustments: t.adjustments?.map((a: any) => ({ ...a, createdAt: new Date(a.createdAt) })) || [],
        approvals: t.approvals?.map((a: any) => ({ ...a, createdAt: new Date(a.createdAt) })) || [],
      })) });
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
      const task = {
        ...t,
        createdAt: new Date(t.createdAt),
        startedAt: t.startedAt ? new Date(t.startedAt) : undefined,
        completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
        warnings: t.warnings?.map((w: any) => ({ ...w, createdAt: new Date(w.createdAt) })) || [],
        adjustments: t.adjustments?.map((a: any) => ({ ...a, createdAt: new Date(a.createdAt) })) || [],
        approvals: t.approvals?.map((a: any) => ({ ...a, createdAt: new Date(a.createdAt) })) || [],
      };
      set(state => ({
        tasks: state.tasks.map(t => t.id === taskId ? task : t),
      }));
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
      const task = {
        ...newTask,
        createdAt: new Date(newTask.createdAt),
        warnings: [],
        adjustments: [],
        approvals: [],
      };
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
      const batches = Array.isArray(data) ? data : data.batches || [];
      set({ batches: batches.map((b: any) => ({
        ...b,
        createdAt: new Date(b.createdAt),
      })) });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));

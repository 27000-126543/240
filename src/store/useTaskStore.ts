import { create } from 'zustand';
import type { Task, TaskStatus, ProcessParams, Warning, ParamAdjustment, ApprovalRecord, Batch } from '@/types';
import { mockTasks, mockBatches } from '@/data/mockData';

interface TaskStore {
  tasks: Task[];
  batches: Batch[];
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  getTaskById: (id: string) => Task | undefined;
  getTasksByBatch: (batchId: string) => Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'warnings' | 'adjustments' | 'approvals' | 'adjustCount'>) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus, progress?: number) => void;
  updateTaskProgress: (taskId: string, progress: number) => void;
  setTaskResult: (taskId: string, result: Task['result']) => void;
  addWarning: (taskId: string, warning: Omit<Warning, 'id' | 'createdAt'>) => void;
  acknowledgeWarning: (taskId: string, warningId: string) => void;
  addAdjustment: (taskId: string, adjustment: Omit<ParamAdjustment, 'id' | 'createdAt'>) => void;
  addApproval: (taskId: string, approval: Omit<ApprovalRecord, 'id' | 'createdAt'>) => void;
  updateApproval: (taskId: string, approvalId: string, status: ApprovalRecord['status'], comment: string) => void;
  updateTaskParams: (taskId: string, params: ProcessParams) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: mockTasks,
  batches: mockBatches,
  selectedTaskId: null,
  
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  
  getTaskById: (id) => get().tasks.find(t => t.id === id),
  
  getTasksByBatch: (batchId) => get().tasks.filter(t => t.batchId === batchId),
  
  addTask: (taskData) => {
    const newTask: Task = {
      ...taskData,
      id: `T${String(get().tasks.length + 1).padStart(4, '0')}`,
      warnings: [],
      adjustments: [],
      approvals: [],
      adjustCount: 0,
      createdAt: new Date(),
    };
    set(state => ({ tasks: [newTask, ...state.tasks] }));
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
}));

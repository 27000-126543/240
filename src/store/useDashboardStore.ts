import { create } from 'zustand';
import type { DashboardStats, ProcessCapability, Task, Warning } from '@/types';
import { api } from '@/services/api';

interface DashboardStore {
  stats: DashboardStats;
  capability: ProcessCapability[];
  weeklyTrends: any[];
  activeTasks: Task[];
  recentWarnings: Warning[];
  loading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
  fetchProcessCapability: () => Promise<void>;
  fetchWeeklyTrends: () => Promise<void>;
  fetchActiveTasks: () => Promise<void>;
  fetchRecentWarnings: () => Promise<void>;
  fetchAll: () => Promise<void>;
  refreshStats: () => void;
}

const defaultStats: DashboardStats = {
  completionRate: 0,
  rateDeviation: 0,
  optimizationCount: 0,
  activeTasks: 0,
  warningsToday: 0,
  approvalsPending: 0,
};

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  stats: defaultStats,
  capability: [],
  weeklyTrends: [],
  activeTasks: [],
  recentWarnings: [],
  loading: false,
  error: null,
  
  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.dashboard.getStats() as any;
      set({ stats: data });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchProcessCapability: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.dashboard.getProcessCapability() as any;
      set({ capability: Array.isArray(data) ? data : data.capability || [] });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchWeeklyTrends: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.dashboard.getWeeklyTrends() as any;
      set({ weeklyTrends: Array.isArray(data) ? data : data.trends || [] });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchActiveTasks: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.dashboard.getActiveTasks() as any;
      const tasks = Array.isArray(data) ? data : data.tasks || [];
      set({ 
        activeTasks: tasks.map((t: any) => ({
          id: t.id,
          batchId: t.batch_id || t.batchId,
          name: t.name,
          status: t.status,
          progress: t.progress,
          parameters: typeof t.parameters === 'string' ? JSON.parse(t.parameters) : t.parameters,
          result: t.result ? (typeof t.result === 'string' ? JSON.parse(t.result) : t.result) : undefined,
          warnings: (t.warnings || []).map((w: any) => ({
            id: w.id,
            taskId: w.task_id || w.taskId,
            type: w.type,
            message: w.message,
            threshold: w.threshold,
            actualValue: w.actual_value || w.actualValue,
            acknowledged: Boolean(w.acknowledged),
            createdAt: new Date(w.created_at || w.createdAt)
          })),
          adjustCount: t.adjust_count || t.adjustCount || 0,
          createdAt: new Date(t.created_at || t.createdAt),
          startedAt: t.started_at || t.startedAt ? new Date(t.started_at || t.startedAt) : undefined,
        }))
      });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchRecentWarnings: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.dashboard.getRecentWarnings() as any;
      const warnings = Array.isArray(data) ? data : data.warnings || [];
      set({ 
        recentWarnings: warnings.map((w: any) => ({
          id: w.id,
          taskId: w.task_id || w.taskId,
          type: w.type,
          message: w.message,
          threshold: w.threshold,
          actualValue: w.actual_value || w.actualValue,
          acknowledged: Boolean(w.acknowledged),
          acknowledgedBy: w.acknowledged_by || w.acknowledgedBy,
          ackComment: w.ack_comment || w.ackComment,
          createdAt: new Date(w.created_at || w.createdAt),
        }))
      });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  
  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      await Promise.all([
        get().fetchStats(),
        get().fetchProcessCapability(),
        get().fetchWeeklyTrends(),
        get().fetchActiveTasks(),
        get().fetchRecentWarnings(),
      ]);
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  
  refreshStats: () => {
    get().fetchStats();
  },
}));

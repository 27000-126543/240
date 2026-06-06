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
          ...t,
          createdAt: new Date(t.createdAt),
          startedAt: t.startedAt ? new Date(t.startedAt) : undefined,
          warnings: t.warnings?.map((w: any) => ({ ...w, createdAt: new Date(w.createdAt) })) || [],
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
          ...w,
          createdAt: new Date(w.createdAt),
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

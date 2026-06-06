import { create } from 'zustand';
import type { DashboardStats, ProcessCapability } from '@/types';
import { mockDashboardStats, mockProcessCapability } from '@/data/mockData';

interface DashboardStore {
  stats: DashboardStats;
  capability: ProcessCapability[];
  refreshStats: () => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  stats: mockDashboardStats,
  capability: mockProcessCapability,
  
  refreshStats: () => {
    set(state => ({
      stats: {
        ...state.stats,
        completionRate: Math.min(99, state.stats.completionRate + Math.random() * 2 - 1),
        activeTasks: Math.max(1, state.stats.activeTasks + Math.floor(Math.random() * 3) - 1),
      }
    }));
  },
}));

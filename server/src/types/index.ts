export type TaskStatus = 
  | 'pending' 
  | 'model_building' 
  | 'plasma_calculation' 
  | 'rate_analysis' 
  | 'profile_evolution' 
  | 'completed' 
  | 'error';

export type WarningType = 'angle_deviation' | 'selectivity_low' | 'nonuniformity_high';
export type ApprovalLevel = 'engineer' | 'manager';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type BatchStatus = 'active' | 'paused' | 'completed';

export interface GasRatio {
  Ar: number;
  CF4: number;
  O2: number;
}

export interface ProcessParams {
  rf_power: number;
  bias_power: number;
  pressure: number;
  gas_ratio: GasRatio;
  temperature: number;
  time: number;
}

export interface SimulationResult {
  profile_angle: number;
  selectivity: number;
  uniformity: number;
  etch_depth: number;
  etch_rate: number;
  rate_distribution: number[];
  roughness_curve: number[];
  profile_coords: Array<{ x: number; y: number }>;
  time_series: {
    time: number;
    angle: number;
    selectivity: number;
    rate: number;
  }[];
}

export interface RealtimeMetrics {
  timestamp: Date;
  profileAngle: number;
  selectivity: number;
  etchRate: number;
  roughness: number;
  progress: number;
}

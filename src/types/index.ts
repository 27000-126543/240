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

export interface Warning {
  id: string;
  taskId: string;
  type: WarningType;
  message: string;
  threshold: number;
  actualValue: number;
  acknowledged: boolean;
  acknowledgedBy?: string;
  ackComment?: string;
  createdAt: Date;
}

export interface ParamAdjustment {
  id: string;
  taskId: string;
  beforeParams: ProcessParams;
  afterParams: ProcessParams;
  reason: string;
  adjustedBy: string;
  createdAt: Date;
}

export interface ApprovalRecord {
  id: string;
  taskId: string;
  level: ApprovalLevel;
  approver: string;
  status: ApprovalStatus;
  comment: string;
  createdAt: Date;
  decidedAt?: Date;
}

export interface Task {
  id: string;
  batchId: string;
  name: string;
  maskFile?: string;
  status: TaskStatus;
  progress: number;
  parameters: ProcessParams;
  result?: SimulationResult;
  warnings: Warning[];
  adjustments: ParamAdjustment[];
  approvals: ApprovalRecord[];
  adjustCount: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt?: Date;
  realtimeMetrics?: any[];
}

export interface Batch {
  id: string;
  name: string;
  status: BatchStatus;
  nonuniformCount: number;
  taskCount: number;
  completedCount?: number;
  pauseReason?: string;
  tasks?: Task[];
  createdAt: Date;
}

export interface DashboardStats {
  completionRate: number;
  rateDeviation: number;
  optimizationCount: number;
  activeTasks: number;
  warningsToday: number;
  approvalsPending: number;
}

export interface ProcessCapability {
  dimension: string;
  value: number;
  fullMark: number;
}

export interface Recommendation {
  id: string;
  name: string;
  parameters: ProcessParams;
  score: number;
  predictedAngle: number;
  predictedSelectivity: number;
  predictedUniformity: number;
  usageCount: number;
}

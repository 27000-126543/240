import type { 
  Task, Batch, DashboardStats, ProcessCapability, 
  Recommendation, ProcessParams, SimulationResult, Warning, ParamAdjustment, ApprovalRecord 
} from '@/types';

const generateId = () => Math.random().toString(36).substring(2, 10);

const defaultParams: ProcessParams = {
  rf_power: 600,
  bias_power: 120,
  pressure: 50,
  gas_ratio: { Ar: 50, CF4: 35, O2: 15 },
  temperature: 60,
  time: 180,
};

const generateResult = (seed: number): SimulationResult => {
  const baseAngle = 87.5 + (seed % 5) - 2;
  const baseSelectivity = 12 + (seed % 4) - 2;
  const baseUniformity = 94 + (seed % 4) - 2;
  
  const rate_distribution = Array.from({ length: 50 }, (_, i) => {
    const center = Math.abs(i - 25) / 25;
    return 320 + Math.sin(i * 0.3) * 25 - center * 40 + (seed % 10) - 5;
  });
  
  const roughness_curve = Array.from({ length: 100 }, (_, i) => {
    return Math.sin(i * 0.15) * 1.5 + Math.sin(i * 0.4) * 0.8 + (Math.random() - 0.5) * 0.5;
  });
  
  const profile_coords = Array.from({ length: 60 }, (_, i) => {
    const x = i * 5;
    const y = x < 10 || x > 290 ? 0 : -200 - Math.sin((x - 10) * 0.025) * 20;
    return { x, y };
  });
  
  const time_series = Array.from({ length: 20 }, (_, i) => ({
    time: i * 10,
    angle: baseAngle + Math.sin(i * 0.5) * 0.8,
    selectivity: baseSelectivity + Math.cos(i * 0.4) * 0.5,
    rate: 320 + Math.sin(i * 0.3) * 15,
  }));
  
  return {
    profile_angle: baseAngle,
    selectivity: baseSelectivity,
    uniformity: baseUniformity,
    etch_depth: 245 + (seed % 20),
    etch_rate: 320 + (seed % 30) - 15,
    rate_distribution,
    roughness_curve,
    profile_coords,
    time_series,
  };
};

const taskNames = [
  '5nm FinFET 栅极刻蚀',
  '3nm GAA 有源区刻蚀',
  '7nm SRAM 接触孔刻蚀',
  '14nm BEOL 沟槽刻蚀',
  '10nm MOL 通孔刻蚀',
  '5nm STI 浅槽隔离',
  '3nm PMOS 源漏刻蚀',
  '7nm NMOS 栅极修整',
];

const maskFiles = [
  'mask_v12.gds',
  'mask_v8a.oas',
  'mask_v5.gds',
  'mask_v15.gds',
  'mask_v3.oas',
  'mask_v9.gds',
  'mask_v11.gds',
  'mask_v7a.gds',
];

export const mockBatches: Batch[] = [
  { id: 'B001', name: '批次 B2026-06-001', status: 'active', nonuniformCount: 0, taskCount: 5, createdAt: new Date('2026-06-01') },
  { id: 'B002', name: '批次 B2026-06-002', status: 'active', nonuniformCount: 2, taskCount: 8, createdAt: new Date('2026-06-03') },
  { id: 'B003', name: '批次 B2026-06-003', status: 'paused', nonuniformCount: 3, taskCount: 6, createdAt: new Date('2026-06-04') },
  { id: 'B004', name: '批次 B2026-05-028', status: 'completed', nonuniformCount: 1, taskCount: 12, createdAt: new Date('2026-05-28') },
];

export const mockTasks: Task[] = taskNames.map((name, i) => {
  const statuses: Task['status'][] = ['pending', 'model_building', 'plasma_calculation', 'rate_analysis', 'profile_evolution', 'completed', 'completed', 'error'];
  const status = statuses[i];
  const progress = status === 'pending' ? 0 : status === 'completed' ? 100 : status === 'error' ? 65 : 20 + i * 12;
  
  const warnings: Warning[] = [];
  if (i === 3) {
    warnings.push({
      id: generateId(),
      taskId: `T${String(i+1).padStart(4, '0')}`,
      type: 'angle_deviation',
      message: '刻蚀剖面角度偏差超过阈值',
      threshold: 2,
      actualValue: 3.2,
      acknowledged: false,
      createdAt: new Date(),
    });
  }
  if (i === 5) {
    warnings.push({
      id: generateId(),
      taskId: `T${String(i+1).padStart(4, '0')}`,
      type: 'selectivity_low',
      message: '刻蚀选择性低于下限',
      threshold: 10,
      actualValue: 8.7,
      acknowledged: true,
      createdAt: new Date(),
    });
  }
  
  const adjustments: ParamAdjustment[] = i >= 5 ? [{
    id: generateId(),
    taskId: `T${String(i+1).padStart(4, '0')}`,
    beforeParams: { ...defaultParams, rf_power: 550 },
    afterParams: { ...defaultParams, rf_power: 620 },
    reason: '角度偏差过大，增加射频功率',
    createdAt: new Date(),
  }] : [];
  
  const approvals: ApprovalRecord[] = i < 3 ? [] : i < 5 ? [{
    id: generateId(),
    taskId: `T${String(i+1).padStart(4, '0')}`,
    level: 'engineer',
    approver: '张工程师',
    status: 'approved',
    comment: '均匀性符合要求，提交审批',
    createdAt: new Date(),
  }] : [{
    id: generateId(),
    taskId: `T${String(i+1).padStart(4, '0')}`,
    level: 'engineer',
    approver: '李工程师',
    status: 'approved',
    comment: '结果符合预期',
    createdAt: new Date(Date.now() - 3600000),
  }, {
    id: generateId(),
    taskId: `T${String(i+1).padStart(4, '0')}`,
    level: 'manager',
    approver: '王经理',
    status: i === 7 ? 'pending' : 'approved',
    comment: i === 7 ? '' : '工艺窗口确认，可量产',
    createdAt: new Date(),
  }];
  
  return {
    id: `T${String(i+1).padStart(4, '0')}`,
    batchId: mockBatches[i % 3].id,
    name,
    maskFile: maskFiles[i],
    status,
    progress,
    parameters: { ...defaultParams, rf_power: defaultParams.rf_power + (i % 3) * 50 - 50 },
    result: ['completed', 'profile_evolution'].includes(status) ? generateResult(i * 7) : undefined,
    warnings,
    adjustments,
    approvals,
    adjustCount: adjustments.length,
    createdAt: new Date(Date.now() - (8 - i) * 3600000),
    startedAt: status !== 'pending' ? new Date(Date.now() - (8 - i) * 3000000) : undefined,
    completedAt: status === 'completed' ? new Date(Date.now() - (8 - i) * 1800000) : undefined,
  };
});

export const mockDashboardStats: DashboardStats = {
  completionRate: 86.5,
  rateDeviation: 2.3,
  optimizationCount: 47,
  activeTasks: 12,
  warningsToday: 3,
  approvalsPending: 5,
};

export const mockProcessCapability: ProcessCapability[] = [
  { dimension: '角度控制', value: 92, fullMark: 100 },
  { dimension: '选择性', value: 88, fullMark: 100 },
  { dimension: '均匀性', value: 85, fullMark: 100 },
  { dimension: '速率稳定', value: 90, fullMark: 100 },
  { dimension: '粗糙度', value: 87, fullMark: 100 },
  { dimension: '良率预估', value: 83, fullMark: 100 },
];

export const mockRecommendations: Recommendation[] = [
  {
    id: 'R001',
    name: '高精度栅极刻蚀方案',
    parameters: { rf_power: 650, bias_power: 130, pressure: 45, gas_ratio: { Ar: 55, CF4: 32, O2: 13 }, temperature: 55, time: 200 },
    score: 95,
    predictedAngle: 89.2,
    predictedSelectivity: 14.5,
    predictedUniformity: 96.2,
    usageCount: 28,
  },
  {
    id: 'R002',
    name: '高选择比接触孔方案',
    parameters: { rf_power: 580, bias_power: 100, pressure: 55, gas_ratio: { Ar: 48, CF4: 40, O2: 12 }, temperature: 65, time: 160 },
    score: 91,
    predictedAngle: 87.8,
    predictedSelectivity: 16.8,
    predictedUniformity: 93.5,
    usageCount: 42,
  },
  {
    id: 'R003',
    name: '高速沟槽刻蚀方案',
    parameters: { rf_power: 700, bias_power: 150, pressure: 60, gas_ratio: { Ar: 60, CF4: 28, O2: 12 }, temperature: 60, time: 120 },
    score: 88,
    predictedAngle: 86.5,
    predictedSelectivity: 11.2,
    predictedUniformity: 94.8,
    usageCount: 15,
  },
];

export const statusLabels: Record<Task['status'], string> = {
  pending: '待提交',
  model_building: '模型构建',
  plasma_calculation: '等离子体计算',
  rate_analysis: '刻蚀速率分析',
  profile_evolution: '形貌演化',
  completed: '已完成',
  error: '异常',
};

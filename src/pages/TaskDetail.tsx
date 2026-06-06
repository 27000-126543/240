import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RotateCcw,
  Download,
  AlertTriangle,
  Check,
  Clock,
  Zap,
  Gauge,
  Thermometer,
  History,
  UserCheck,
  Loader2
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar
} from 'recharts';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTaskStore } from '@/store/useTaskStore';
import { socketService } from '@/services/socket';
import type { TaskStatus } from '@/types';

const statusFlow: TaskStatus[] = ['pending', 'model_building', 'plasma_calculation', 'rate_analysis', 'profile_evolution', 'completed'];

export default function TaskDetail() {
  const { taskId: id } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { getTaskById, fetchTask, updateTaskStatus, updateTaskProgress, startTask, loading, error } = useTaskStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'monitoring' | 'parameters' | 'history'>('overview');
  const [isSimulating, setIsSimulating] = useState(false);
  const [realtimeMetrics, setRealtimeMetrics] = useState<any[]>([]);
  
  const task = getTaskById(id || '');
  
  const handleTaskUpdate = useCallback((data: { taskId: string; status: string; progress: number }) => {
    if (data.taskId === id) {
      updateTaskStatus(data.taskId, data.status as TaskStatus, data.progress);
      updateTaskProgress(data.taskId, data.progress);
      if (data.status === 'completed' || data.status === 'error') {
        setIsSimulating(false);
      }
    }
  }, [id, updateTaskStatus, updateTaskProgress]);

  const handleMetrics = useCallback((data: any) => {
    if (data.taskId === id) {
      setRealtimeMetrics(prev => [...prev.slice(-50), data]);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchTask(id);
    }

    socketService.connect();
    socketService.onTaskUpdate(handleTaskUpdate);
    socketService.onTaskMetrics(id || '', handleMetrics);

    return () => {
      socketService.offTaskUpdate(handleTaskUpdate);
      socketService.offTaskMetrics(id || '', handleMetrics);
    };
  }, [id, fetchTask, handleTaskUpdate, handleMetrics]);

  if (loading && !task) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-tech-400 animate-spin mb-4" />
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <p className="text-gray-400 mb-4">{error}</p>
        <button
          onClick={() => navigate('/tasks')}
          className="px-4 py-2 rounded-lg bg-tech-500 text-white text-sm"
        >
          返回任务列表
        </button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="w-16 h-16 text-gray-500 mb-4" />
        <p className="text-gray-400 mb-4">任务不存在</p>
        <button
          onClick={() => navigate('/tasks')}
          className="px-4 py-2 rounded-lg bg-tech-500 text-white text-sm"
        >
          返回任务列表
        </button>
      </div>
    );
  }

  const startSimulation = async () => {
    if (!id) return;
    try {
      setIsSimulating(true);
      await startTask(id);
    } catch (error) {
      setIsSimulating(false);
      console.error('Failed to start task:', error);
    }
  };

  const pauseSimulation = () => {
    setIsSimulating(false);
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    updateTaskStatus(task.id, 'pending', 0);
  };

  const tabs = [
    { id: 'overview', label: '总览' },
    { id: 'monitoring', label: '实时监控' },
    { id: 'parameters', label: '参数配置' },
    { id: 'history', label: '历史记录' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/tasks')}
          className="w-10 h-10 rounded-lg bg-deep-800/50 border border-tech-500/20 flex items-center justify-center text-gray-400 hover:text-white hover:border-tech-500/40 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold text-white">{task.name}</h2>
            <StatusBadge status={task.status} />
            {task.adjustCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-plasma-purple/20 text-plasma-purple text-xs">
                已优化 {task.adjustCount} 次
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {task.id} · 批次: {task.batchId} · 掩模: {task.maskFile}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!['completed', 'error'].includes(task.status) && (
            <>
              {isSimulating ? (
                <button
                  onClick={pauseSimulation}
                  className="h-10 px-4 rounded-lg bg-plasma-orange/20 text-plasma-orange border border-plasma-orange/30 text-sm font-medium flex items-center gap-2 hover:bg-plasma-orange/30 transition-all"
                >
                  <Pause className="w-4 h-4" />
                  暂停
                </button>
              ) : (
                <button
                  onClick={startSimulation}
                  className="h-10 px-4 rounded-lg bg-gradient-to-r from-tech-500 to-cyan-500 text-white text-sm font-medium flex items-center gap-2 hover:shadow-glow transition-all"
                >
                  <Play className="w-4 h-4" />
                  {task.status === 'pending' ? '开始模拟' : '继续模拟'}
                </button>
              )}
              <button
                onClick={resetSimulation}
                className="h-10 px-4 rounded-lg bg-deep-800/50 border border-tech-500/20 text-gray-300 text-sm font-medium flex items-center gap-2 hover:border-tech-500/40 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                重置
              </button>
            </>
          )}
          <button
            className="h-10 px-4 rounded-lg bg-deep-800/50 border border-tech-500/20 text-gray-300 text-sm font-medium flex items-center gap-2 hover:border-tech-500/40 transition-all"
          >
            <Download className="w-4 h-4" />
            导出数据
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">状态流转</h3>
        <div className="flex items-center justify-between">
          {statusFlow.map((status, idx) => {
            const currentIdx = statusFlow.indexOf(task.status);
            const isActive = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            
            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCurrent 
                      ? 'border-tech-500 bg-tech-500/20 shadow-glow' 
                      : isActive 
                        ? 'border-green-500 bg-green-500/20' 
                        : 'border-gray-600 bg-deep-800'
                  }`}>
                    {isActive && idx < currentIdx ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <span className={`text-sm font-medium ${isCurrent ? 'text-tech-300' : 'text-gray-500'}`}>
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs mt-2 ${isCurrent ? 'text-white font-medium' : isActive ? 'text-gray-400' : 'text-gray-600'}`}>
                    {status === 'pending' ? '待提交' : 
                     status === 'model_building' ? '模型构建' :
                     status === 'plasma_calculation' ? '等离子体计算' :
                     status === 'rate_analysis' ? '速率分析' :
                     status === 'profile_evolution' ? '形貌演化' : '已完成'}
                  </span>
                </div>
                {idx < statusFlow.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${isActive && idx < currentIdx ? 'bg-green-500' : 'bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6">
          <ProgressBar value={task.progress} showLabel />
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-deep-800/50 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-tech-500/20 text-tech-300'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-panel rounded-xl p-6">
            <h3 className="font-display font-semibold text-white mb-4">刻蚀形貌三维视图</h3>
            <div className="relative h-80 bg-gradient-to-b from-deep-900 to-deep-950 rounded-lg overflow-hidden">
              <svg viewBox="0 0 600 320" className="w-full h-full">
                <defs>
                  <linearGradient id="etchGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="maskGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#64748b" />
                    <stop offset="100%" stopColor="#334155" />
                  </linearGradient>
                </defs>
                
                <g stroke="rgba(14, 165, 233, 0.1)" strokeWidth="1">
                  {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <line key={`h${i}`} x1="0" y1={40 + i * 40} x2="600" y2={40 + i * 40} />
                  ))}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                    <line key={`v${i}`} x1={60 + i * 60} y1="0" x2={60 + i * 60} y2="320" />
                  ))}
                </g>
                
                <rect x="50" y="20" width="500" height="40" fill="url(#maskGradient)" rx="4" />
                <text x="300" y="45" textAnchor="middle" fill="#94a3b8" fontSize="12">掩模层 (SiO2)</text>
                
                <path
                  d="M 50 60 L 50 180 Q 150 190 200 260 Q 250 300 300 260 Q 350 190 450 180 L 550 180 L 550 60 Z"
                  fill="url(#etchGradient)"
                  stroke="#0EA5E9"
                  strokeWidth="2"
                />
                
                <path
                  d="M 50 180 Q 150 190 200 260 Q 250 300 300 260 Q 350 190 450 180"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
                
                <line x1="300" y1="60" x2="300" y2="260" stroke="#F97316" strokeWidth="2" strokeDasharray="4,4" />
                <text x="310" y="160" fill="#F97316" fontSize="11">刻蚀深度: {task.result?.etch_depth || '--'} nm</text>
                
                <line x1="200" y1="260" x2="300" y2="260" stroke="#10B981" strokeWidth="2" />
                <text x="250" y="280" textAnchor="middle" fill="#10B981" fontSize="11">CD: 100 nm</text>
                
                <text x="300" y="310" textAnchor="middle" fill="#64748b" fontSize="10">晶圆表面 (Si)</text>
              </svg>
              
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <div className="px-3 py-1.5 rounded bg-deep-900/80 border border-tech-500/20 text-xs text-gray-300">
                  X 截面视图
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-display font-semibold text-white mb-4">关键指标</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">剖面角度</span>
                  <span className={`text-xl font-display font-bold ${
                    task.result && Math.abs(task.result.profile_angle - 88) > 2 
                      ? 'text-plasma-orange' 
                      : 'text-green-400'
                  }`}>
                    {task.result?.profile_angle.toFixed(1) || '--'}°
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">选择性</span>
                  <span className={`text-xl font-display font-bold ${
                    task.result && task.result.selectivity < 10 
                      ? 'text-plasma-orange' 
                      : 'text-green-400'
                  }`}>
                    {task.result?.selectivity.toFixed(1) || '--'}:1
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">均匀性</span>
                  <span className={`text-xl font-display font-bold ${
                    task.result && task.result.uniformity < 90 
                      ? 'text-plasma-orange' 
                      : 'text-green-400'
                  }`}>
                    {task.result?.uniformity.toFixed(1) || '--'}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">刻蚀速率</span>
                  <span className="text-xl font-display font-bold text-tech-300">
                    {task.result?.etch_rate.toFixed(0) || '--'} nm/min
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">刻蚀深度</span>
                  <span className="text-xl font-display font-bold text-cyan-400">
                    {task.result?.etch_depth.toFixed(0) || '--'} nm
                  </span>
                </div>
              </div>
            </div>

            {task.warnings.length > 0 && (
              <div className="glass-panel rounded-xl p-6 border-l-4 border-plasma-orange">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-plasma-orange" />
                  <h3 className="font-display font-semibold text-white">预警信息</h3>
                </div>
                <div className="space-y-3">
                  {task.warnings.map(w => (
                    <div key={w.id} className="p-3 rounded-lg bg-plasma-orange/10 border border-plasma-orange/20">
                      <p className="text-sm text-white">{w.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        阈值: {w.threshold} | 实际: {w.actualValue}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {task.status !== 'completed' && task.status !== 'error' && task.status !== 'pending' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel rounded-xl p-5">
                <p className="text-sm text-gray-400 font-medium mb-2">剖面角度</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-display font-bold text-tech-300">
                    {realtimeMetrics.length > 0 ? realtimeMetrics[realtimeMetrics.length - 1]?.profileAngle?.toFixed(1) : '--'}
                  </span>
                  <span className="text-sm text-gray-400">°</span>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-5">
                <p className="text-sm text-gray-400 font-medium mb-2">选择性</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-display font-bold text-green-400">
                    {realtimeMetrics.length > 0 ? realtimeMetrics[realtimeMetrics.length - 1]?.selectivity?.toFixed(1) : '--'}
                  </span>
                  <span className="text-sm text-gray-400">:1</span>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-5">
                <p className="text-sm text-gray-400 font-medium mb-2">刻蚀速率</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-display font-bold text-cyan-400">
                    {realtimeMetrics.length > 0 ? realtimeMetrics[realtimeMetrics.length - 1]?.etchRate?.toFixed(0) : '--'}
                  </span>
                  <span className="text-sm text-gray-400">nm/min</span>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-5">
                <p className="text-sm text-gray-400 font-medium mb-2">表面粗糙度</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-display font-bold text-plasma-purple">
                    {realtimeMetrics.length > 0 ? realtimeMetrics[realtimeMetrics.length - 1]?.roughness?.toFixed(2) : '--'}
                  </span>
                  <span className="text-sm text-gray-400">nm</span>
                </div>
              </div>
            </div>
          )}

          {task.result ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-xl p-6">
                <h3 className="font-display font-semibold text-white mb-4">刻蚀剖面角度监控</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={task.result?.time_series || realtimeMetrics.map((m, i) => ({ time: i, angle: m.profileAngle, selectivity: m.selectivity, rate: m.etchRate }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 165, 233, 0.1)" />
                      <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 12 }} label={{ value: '时间 (s)', fill: '#64748b', fontSize: 11, position: 'insideBottom', offset: -5 }} />
                      <YAxis domain={[80, 95]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '8px', color: '#fff' }} />
                      <Line type="monotone" dataKey="angle" stroke="#0EA5E9" strokeWidth={2} dot={false} name="角度 (°)" />
                      <Line type="monotone" dataKey={() => 90} stroke="#F97316" strokeWidth={1} strokeDasharray="5,5" name="目标值" />
                      <Line type="monotone" dataKey={() => 88} stroke="#F97316" strokeWidth={1} strokeDasharray="3,3" name="下限" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel rounded-xl p-6">
                <h3 className="font-display font-semibold text-white mb-4">选择性监控</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={task.result?.time_series || realtimeMetrics.map((m, i) => ({ time: i, angle: m.profileAngle, selectivity: m.selectivity, rate: m.etchRate }))}>
                      <defs>
                        <linearGradient id="selectivityGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 165, 233, 0.1)" />
                      <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis domain={[0, 20]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '8px', color: '#fff' }} />
                      <Area type="monotone" dataKey="selectivity" stroke="#10B981" strokeWidth={2} fill="url(#selectivityGrad)" name="选择性" />
                      <Line type="monotone" dataKey={() => 10} stroke="#F97316" strokeWidth={1} strokeDasharray="5,5" name="阈值" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {task.result.rate_distribution && (
                <div className="glass-panel rounded-xl p-6">
                  <h3 className="font-display font-semibold text-white mb-4">刻蚀速率分布</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={task.result.rate_distribution.map((v, i) => ({ pos: i, rate: v }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 165, 233, 0.1)" />
                        <XAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis domain={[250, 400]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '8px', color: '#fff' }} />
                        <Bar dataKey="rate" fill="#06B6D4" radius={[4, 4, 0, 0]} name="速率 (nm/min)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {task.result.roughness_curve && (
                <div className="glass-panel rounded-xl p-6">
                  <h3 className="font-display font-semibold text-white mb-4">表面粗糙度曲线</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={task.result.roughness_curve.map((v, i) => ({ pos: i, roughness: v }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 165, 233, 0.1)" />
                        <XAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis domain={[-3, 3]} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '8px', color: '#fff' }} />
                        <Line type="monotone" dataKey="roughness" stroke="#8B5CF6" strokeWidth={1.5} dot={false} name="粗糙度 (nm)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex justify-around text-xs text-gray-400">
                    <span>Ra: {task.result.roughness_curve.reduce((a, b) => a + Math.abs(b), 0) / task.result.roughness_curve.length} nm</span>
                    <span>Rms: {Math.sqrt(task.result.roughness_curve.reduce((a, b) => a + b * b, 0) / task.result.roughness_curve.length)} nm</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-12 text-center">
              <Loader2 className="w-12 h-12 text-tech-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">等待模拟数据...</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'parameters' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-display font-semibold text-white mb-6">电气参数</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> 射频功率 (RF Power)
                  </label>
                  <span className="text-sm text-tech-300 font-mono">{task.parameters.rf_power} W</span>
                </div>
                <input type="range" min="200" max="1000" value={task.parameters.rf_power} readOnly className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-tech-500" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> 偏压功率 (Bias Power)
                  </label>
                  <span className="text-sm text-tech-300 font-mono">{task.parameters.bias_power} W</span>
                </div>
                <input type="range" min="50" max="300" value={task.parameters.bias_power} readOnly className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-display font-semibold text-white mb-6">工艺参数</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Gauge className="w-4 h-4" /> 气压 (Pressure)
                  </label>
                  <span className="text-sm text-tech-300 font-mono">{task.parameters.pressure} mTorr</span>
                </div>
                <input type="range" min="10" max="200" value={task.parameters.pressure} readOnly className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-green-500" />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Thermometer className="w-4 h-4" /> 温度 (Temperature)
                  </label>
                  <span className="text-sm text-tech-300 font-mono">{task.parameters.temperature} °C</span>
                </div>
                <input type="range" min="20" max="150" value={task.parameters.temperature} readOnly className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-display font-semibold text-white mb-6">气体组份</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-400">Ar (氩气)</span>
                  <span className="text-sm text-cyan-400 font-mono">{task.parameters.gas_ratio.Ar}%</span>
                </div>
                <div className="w-full h-3 bg-deep-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${task.parameters.gas_ratio.Ar}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-400">CF4 (四氟化碳)</span>
                  <span className="text-sm text-tech-300 font-mono">{task.parameters.gas_ratio.CF4}%</span>
                </div>
                <div className="w-full h-3 bg-deep-800 rounded-full overflow-hidden">
                  <div className="h-full bg-tech-500 rounded-full" style={{ width: `${task.parameters.gas_ratio.CF4}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-400">O2 (氧气)</span>
                  <span className="text-sm text-green-400 font-mono">{task.parameters.gas_ratio.O2}%</span>
                </div>
                <div className="w-full h-3 bg-deep-800 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${task.parameters.gas_ratio.O2}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-display font-semibold text-white mb-6">刻蚀时间</h3>
            <div className="flex items-center gap-4">
              <Clock className="w-12 h-12 text-plasma-purple" />
              <div>
                <p className="text-3xl font-display font-bold text-white">{task.parameters.time}</p>
                <p className="text-sm text-gray-400">秒 (s)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <History className="w-5 h-5 text-tech-400" />
              <h3 className="font-display font-semibold text-white">参数调整历史</h3>
            </div>
            {task.adjustments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无参数调整记录</p>
            ) : (
              <div className="space-y-4">
                {task.adjustments.map((adj, idx) => (
                  <div key={adj.id} className="p-4 rounded-lg bg-deep-800/50 border border-tech-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white">调整 #{idx + 1}</span>
                      <span className="text-xs text-gray-500">{new Date(adj.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">原因: {adj.reason}</p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-gray-500 mb-1">调整前</p>
                        <p className="text-gray-300">RF: {adj.beforeParams.rf_power}W</p>
                        <p className="text-gray-300">气压: {adj.beforeParams.pressure}mT</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">调整后</p>
                        <p className="text-green-400">RF: {adj.afterParams.rf_power}W</p>
                        <p className="text-green-400">气压: {adj.afterParams.pressure}mT</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <UserCheck className="w-5 h-5 text-tech-400" />
              <h3 className="font-display font-semibold text-white">审批流程</h3>
            </div>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${task.approvals.some(a => a.level === 'engineer' && a.status === 'approved') ? 'bg-green-500/10 border-green-500/30' : 'bg-deep-800/50 border-tech-500/20'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${task.approvals.some(a => a.level === 'engineer' && a.status === 'approved') ? 'bg-green-500/30' : 'bg-deep-700'}`}>
                      {task.approvals.some(a => a.level === 'engineer' && a.status === 'approved') ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">工艺工程师审核</p>
                      <p className="text-xs text-gray-500">验证刻蚀均匀性</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${task.approvals.some(a => a.level === 'engineer' && a.status === 'approved') ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {task.approvals.some(a => a.level === 'engineer' && a.status === 'approved') ? '已通过' : '待处理'}
                  </span>
                </div>
                {task.approvals.find(a => a.level === 'engineer')?.comment && (
                  <p className="mt-3 text-xs text-gray-400 pl-11">
                    意见: {task.approvals.find(a => a.level === 'engineer')?.comment}
                  </p>
                )}
              </div>

              <div className={`p-4 rounded-lg border ${task.approvals.some(a => a.level === 'manager' && a.status === 'approved') ? 'bg-green-500/10 border-green-500/30' : task.approvals.some(a => a.level === 'manager' && a.status === 'pending') ? 'bg-tech-500/10 border-tech-500/30' : 'bg-deep-800/50 border-tech-500/20'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${task.approvals.some(a => a.level === 'manager' && a.status === 'approved') ? 'bg-green-500/30' : task.approvals.some(a => a.level === 'manager' && a.status === 'pending') ? 'bg-tech-500/30' : 'bg-deep-700'}`}>
                      {task.approvals.some(a => a.level === 'manager' && a.status === 'approved') ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : task.approvals.some(a => a.level === 'manager' && a.status === 'pending') ? (
                        <Clock className="w-4 h-4 text-tech-400 animate-pulse" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">技术经理审批</p>
                      <p className="text-xs text-gray-500">确认工艺窗口</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${task.approvals.some(a => a.level === 'manager' && a.status === 'approved') ? 'bg-green-500/20 text-green-400' : task.approvals.some(a => a.level === 'manager' && a.status === 'pending') ? 'bg-tech-500/20 text-tech-300' : 'bg-gray-500/20 text-gray-400'}`}>
                    {task.approvals.some(a => a.level === 'manager' && a.status === 'approved') ? '已通过' : task.approvals.some(a => a.level === 'manager' && a.status === 'pending') ? '待审批' : '待处理'}
                  </span>
                </div>
                {task.approvals.find(a => a.level === 'manager')?.comment && (
                  <p className="mt-3 text-xs text-gray-400 pl-11">
                    意见: {task.approvals.find(a => a.level === 'manager')?.comment}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { 
  CheckCircle2, 
  Gauge, 
  Repeat, 
  Activity, 
  AlertTriangle,
  Clock,
  ChevronRight,
  Zap
} from 'lucide-react';
import { 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area
} from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDashboardStore } from '@/store/useDashboardStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useNavigate } from 'react-router-dom';

const weeklyData = [
  { day: '周一', completed: 8, active: 5 },
  { day: '周二', completed: 12, active: 7 },
  { day: '周三', completed: 10, active: 8 },
  { day: '周四', completed: 15, active: 6 },
  { day: '周五', completed: 9, active: 10 },
  { day: '周六', completed: 5, active: 3 },
  { day: '周日', completed: 3, active: 2 },
];

export default function Dashboard() {
  const { stats, capability } = useDashboardStore();
  const { tasks } = useTaskStore();
  const navigate = useNavigate();
  
  const activeTasks = tasks.filter(t => !['completed', 'error', 'pending'].includes(t.status)).slice(0, 5);
  const recentWarnings = tasks.flatMap(t => t.warnings.map(w => ({ ...w, taskName: t.name, taskId: t.id }))).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="今日完成率"
          value={stats.completionRate.toFixed(1)}
          unit="%"
          icon={CheckCircle2}
          trend={2.4}
          color="green"
        />
        <StatCard
          title="刻蚀速率偏差"
          value={stats.rateDeviation.toFixed(1)}
          unit="%"
          icon={Gauge}
          trend={-0.8}
          color="cyan"
        />
        <StatCard
          title="参数优化次数"
          value={stats.optimizationCount}
          icon={Repeat}
          trend={5.2}
          color="purple"
        />
        <StatCard
          title="进行中任务"
          value={stats.activeTasks}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="今日预警"
          value={stats.warningsToday}
          icon={AlertTriangle}
          color="orange"
        />
        <StatCard
          title="待审批"
          value={stats.approvalsPending}
          icon={Clock}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-white text-lg">工艺能力指数</h3>
            <span className="text-xs text-gray-400">六维综合评估</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={capability}>
                <PolarGrid stroke="rgba(14, 165, 233, 0.15)" />
                <PolarAngleAxis 
                  dataKey="dimension" 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                />
                <PolarRadiusAxis 
                  angle={90} 
                  domain={[0, 100]} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                />
                <Radar
                  name="工艺能力"
                  dataKey="value"
                  stroke="#0EA5E9"
                  fill="#0EA5E9"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-semibold text-white text-lg">本周任务统计</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(14, 165, 233, 0.1)" />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Area type="monotone" dataKey="completed" stroke="#10B981" fillOpacity={1} fill="url(#colorCompleted)" name="已完成" />
                <Area type="monotone" dataKey="active" stroke="#0EA5E9" fillOpacity={1} fill="url(#colorActive)" name="进行中" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-tech-500/20">
            <h3 className="font-display font-semibold text-white">活跃任务</h3>
            <button 
              onClick={() => navigate('/tasks')}
              className="text-sm text-tech-400 hover:text-tech-300 flex items-center gap-1 transition-colors"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-tech-500/10">
            {activeTasks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无进行中的任务</p>
              </div>
            ) : (
              activeTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="p-4 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">{task.name}</span>
                    <StatusBadge status={task.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      {task.parameters.rf_power}W
                    </span>
                    <span>批次: {task.batchId}</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>计算进度</span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-deep-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-tech-500 to-cyan-500 rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-tech-500/20">
            <h3 className="font-display font-semibold text-white">最新预警</h3>
            <span className="px-2 py-0.5 rounded-full bg-plasma-orange/20 text-plasma-orange text-xs font-medium">
              {recentWarnings.length} 条未处理
            </span>
          </div>
          <div className="divide-y divide-tech-500/10 max-h-80 overflow-y-auto scrollbar-thin">
            {recentWarnings.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50 text-green-500" />
                <p>系统运行正常，无预警</p>
              </div>
            ) : (
              recentWarnings.map(warning => (
                <div 
                  key={warning.id}
                  onClick={() => navigate(`/tasks/${warning.taskId}`)}
                  className="p-4 hover:bg-white/5 cursor-pointer transition-colors border-l-4 border-plasma-orange"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{warning.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{warning.taskName}</p>
                    </div>
                    <AlertTriangle className="w-5 h-5 text-plasma-orange flex-shrink-0 ml-3 animate-pulse" />
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <span className="text-gray-400">
                      阈值: {warning.threshold} | 实际: <span className="text-plasma-orange font-medium">{warning.actualValue}</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

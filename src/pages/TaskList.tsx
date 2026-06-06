import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Filter, 
  Search,
  Zap,
  Gauge,
  Target,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useTaskStore } from '@/store/useTaskStore';
import type { TaskStatus } from '@/types';
import { statusLabels } from '@/data/mockData';

const statusFilters: { value: 'all' | TaskStatus; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待提交' },
  { value: 'model_building', label: '模型构建' },
  { value: 'plasma_calculation', label: '等离子体计算' },
  { value: 'rate_analysis', label: '速率分析' },
  { value: 'profile_evolution', label: '形貌演化' },
  { value: 'completed', label: '已完成' },
  { value: 'error', label: '异常' },
];

export default function TaskList() {
  const { tasks, batches, loading, fetchTasks, fetchBatches } = useTaskStore();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTasks();
    fetchBatches();
  }, [fetchTasks, fetchBatches]);

  const filteredTasks = tasks.filter(task => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (batchFilter !== 'all' && task.batchId !== batchFilter) return false;
    if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase()) && !task.id.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-tech-400 animate-spin mb-4" />
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索任务ID或名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-72 h-10 pl-10 pr-4 rounded-lg bg-deep-800/50 border border-tech-500/20 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-tech-500/50 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-10 px-3 rounded-lg bg-deep-800/50 border border-tech-500/20 text-sm text-white focus:outline-none focus:border-tech-500/50 transition-all"
            >
              {statusFilters.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="h-10 px-3 rounded-lg bg-deep-800/50 border border-tech-500/20 text-sm text-white focus:outline-none focus:border-tech-500/50 transition-all"
            >
              <option value="all">所有批次</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button
          onClick={() => navigate('/tasks/create')}
          className="h-10 px-4 rounded-lg bg-gradient-to-r from-tech-500 to-cyan-500 text-white text-sm font-medium flex items-center gap-2 hover:shadow-glow transition-all"
        >
          <Plus className="w-4 h-4" />
          创建任务
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {Object.entries(statusLabels).map(([status, label]) => {
          const count = tasks.filter(t => t.status === status).length;
          return (
            <div
              key={status}
              onClick={() => setStatusFilter(status as TaskStatus)}
              className={`glass-panel rounded-lg p-4 cursor-pointer transition-all hover:scale-[1.02] ${
                statusFilter === status ? 'ring-2 ring-tech-500/50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{label}</span>
                <span className="text-2xl font-display font-bold text-white">{count}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-tech-500/20">
              <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">任务</th>
              <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">状态</th>
              <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">批次</th>
              <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">工艺参数</th>
              <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">进度</th>
              <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">结果指标</th>
              <th className="text-right p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-tech-500/10">
            {filteredTasks.map(task => (
            <tr 
              key={task.id} 
              className="hover:bg-white/5 transition-colors">
              <td className="p-4">
                <div>
                  <p className="font-medium text-white">{task.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {task.id} · {task.maskFile}
                  </p>
                </div>
              </td>
              <td className="p-4">
                <StatusBadge status={task.status} />
              </td>
              <td className="p-4">
                <span className="text-sm text-gray-300">
                  {batches.find(b => b.id === task.batchId)?.name || task.batchId}
                </span>
              </td>
              <td className="p-4">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    {task.parameters.rf_power}W
                  </span>
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    {task.parameters.pressure}mT
                  </span>
                </div>
              </td>
              <td className="p-4 w-40">
                <ProgressBar value={task.progress} />
              </td>
              <td className="p-4">
                {task.result ? (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-tech-300">
                      <Target className="w-3 h-3" />
                      {task.result.profile_angle.toFixed(1)}°
                    </span>
                    <span className="text-gray-400">
                      选比: {task.result.selectivity.toFixed(1)}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">-</span>
                )}
              </td>
              <td className="p-4 text-right">
                <button
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="inline-flex items-center gap-1 text-sm text-tech-400 hover:text-tech-300 transition-colors"
                >
                  详情
                  <ChevronRight className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        
        {filteredTasks.length === 0 && (
          <div className="p-12 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <p className="text-gray-400">没有找到匹配的任务</p>
          </div>
        )}
      </div>
    </div>
  );
}

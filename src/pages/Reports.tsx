import { useState } from 'react';
import { 
  FileText, 
  Download, 
  FileSpreadsheet,
  FileImage,
  ChevronRight,
  Calendar,
  Filter,
  Eye,
  Printer,
  CheckCircle
} from 'lucide-react';
import { useTaskStore } from '@/store/useTaskStore';
import { StatusBadge } from '@/components/ui/StatusBadge';

export default function Reports() {
  const { tasks } = useTaskStore();
  const [viewMode, setViewMode] = useState<'list' | 'preview'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const completedTasks = tasks.filter(t => t.status === 'completed' && t.result);
  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;

  const exportData = (format: 'pdf' | 'csv' | 'excel') => {
    alert(`正在导出为 ${format.toUpperCase()} 格式...`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <button className="px-3 py-1.5 rounded-lg bg-tech-500/20 text-tech-300 text-sm font-medium border border-tech-500/30">
            全部报告
          </button>
          <button className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
            本月
          </button>
          <button className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all">
            本周
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportData('pdf')}
            className="h-10 px-4 rounded-lg bg-deep-800/50 border border-tech-500/20 text-gray-300 text-sm font-medium flex items-center gap-2 hover:border-tech-500/40 transition-all"
          >
            <FileText className="w-4 h-4" />
            批量导出PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tech-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-tech-400" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-white">{completedTasks.length}</p>
              <p className="text-xs text-gray-400">总报告数</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-white">
                {completedTasks.filter(t => t.approvals.every(a => a.status === 'approved')).length}
              </p>
              <p className="text-xs text-gray-400">已审批</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Download className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-white">156</p>
              <p className="text-xs text-gray-400">本月下载</p>
            </div>
          </div>
        </div>
        <div className="glass-panel rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-plasma-purple/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-plasma-purple" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-white">
                {new Date().toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-400">统计日期</p>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-tech-500/20">
                <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">任务名称</th>
                <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">生成时间</th>
                <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">关键指标</th>
                <th className="text-left p-4 text-xs font-medium text-gray-400 uppercase">审批状态</th>
                <th className="text-right p-4 text-xs font-medium text-gray-400 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tech-500/10">
              {completedTasks.map(task => (
                <tr key={task.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <p className="font-medium text-white">{task.name}</p>
                    <p className="text-xs text-gray-500">{task.id}</p>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-gray-300">
                      {task.completedAt ? new Date(task.completedAt).toLocaleString() : '-'}
                    </span>
                  </td>
                  <td className="p-4">
                    {task.result && (
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-tech-300">角度: {task.result.profile_angle.toFixed(1)}°</span>
                        <span className="text-green-400">选比: {task.result.selectivity.toFixed(1)}</span>
                        <span className="text-cyan-400">均匀: {task.result.uniformity.toFixed(1)}%</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {task.approvals.length === 2 && task.approvals.every(a => a.status === 'approved') ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">全部通过</span>
                      ) : task.approvals.some(a => a.status === 'pending') ? (
                        <span className="px-2 py-0.5 rounded-full bg-tech-500/20 text-tech-300 text-xs">审批中</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 text-xs">待提交</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setSelectedTaskId(task.id); setViewMode('preview'); }}
                        className="p-2 rounded-lg hover:bg-tech-500/20 text-gray-400 hover:text-tech-300 transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => exportData('pdf')}
                        className="p-2 rounded-lg hover:bg-tech-500/20 text-gray-400 hover:text-tech-300 transition-all"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : selectedTask && selectedTask.result ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('list')}
              className="h-10 px-4 rounded-lg bg-deep-800/50 border border-tech-500/20 text-gray-300 text-sm font-medium hover:border-tech-500/40 transition-all"
            >
              返回列表
            </button>
            <h3 className="font-display font-semibold text-white text-lg">{selectedTask.name} - 综合报告</h3>
            <div className="flex-1" />
            <button
              onClick={() => exportData('pdf')}
              className="h-10 px-4 rounded-lg bg-gradient-to-r from-tech-500 to-cyan-500 text-white text-sm font-medium flex items-center gap-2 hover:shadow-glow transition-all"
            >
              <Download className="w-4 h-4" />
              导出PDF
            </button>
          </div>

          <div className="glass-panel rounded-xl p-8" id="report-content">
            <div className="text-center mb-8 pb-6 border-b border-tech-500/20">
              <h1 className="font-display text-2xl font-bold text-white mb-2">等离子体刻蚀工艺模拟报告</h1>
              <p className="text-gray-400">任务编号: {selectedTask.id} | 生成时间: {new Date().toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="text-center p-4 rounded-lg bg-deep-800/50">
                <p className="text-sm text-gray-400 mb-1">剖面角度</p>
                <p className="text-3xl font-display font-bold text-tech-300">{selectedTask.result.profile_angle.toFixed(1)}°</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-deep-800/50">
                <p className="text-sm text-gray-400 mb-1">选择性</p>
                <p className="text-3xl font-display font-bold text-green-400">{selectedTask.result.selectivity.toFixed(1)}:1</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-deep-800/50">
                <p className="text-sm text-gray-400 mb-1">均匀性</p>
                <p className="text-3xl font-display font-bold text-cyan-400">{selectedTask.result.uniformity.toFixed(1)}%</p>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h4 className="font-display font-semibold text-white mb-4">刻蚀轮廓截面图</h4>
                <div className="h-48 bg-deep-900 rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 400 150" className="w-full h-full">
                    <defs>
                      <linearGradient id="repGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.2" />
                      </linearGradient>
                    </defs>
                    <rect x="30" y="10" width="340" height="20" fill="#64748b" rx="2" />
                    <path
                      d="M 30 30 L 30 100 Q 100 105 133 140 Q 166 155 200 140 Q 233 105 300 100 L 370 100 L 370 30 Z"
                      fill="url(#repGrad)"
                      stroke="#0EA5E9"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>

              <div>
                <h4 className="font-display font-semibold text-white mb-4">速率分布云图</h4>
                <div className="h-32 bg-deep-900 rounded-lg flex items-center justify-center">
                  <div className="flex gap-1">
                    {Array.from({ length: 30 }).map((_, i) => {
                      const hue = 200 - (i / 30) * 160;
                      return (
                        <div
                          key={i}
                          className="w-4 h-16 rounded"
                          style={{ backgroundColor: `hsl(${hue}, 80%, 50%)` }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-display font-semibold text-white mb-4">表面粗糙度曲线</h4>
                <div className="h-32 bg-deep-900 rounded-lg flex items-center justify-center">
                  <svg viewBox="0 0 400 100" className="w-full h-full">
                    <path
                      d={selectedTask.result.roughness_curve.slice(0, 50).map((v, i) => 
                        `${i === 0 ? 'M' : 'L'} ${i * 8} ${50 + v * 15}`
                      ).join(' ')}
                      fill="none"
                      stroke="#8B5CF6"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>

              <div className="pt-6 border-t border-tech-500/20">
                <h4 className="font-display font-semibold text-white mb-4">工艺参数</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div><span className="text-gray-400">射频功率: </span><span className="text-white">{selectedTask.parameters.rf_power} W</span></div>
                  <div><span className="text-gray-400">偏压功率: </span><span className="text-white">{selectedTask.parameters.bias_power} W</span></div>
                  <div><span className="text-gray-400">气压: </span><span className="text-white">{selectedTask.parameters.pressure} mTorr</span></div>
                  <div><span className="text-gray-400">温度: </span><span className="text-white">{selectedTask.parameters.temperature} °C</span></div>
                  <div><span className="text-gray-400">Ar: </span><span className="text-white">{selectedTask.parameters.gas_ratio.Ar}%</span></div>
                  <div><span className="text-gray-400">CF4: </span><span className="text-white">{selectedTask.parameters.gas_ratio.CF4}%</span></div>
                  <div><span className="text-gray-400">O2: </span><span className="text-white">{selectedTask.parameters.gas_ratio.O2}%</span></div>
                  <div><span className="text-gray-400">时间: </span><span className="text-white">{selectedTask.parameters.time} s</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

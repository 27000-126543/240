import { useState, useEffect } from 'react';
import { 
  Layers, 
  AlertTriangle, 
  Pause, 
  Play,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { api } from '@/services/api';
import type { Batch, BatchStatus, Task } from '@/types';

interface BatchWithTasks extends Batch {
  tasks: Task[];
}

export default function Batches() {
  const [batches, setBatches] = useState<BatchWithTasks[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const data = await api.batches.list() as any;
      const batchList = Array.isArray(data) ? data : data.batches || [];
      
      const batchesWithTasks = await Promise.all(
        batchList.map(async (b: any) => {
          try {
            const tasksData = await api.batches.getTasks(b.id) as any;
            const tasks = Array.isArray(tasksData) ? tasksData : tasksData.tasks || [];
            return {
              ...b,
              createdAt: new Date(b.createdAt),
              tasks: tasks.map((t: any) => ({
                ...t,
                createdAt: new Date(t.createdAt),
                warnings: t.warnings?.map((w: any) => ({ ...w, createdAt: new Date(w.createdAt) })) || [],
              })),
            };
          } catch {
            return {
              ...b,
              createdAt: new Date(b.createdAt),
              tasks: [],
            };
          }
        })
      );
      
      setBatches(batchesWithTasks);
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handlePauseResume = async (batchId: string, currentStatus: BatchStatus) => {
    try {
      setProcessing(batchId);
      if (currentStatus === 'paused') {
        await api.batches.resume(batchId);
      } else {
        await api.batches.pause(batchId, '手动暂停');
      }
      fetchBatches();
    } catch (error) {
      console.error('Failed to update batch status:', error);
    } finally {
      setProcessing(null);
    }
  };

  const statusColors: Record<BatchStatus, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    paused: 'bg-plasma-orange/20 text-plasma-orange border-plasma-orange/30',
    completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const statusLabels: Record<BatchStatus, string> = {
    active: '运行中',
    paused: '已暂停',
    completed: '已完成',
  };

  if (loading && batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-tech-400 animate-spin mb-4" />
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {batches.map(batch => {
            const completedCount = batch.tasks.filter(t => t.status === 'completed').length;
            const errorCount = batch.tasks.filter(t => t.status === 'error').length;
            const highNonuniform = batch.nonuniformCount >= 3;
            
            return (
              <div
                key={batch.id}
                onClick={() => setSelectedBatch(selectedBatch === batch.id ? null : batch.id)}
                className={`glass-panel rounded-xl p-5 cursor-pointer transition-all hover:border-tech-500/30 ${
                  selectedBatch === batch.id ? 'border-tech-500/50 ring-1 ring-tech-500/30' : ''
                } ${highNonuniform && batch.status === 'active' ? 'border-l-4 border-l-plasma-orange' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      batch.status === 'active' ? 'bg-green-500/20' : batch.status === 'paused' ? 'bg-plasma-orange/20' : 'bg-gray-500/20'
                    }`}>
                      <Layers className={`w-6 h-6 ${
                        batch.status === 'active' ? 'text-green-400' : batch.status === 'paused' ? 'text-plasma-orange' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{batch.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        创建于 {new Date(batch.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {highNonuniform && batch.status === 'active' && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-plasma-orange/20 text-plasma-orange text-xs">
                        <AlertTriangle className="w-4 h-4 animate-pulse" />
                        连续不均匀度超标
                      </div>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[batch.status]}`}>
                      {statusLabels[batch.status]}
                    </span>
                    <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${selectedBatch === batch.id ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-deep-800/30">
                    <p className="text-2xl font-display font-bold text-white">{batch.taskCount}</p>
                    <p className="text-xs text-gray-400">总任务数</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-deep-800/30">
                    <p className="text-2xl font-display font-bold text-green-400">{completedCount}</p>
                    <p className="text-xs text-gray-400">已完成</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-deep-800/30">
                    <p className="text-2xl font-display font-bold text-plasma-orange">{batch.nonuniformCount}</p>
                    <p className="text-xs text-gray-400">不均匀超标</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-deep-800/30">
                    <p className="text-2xl font-display font-bold text-red-400">{errorCount}</p>
                    <p className="text-xs text-gray-400">异常</p>
                  </div>
                </div>

                {selectedBatch === batch.id && (
                  <div className="mt-4 pt-4 border-t border-tech-500/20">
                    <div className="flex items-center gap-3 mb-3">
                      <h4 className="text-sm font-medium text-gray-300">任务列表</h4>
                      {batch.status !== 'completed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePauseResume(batch.id, batch.status); }}
                          disabled={processing === batch.id}
                          className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                            batch.status === 'paused' 
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                              : 'bg-plasma-orange/20 text-plasma-orange hover:bg-plasma-orange/30'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {processing === batch.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : batch.status === 'paused' ? (
                            <Play className="w-3.5 h-3.5" />
                          ) : (
                            <Pause className="w-3.5 h-3.5" />
                          )}
                          {processing === batch.id ? '处理中...' : batch.status === 'paused' ? '恢复批次' : '暂停批次'}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                      {batch.tasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-deep-800/30 hover:bg-deep-800/50 transition-colors">
                          <div>
                            <p className="text-sm text-white">{task.name}</p>
                            <p className="text-xs text-gray-500">{task.id}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {task.warnings.length > 0 && (
                              <AlertCircle className="w-4 h-4 text-plasma-orange" />
                            )}
                            <span className="text-xs text-gray-400">{task.progress}%</span>
                          </div>
                        </div>
                      ))}
                      {batch.tasks.length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          暂无任务
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-plasma-orange" />
              <h3 className="font-display font-semibold text-white">预警规则</h3>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-deep-800/50 border border-plasma-orange/30">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-plasma-orange" />
                  <span className="text-sm text-white">连续3次不均匀度超标</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">自动暂停该批次新任务，通知首席科学家</p>
              </div>
              <div className="p-3 rounded-lg bg-deep-800/50 border border-tech-500/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-tech-400" />
                  <span className="text-sm text-white">角度偏差超过2°</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">触发预警，推送工艺工程师复核</p>
              </div>
              <div className="p-3 rounded-lg bg-deep-800/50 border border-tech-500/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-tech-400" />
                  <span className="text-sm text-white">选择性低于阈值</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">触发预警，推送工艺工程师复核</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h3 className="font-display font-semibold text-white">处理流程</h3>
            </div>
            <ol className="space-y-3">
              {['预警推送工程师', '工程师复核确认', '自动调整参数', '重新模拟计算', '记录调参次数'].map((step, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-tech-500/20 text-tech-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-gray-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  Zap, 
  Gauge, 
  Thermometer,
  Wind,
  Clock,
  Star,
  TrendingUp,
  Target,
  Play,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { api } from '@/services/api';
import { useTaskStore } from '@/store/useTaskStore';
import { useNavigate } from 'react-router-dom';
import type { Recommendation } from '@/types';

export default function Recommendation() {
  const { batches, fetchBatches } = useTaskStore();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRec, setSelectedRec] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const data = await api.recommendations.list() as any;
      const recList = Array.isArray(data) ? data : data.recommendations || [];
      setRecommendations(recList);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
    fetchBatches();
  }, [fetchBatches]);

  const applyRecommendation = async (recId: string) => {
    const rec = recommendations.find(r => r.id === recId);
    if (!rec || batches.length === 0) return;
    
    try {
      setApplyingId(recId);
      await api.recommendations.apply(recId);
      
      navigate('/tasks');
    } catch (error) {
      console.error('Failed to apply recommendation:', error);
    } finally {
      setApplyingId(null);
    }
  };

  const stats = {
    total: recommendations.length,
    usage: 85,
    accuracy: 92.3,
    efficiency: 6.8,
  };

  if (loading && recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="w-12 h-12 text-tech-400 animate-spin mb-4" />
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-plasma-purple to-tech-500 flex items-center justify-center shadow-glow">
            <Lightbulb className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-white">智能参数推荐引擎</h2>
            <p className="text-gray-400 text-sm">基于历史模拟数据的机器学习推荐算法</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-xl bg-deep-800/50 border border-tech-500/20">
            <p className="text-3xl font-display font-bold text-tech-300">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-1">可用方案</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-deep-800/50 border border-green-500/20">
            <p className="text-3xl font-display font-bold text-green-400">{stats.usage}</p>
            <p className="text-xs text-gray-400 mt-1">历史调用次数</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-deep-800/50 border border-cyan-500/20">
            <p className="text-3xl font-display font-bold text-cyan-400">{stats.accuracy}%</p>
            <p className="text-xs text-gray-400 mt-1">推荐准确率</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-deep-800/50 border border-plasma-purple/20">
            <p className="text-3xl font-display font-bold text-plasma-purple">{stats.efficiency}x</p>
            <p className="text-xs text-gray-400 mt-1">效率提升</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {recommendations.map(rec => (
          <div
            key={rec.id}
            onClick={() => setSelectedRec(selectedRec === rec.id ? null : rec.id)}
            className={`glass-panel rounded-xl overflow-hidden cursor-pointer transition-all hover:border-tech-500/40 ${
              selectedRec === rec.id ? 'ring-2 ring-tech-500/50' : ''
            }`}
          >
            <div className="p-5 border-b border-tech-500/20">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">{rec.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">方案编号: {rec.id}</p>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs font-medium text-yellow-400">{rec.score}分</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-lg bg-deep-800/50">
                  <p className="text-lg font-display font-bold text-tech-300">{rec.predictedAngle.toFixed(1)}°</p>
                  <p className="text-[10px] text-gray-400">预测角度</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-deep-800/50">
                  <p className="text-lg font-display font-bold text-green-400">{rec.predictedSelectivity.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">预测选比</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-deep-800/50">
                  <p className="text-lg font-display font-bold text-cyan-400">{rec.predictedUniformity.toFixed(1)}%</p>
                  <p className="text-[10px] text-gray-400">预测均匀性</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> 射频功率
                </span>
                <span className="text-white font-mono">{rec.parameters.rf_power} W</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> 偏压功率
                </span>
                <span className="text-white font-mono">{rec.parameters.bias_power} W</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <Gauge className="w-4 h-4" /> 气压
                </span>
                <span className="text-white font-mono">{rec.parameters.pressure} mTorr</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <Thermometer className="w-4 h-4" /> 温度
                </span>
                <span className="text-white font-mono">{rec.parameters.temperature} °C</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <Wind className="w-4 h-4" /> 气体配比
                </span>
                <span className="text-white font-mono text-xs">
                  Ar/{rec.parameters.gas_ratio.Ar} CF4/{rec.parameters.gas_ratio.CF4} O2/{rec.parameters.gas_ratio.O2}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> 刻蚀时间
                </span>
                <span className="text-white font-mono">{rec.parameters.time} s</span>
              </div>
            </div>

            <div className="p-4 pt-0 flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <TrendingUp className="w-3.5 h-3.5" />
                已使用 {rec.usageCount} 次
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); applyRecommendation(rec.id); }}
                disabled={applyingId === rec.id || batches.length === 0}
                className="ml-auto h-9 px-4 rounded-lg bg-gradient-to-r from-tech-500 to-cyan-500 text-white text-sm font-medium flex items-center gap-1.5 hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applyingId === rec.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {applyingId === rec.id ? '应用中...' : '应用方案'}
              </button>
            </div>

            {selectedRec === rec.id && (
              <div className="p-4 border-t border-tech-500/20 bg-deep-800/30">
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4 text-tech-400" />
                  适用场景说明
                </h4>
                <ul className="space-y-2 text-xs text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                    适用于7nm及以下先进工艺节点
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                    针对高纵宽比结构优化
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                    建议配合底部抗反射涂层使用
                  </li>
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

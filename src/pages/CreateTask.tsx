import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  Zap, 
  Gauge, 
  Thermometer, 
  Wind,
  Clock,
  Play,
  Eye,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useTaskStore } from '@/store/useTaskStore';

export default function CreateTask() {
  const navigate = useNavigate();
  const { createTask, uploadMask, batches, fetchBatches } = useTaskStore();
  const [step, setStep] = useState(1);
  const [taskName, setTaskName] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [maskFile, setMaskFile] = useState<File | null>(null);
  const [params, setParams] = useState({
    rf_power: 600,
    bias_power: 120,
    pressure: 50,
    gas_ratio: { Ar: 50, CF4: 35, O2: 15 },
    temperature: 60,
    time: 180,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    if (batches.length > 0 && !selectedBatch) {
      setSelectedBatch(batches[0].id);
    }
  }, [batches, selectedBatch]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setMaskFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!taskName || !maskFile || !selectedBatch) return;
    
    try {
      setSubmitting(true);
      const newTask = await createTask({
        name: taskName,
        batchId: selectedBatch,
        parameters: params,
      });
      
      await uploadMask(newTask.id, maskFile);
      
      navigate('/tasks');
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: '基本信息' },
    { num: 2, label: '掩模上传' },
    { num: 3, label: '参数配置' },
    { num: 4, label: '确认提交' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="glass-panel rounded-xl p-6">
        <div className="flex items-center justify-between">
          {steps.map((s, idx) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  step >= s.num 
                    ? 'border-tech-500 bg-tech-500/20 text-tech-300' 
                    : 'border-gray-600 bg-deep-800 text-gray-500'
                }`}>
                  {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
                </div>
                <span className={`text-sm font-medium ${step >= s.num ? 'text-white' : 'text-gray-500'}`}>
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${step > s.num ? 'bg-green-500' : 'bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="glass-panel rounded-xl p-6 space-y-6">
          <h3 className="font-display font-semibold text-white text-lg">基本信息</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">任务名称</label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="例如：5nm FinFET 栅极刻蚀"
                className="w-full h-10 px-4 rounded-lg bg-deep-800/50 border border-tech-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-tech-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">所属批次</label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full h-10 px-4 rounded-lg bg-deep-800/50 border border-tech-500/20 text-white focus:outline-none focus:border-tech-500/50 transition-all"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="glass-panel rounded-xl p-6 space-y-6">
          <h3 className="font-display font-semibold text-white text-lg">掩模版图上传</h3>
          
          <div
            onClick={() => document.getElementById('file-upload')?.click()}
            className="border-2 border-dashed border-tech-500/30 rounded-xl p-12 text-center cursor-pointer hover:border-tech-500/50 hover:bg-tech-500/5 transition-all"
          >
            <input
              id="file-upload"
              type="file"
              accept=".gds,.oas,.gdsii"
              onChange={handleFileUpload}
              className="hidden"
            />
            {maskFile ? (
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <p className="text-white font-medium">{maskFile.name}</p>
                <p className="text-sm text-gray-400">{(maskFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto rounded-xl bg-tech-500/10 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-tech-400" />
                </div>
                <p className="text-white font-medium">点击或拖拽文件到此处上传</p>
                <p className="text-sm text-gray-400">支持 .gds, .oas, .gdsii 格式</p>
              </div>
            )}
          </div>

          {maskFile && (
            <div className="p-4 rounded-lg bg-deep-800/50 border border-tech-500/20">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-tech-400" />
                <span className="text-sm text-gray-300">掩模预览已就绪，系统将自动识别图形结构</span>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="glass-panel rounded-xl p-6 space-y-6">
          <h3 className="font-display font-semibold text-white text-lg">工艺参数配置</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> 射频功率
                  </label>
                  <span className="text-sm text-tech-300 font-mono">{params.rf_power} W</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="1000"
                  value={params.rf_power}
                  onChange={(e) => setParams({ ...params, rf_power: Number(e.target.value) })}
                  className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-tech-500"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> 偏压功率
                  </label>
                  <span className="text-sm text-cyan-400 font-mono">{params.bias_power} W</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="300"
                  value={params.bias_power}
                  onChange={(e) => setParams({ ...params, bias_power: Number(e.target.value) })}
                  className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Gauge className="w-4 h-4" /> 气压
                  </label>
                  <span className="text-sm text-green-400 font-mono">{params.pressure} mTorr</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={params.pressure}
                  onChange={(e) => setParams({ ...params, pressure: Number(e.target.value) })}
                  className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Thermometer className="w-4 h-4" /> 温度
                  </label>
                  <span className="text-sm text-orange-400 font-mono">{params.temperature} °C</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="150"
                  value={params.temperature}
                  onChange={(e) => setParams({ ...params, temperature: Number(e.target.value) })}
                  className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm text-gray-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> 刻蚀时间
                  </label>
                  <span className="text-sm text-plasma-purple font-mono">{params.time} s</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="600"
                  value={params.time}
                  onChange={(e) => setParams({ ...params, time: Number(e.target.value) })}
                  className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-tech-500/20">
            <h4 className="text-sm text-gray-400 mb-4 flex items-center gap-2">
              <Wind className="w-4 h-4" /> 气体组份
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {(['Ar', 'CF4', 'O2'] as const).map(gas => (
                <div key={gas}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-400">{gas}</span>
                    <span className="text-sm text-white font-mono">{params.gas_ratio[gas]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={params.gas_ratio[gas]}
                    onChange={(e) => setParams({
                      ...params,
                      gas_ratio: { ...params.gas_ratio, [gas]: Number(e.target.value) }
                    })}
                    className="w-full h-2 bg-deep-800 rounded-lg appearance-none cursor-pointer accent-tech-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="glass-panel rounded-xl p-6 space-y-6">
          <h3 className="font-display font-semibold text-white text-lg">确认任务信息</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-deep-800/50 border border-tech-500/20">
                <p className="text-xs text-gray-400 mb-1">任务名称</p>
                <p className="text-white font-medium">{taskName || '未命名任务'}</p>
              </div>
              <div className="p-4 rounded-lg bg-deep-800/50 border border-tech-500/20">
                <p className="text-xs text-gray-400 mb-1">所属批次</p>
                <p className="text-white font-medium">{batches.find(b => b.id === selectedBatch)?.name}</p>
              </div>
              <div className="p-4 rounded-lg bg-deep-800/50 border border-tech-500/20">
                <p className="text-xs text-gray-400 mb-1">掩模文件</p>
                <p className="text-white font-medium">{maskFile?.name || '未上传'}</p>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-deep-800/50 border border-tech-500/20 space-y-3">
              <p className="text-xs text-gray-400 mb-2">工艺参数摘要</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">射频: </span><span className="text-white">{params.rf_power}W</span></div>
                <div><span className="text-gray-400">偏压: </span><span className="text-white">{params.bias_power}W</span></div>
                <div><span className="text-gray-400">气压: </span><span className="text-white">{params.pressure}mT</span></div>
                <div><span className="text-gray-400">温度: </span><span className="text-white">{params.temperature}°C</span></div>
                <div><span className="text-gray-400">时间: </span><span className="text-white">{params.time}s</span></div>
                <div><span className="text-gray-400">气体: </span><span className="text-white">Ar/CF4/O2</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="h-10 px-6 rounded-lg bg-deep-800/50 border border-tech-500/20 text-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:border-tech-500/40 transition-all"
        >
          上一步
        </button>
        
        {step < 4 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="h-10 px-6 rounded-lg bg-gradient-to-r from-tech-500 to-cyan-500 text-white text-sm font-medium hover:shadow-glow transition-all"
          >
            下一步
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!taskName || !maskFile || submitting}
            className="h-10 px-6 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium flex items-center gap-2 hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {submitting ? '提交中...' : '提交任务'}
          </button>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User,
  ChevronRight,
  MessageSquare,
  Filter
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useTaskStore } from '@/store/useTaskStore';
import type { ApprovalStatus } from '@/types';

export default function Approval() {
  const { tasks, updateApproval } = useTaskStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedApproval, setSelectedApproval] = useState<{ taskId: string; approvalId: string } | null>(null);
  const [comment, setComment] = useState('');

  const pendingApprovals = tasks.flatMap(task => 
    task.approvals.map(approval => ({
      ...approval,
      taskName: task.name,
      taskId: task.id,
      taskStatus: task.status,
    }))
  ).filter(a => filter === 'all' ? true : a.status === filter);

  const handleApprove = () => {
    if (selectedApproval) {
      updateApproval(selectedApproval.taskId, selectedApproval.approvalId, 'approved', comment || '审批通过');
      setSelectedApproval(null);
      setComment('');
    }
  };

  const handleReject = () => {
    if (selectedApproval) {
      updateApproval(selectedApproval.taskId, selectedApproval.approvalId, 'rejected', comment || '需要优化');
      setSelectedApproval(null);
      setComment('');
    }
  };

  const statusIcons: Record<ApprovalStatus, React.ReactNode> = {
    pending: <Clock className="w-4 h-4" />,
    approved: <CheckCircle className="w-4 h-4" />,
    rejected: <XCircle className="w-4 h-4" />,
  };

  const statusColors: Record<ApprovalStatus, string> = {
    pending: 'text-tech-400 bg-tech-500/20',
    approved: 'text-green-400 bg-green-500/20',
    rejected: 'text-red-400 bg-red-500/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-tech-500/20 text-tech-300 border border-tech-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {f === 'all' ? '全部' : f === 'pending' ? '待审批' : f === 'approved' ? '已通过' : '已拒绝'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel rounded-xl overflow-hidden">
          <div className="p-4 border-b border-tech-500/20">
            <h3 className="font-display font-semibold text-white">审批列表</h3>
          </div>
          <div className="divide-y divide-tech-500/10 max-h-[600px] overflow-y-auto scrollbar-thin">
            {pendingApprovals.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                <p className="text-gray-400">暂无{filter === 'all' ? '' : filter === 'pending' ? '待处理的' : ''}审批项</p>
              </div>
            ) : (
              pendingApprovals.map(approval => (
                <div
                  key={approval.id}
                  onClick={() => setSelectedApproval({ taskId: approval.taskId, approvalId: approval.id })}
                  className={`p-4 hover:bg-white/5 cursor-pointer transition-all ${
                    selectedApproval?.approvalId === approval.id ? 'bg-tech-500/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-white">{approval.taskName}</span>
                        <StatusBadge status={approval.taskStatus} showIcon={false} />
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {approval.approver}
                        </span>
                        <span className="flex items-center gap-1">
                          {statusIcons[approval.status]}
                          {approval.level === 'engineer' ? '工程师审核' : '经理审批'}
                        </span>
                        <span>{new Date(approval.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColors[approval.status]}`}>
                        {statusIcons[approval.status]}
                        {approval.status === 'pending' ? '待处理' : approval.status === 'approved' ? '已通过' : '已拒绝'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                  {approval.comment && (
                    <div className="mt-3 p-3 rounded-lg bg-deep-800/50 text-xs text-gray-300">
                      <span className="text-gray-500">意见: </span>{approval.comment}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-6">
          <h3 className="font-display font-semibold text-white mb-6">审批操作</h3>
          
          {!selectedApproval ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="text-gray-500">请从左侧选择审批项</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">审批意见</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="输入审批意见..."
                  rows={4}
                  className="w-full p-3 rounded-lg bg-deep-800/50 border border-tech-500/20 text-white placeholder-gray-500 focus:outline-none focus:border-tech-500/50 transition-all resize-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleReject}
                  className="h-10 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-500/30 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  拒绝
                </button>
                <button
                  onClick={handleApprove}
                  className="h-10 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-500/30 transition-all"
                >
                  <CheckCircle className="w-4 h-4" />
                  通过
                </button>
              </div>
              
              <button
                onClick={() => navigate(`/tasks/${selectedApproval.taskId}`)}
                className="w-full h-10 rounded-lg bg-deep-800/50 border border-tech-500/20 text-gray-300 text-sm font-medium hover:border-tech-500/40 transition-all"
              >
                查看任务详情
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

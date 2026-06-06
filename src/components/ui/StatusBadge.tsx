import type { TaskStatus } from '@/types';
import { statusLabels } from '@/data/mockData';
import { Loader2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface StatusBadgeProps {
  status: TaskStatus;
  showIcon?: boolean;
}

export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const iconMap: Record<TaskStatus, React.ReactNode> = {
    pending: <Clock className="w-3.5 h-3.5" />,
    model_building: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    plasma_calculation: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    rate_analysis: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    profile_evolution: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    completed: <CheckCircle className="w-3.5 h-3.5" />,
    error: <AlertTriangle className="w-3.5 h-3.5" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border status-${status}`}>
      {showIcon && iconMap[status]}
      {statusLabels[status]}
    </span>
  );
}

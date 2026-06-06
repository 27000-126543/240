import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: number;
  color?: 'blue' | 'cyan' | 'green' | 'orange' | 'purple';
}

const colorStyles = {
  blue: 'from-tech-500/20 to-tech-600/5 border-tech-500/30 text-tech-300',
  cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 text-cyan-400',
  green: 'from-green-500/20 to-green-600/5 border-green-500/30 text-green-400',
  orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30 text-orange-400',
  purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 text-purple-400',
};

export function StatCard({ title, value, unit, icon: Icon, trend, color = 'blue' }: StatCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${colorStyles[color]} border p-5 transition-all hover:scale-[1.02] hover:shadow-glow`}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-400 font-medium">{title}</p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-display font-bold text-white">{value}</span>
              {unit && <span className="text-sm text-gray-400">{unit}</span>}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-lg bg-current bg-opacity-10 flex items-center justify-center`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        
        {trend !== undefined && (
          <div className="mt-3 flex items-center gap-1">
            {trend >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500">较昨日</span>
          </div>
        )}
      </div>
    </div>
  );
}

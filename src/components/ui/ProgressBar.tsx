interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'blue' | 'cyan' | 'green' | 'orange';
  showLabel?: boolean;
  height?: string;
}

const colorClasses = {
  blue: 'bg-tech-500',
  cyan: 'bg-cyan-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
};

export function ProgressBar({ 
  value, 
  max = 100, 
  color = 'blue', 
  showLabel = false,
  height = 'h-2'
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-1 text-xs">
          <span className="text-gray-400">进度</span>
          <span className="text-white font-medium">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className={`w-full ${height} bg-deep-800 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500 relative`}
          style={{ width: `${percentage}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        </div>
      </div>
    </div>
  );
}

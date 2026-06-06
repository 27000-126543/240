import { Bell, Search, Settings, RefreshCw } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-tech-500/20 bg-deep-900/50 backdrop-blur-sm">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索任务、批次..."
            className="w-64 h-9 pl-10 pr-4 rounded-lg bg-deep-800/50 border border-tech-500/20 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-tech-500/50 focus:ring-1 focus:ring-tech-500/30 transition-all"
          />
        </div>
        
        <button className="w-9 h-9 rounded-lg bg-deep-800/50 border border-tech-500/20 flex items-center justify-center text-gray-400 hover:text-white hover:border-tech-500/40 transition-all">
          <RefreshCw className="w-4 h-4" />
        </button>
        
        <button className="w-9 h-9 rounded-lg bg-deep-800/50 border border-tech-500/20 flex items-center justify-center text-gray-400 hover:text-white hover:border-tech-500/40 transition-all relative">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-plasma-orange text-white text-[10px] flex items-center justify-center">3</span>
        </button>
        
        <button className="w-9 h-9 rounded-lg bg-deep-800/50 border border-tech-500/20 flex items-center justify-center text-gray-400 hover:text-white hover:border-tech-500/40 transition-all">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

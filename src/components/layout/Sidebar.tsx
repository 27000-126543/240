import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ListTodo, 
  PlusCircle, 
  CheckSquare, 
  FileBarChart, 
  Layers, 
  Lightbulb,
  Atom,
  Bell,
  User
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: '综合看板', icon: LayoutDashboard },
  { path: '/tasks', label: '任务管理', icon: ListTodo },
  { path: '/tasks/create', label: '创建任务', icon: PlusCircle },
  { path: '/approval', label: '审批中心', icon: CheckSquare },
  { path: '/reports', label: '报告中心', icon: FileBarChart },
  { path: '/batches', label: '批次管理', icon: Layers },
  { path: '/recommendation', label: '智能推荐', icon: Lightbulb },
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-deep-900/90 border-r border-tech-500/20 flex flex-col backdrop-blur-xl">
      <div className="p-6 border-b border-tech-500/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-tech-500 to-cyan-500 flex items-center justify-center shadow-glow">
            <Atom className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-white glow-text">PlasmaSIM</h1>
            <p className="text-xs text-gray-400">刻蚀工艺模拟平台</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-tech-500/20 text-tech-300 shadow-glow border border-tech-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium text-sm">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-tech-500/20 space-y-3">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all">
          <Bell className="w-5 h-5" />
          <span className="font-medium text-sm">通知中心</span>
          <span className="ml-auto w-5 h-5 rounded-full bg-plasma-orange text-white text-xs flex items-center justify-center">3</span>
        </button>
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-tech-500 to-plasma-purple flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">张工程师</p>
            <p className="text-xs text-gray-400 truncate">工艺研发部</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

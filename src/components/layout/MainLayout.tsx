import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: '综合看板', subtitle: '实时监控工艺模拟状态与统计分析' },
  '/tasks': { title: '任务管理', subtitle: '查看和管理所有模拟任务' },
  '/tasks/create': { title: '创建模拟任务', subtitle: '上传掩模并配置工艺参数' },
  '/approval': { title: '审批中心', subtitle: '工艺方案两级审批流程' },
  '/reports': { title: '报告中心', subtitle: '模拟报告生成与数据导出' },
  '/batches': { title: '批次管理', subtitle: '批次任务监控与异常处理' },
  '/recommendation': { title: '智能参数推荐', subtitle: '基于历史数据的最优参数推荐' },
};

export function MainLayout() {
  const location = useLocation();
  const matchedPath = Object.keys(pageTitles).find(
    path => location.pathname === path || location.pathname.startsWith(path + '/')
  ) || location.pathname;
  
  const pageInfo = pageTitles[matchedPath] || { title: '等离子体刻蚀模拟平台' };
  
  return (
    <div className="flex h-screen bg-deep-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={pageInfo.title} subtitle={pageInfo.subtitle} />
        <main className="flex-1 overflow-y-auto scrollbar-thin grid-bg">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

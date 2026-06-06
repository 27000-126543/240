import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../db/database';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    
    let dailyStats = db.findOne('dailyStats', (d: any) => d.date === today);
    
    if (!dailyStats) {
      dailyStats = await generateDailyStats(today);
    }

    const activeStatuses = ['model_building', 'plasma_calculation', 'rate_analysis', 'profile_evolution'];
    const activeTasks = db.count('tasks', (t: any) => activeStatuses.includes(t.status));

    const allWarnings = db.getAll('warnings');
    const warningsToday = allWarnings.filter((w: any) => {
      const warningDate = dayjs(w.createdAt).format('YYYY-MM-DD');
      return warningDate === today;
    }).length;

    const approvalsPending = db.count('approvals', (a: any) => a.status === 'pending');

    res.json({
      completionRate: dailyStats.completionRate,
      rateDeviation: dailyStats.rateDeviation,
      optimizationCount: dailyStats.optimizationCount,
      activeTasks,
      warningsToday,
      approvalsPending
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

router.get('/process-capability', async (req: Request, res: Response) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    let dailyStats = db.findOne('dailyStats', (d: any) => d.date === today);
    
    if (!dailyStats || !dailyStats.processCapability) {
      dailyStats = await generateDailyStats(today);
    }

    res.json(dailyStats.processCapability || getDefaultProcessCapability());
  } catch (error) {
    res.status(500).json({ error: '获取工艺能力指数失败' });
  }
});

router.get('/weekly-trends', async (req: Request, res: Response) => {
  try {
    let tasks = db.getAll('tasks');
    tasks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    tasks = tasks.slice(0, 100);

    const dailyData: Record<string, { completed: number; total: number }> = {};
    
    tasks.forEach((task: any) => {
      const date = dayjs(task.createdAt).format('MM-DD');
      if (!dailyData[date]) {
        dailyData[date] = { completed: 0, total: 0 };
      }
      dailyData[date].total++;
      if (task.status === 'completed') {
        dailyData[date].completed++;
      }
    });

    const sortedDates = Object.keys(dailyData).sort().slice(-7);
    const trends = sortedDates.map(date => ({
      date,
      completed: dailyData[date].completed,
      total: dailyData[date].total
    }));

    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: '获取趋势数据失败' });
  }
});

router.get('/active-tasks', async (req: Request, res: Response) => {
  try {
    const activeStatuses = ['model_building', 'plasma_calculation', 'rate_analysis', 'profile_evolution'];
    let activeTasks = db.find('tasks', (t: any) => activeStatuses.includes(t.status));
    activeTasks.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    activeTasks = activeTasks.slice(0, 10);

    const activeTasksWithWarnings = activeTasks.map((task: any) => ({
      ...task,
      warnings: db.find('warnings', (w: any) => w.taskId === task.id)
    }));

    res.json(activeTasksWithWarnings);
  } catch (error) {
    res.status(500).json({ error: '获取活跃任务失败' });
  }
});

router.get('/recent-warnings', async (req: Request, res: Response) => {
  try {
    let warnings = db.getAll('warnings');
    warnings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    warnings = warnings.slice(0, 10);

    const warningsWithTask = warnings.map((warning: any) => ({
      ...warning,
      task: db.findOne('tasks', (t: any) => t.id === warning.taskId)
    }));

    res.json(warningsWithTask);
  } catch (error) {
    res.status(500).json({ error: '获取预警列表失败' });
  }
});

async function generateDailyStats(date: string): Promise<any> {
  const allTasks = db.getAll('tasks');
  const completedTasks = allTasks.filter((t: any) => t.status === 'completed');
  
  const completionRate = allTasks.length > 0 
    ? (completedTasks.length / allTasks.length) * 100 
    : 0;

  const rateDeviation = completedTasks.length > 0
    ? completedTasks.reduce((sum: number, t: any) => {
        if (t.result) {
          return sum + Math.abs(t.result.etch_rate - 100);
        }
        return sum;
      }, 0) / completedTasks.length
    : 0;

  const optimizationCount = db.count('tasks', (t: any) => (t.adjustCount || 0) > 0);

  const dailyStats = db.create('dailyStats', {
    id: uuidv4(),
    date,
    completionRate: Number(completionRate.toFixed(1)),
    rateDeviation: Number(rateDeviation.toFixed(2)),
    optimizationCount,
    totalTasks: allTasks.length,
    completedTasks: completedTasks.length,
    processCapability: getDefaultProcessCapability(),
    createdAt: new Date()
  });

  return dailyStats;
}

function getDefaultProcessCapability() {
  return [
    { dimension: '刻蚀速率控制', value: 85, fullMark: 100 },
    { dimension: '剖面角度精度', value: 92, fullMark: 100 },
    { dimension: '选择比控制', value: 88, fullMark: 100 },
    { dimension: '均匀性控制', value: 90, fullMark: 100 },
    { dimension: '粗糙度控制', value: 87, fullMark: 100 },
    { dimension: '工艺稳定性', value: 83, fullMark: 100 }
  ];
}

export { router as dashboardRoutes };

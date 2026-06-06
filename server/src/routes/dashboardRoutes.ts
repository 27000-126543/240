import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { db } from '../db/sqlite';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    
    let dailyStats = db.get('SELECT * FROM daily_stats WHERE date = ?', [today]);
    
    if (!dailyStats) {
      dailyStats = await generateDailyStats(today);
    }

    const activeStatuses = ['model_building', 'plasma_calculation', 'rate_analysis', 'profile_evolution'];
    const placeholders = activeStatuses.map(() => '?').join(',');
    const activeTasks = db.count(
      `SELECT COUNT(*) as count FROM tasks WHERE status IN (${placeholders})`,
      activeStatuses
    );

    const warningsToday = db.count(
      'SELECT COUNT(*) as count FROM warnings WHERE DATE(created_at) = ?',
      [today]
    );

    const approvalsPending = db.count(
      "SELECT COUNT(*) as count FROM approvals WHERE status = 'pending'",
      []
    );

    res.json({
      completionRate: dailyStats.completion_rate,
      rateDeviation: dailyStats.rate_deviation,
      optimizationCount: dailyStats.optimization_count,
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
    let dailyStats = db.get('SELECT * FROM daily_stats WHERE date = ?', [today]);
    
    if (!dailyStats || !dailyStats.process_capability) {
      dailyStats = await generateDailyStats(today);
    }

    res.json(dailyStats.process_capability ? JSON.parse(dailyStats.process_capability) : getDefaultProcessCapability());
  } catch (error) {
    res.status(500).json({ error: '获取工艺能力指数失败' });
  }
});

router.get('/weekly-trends', async (req: Request, res: Response) => {
  try {
    const tasks = db.all('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100');

    const dailyData: Record<string, { completed: number; total: number }> = {};
    
    tasks.forEach((task: any) => {
      const date = dayjs(task.created_at).format('MM-DD');
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
    const placeholders = activeStatuses.map(() => '?').join(',');
    
    let activeTasks = db.all(
      `SELECT * FROM tasks WHERE status IN (${placeholders}) ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 10`,
      activeStatuses
    );

    const activeTasksWithWarnings = activeTasks.map((task: any) => ({
      ...task,
      parameters: task.parameters ? JSON.parse(task.parameters) : null,
      result: task.result ? JSON.parse(task.result) : null,
      warnings: db.all('SELECT * FROM warnings WHERE task_id = ?', [task.id])
    }));

    res.json(activeTasksWithWarnings);
  } catch (error) {
    res.status(500).json({ error: '获取活跃任务失败' });
  }
});

router.get('/recent-warnings', async (req: Request, res: Response) => {
  try {
    const warnings = db.all('SELECT * FROM warnings ORDER BY created_at DESC LIMIT 10');

    const warningsWithTask = warnings.map((warning: any) => ({
      ...warning,
      acknowledged: warning.acknowledged === 1,
      task: db.get('SELECT * FROM tasks WHERE id = ?', [warning.task_id])
    }));

    res.json(warningsWithTask);
  } catch (error) {
    res.status(500).json({ error: '获取预警列表失败' });
  }
});

async function generateDailyStats(date: string): Promise<any> {
  const allTasks = db.all('SELECT * FROM tasks');
  const parsedTasks = allTasks.map((t: any) => ({
    ...t,
    result: t.result ? JSON.parse(t.result) : null
  }));

  const completedTasks = parsedTasks.filter((t: any) => t.status === 'completed');
  
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

  const optimizationCount = db.count(
    'SELECT COUNT(*) as count FROM tasks WHERE adjust_count > 0',
    []
  );

  const dailyStatsId = uuidv4();
  db.run(`
    INSERT INTO daily_stats (id, date, completion_rate, rate_deviation, optimization_count, total_tasks, completed_tasks, warning_count, approval_count, process_capability, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    dailyStatsId,
    date,
    Number(completionRate.toFixed(1)),
    Number(rateDeviation.toFixed(2)),
    optimizationCount,
    allTasks.length,
    completedTasks.length,
    0,
    0,
    JSON.stringify(getDefaultProcessCapability())
  ]);

  return db.get('SELECT * FROM daily_stats WHERE id = ?', [dailyStatsId]);
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

import { Router, Request, Response } from 'express';
import { db } from '../db/database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { acknowledged, taskId, type } = req.query;
    
    let warnings = db.getAll('warnings');
    if (acknowledged !== undefined) {
      warnings = warnings.filter((w: any) => w.acknowledged === (acknowledged === 'true'));
    }
    if (taskId) {
      warnings = warnings.filter((w: any) => w.taskId === taskId);
    }
    if (type) {
      warnings = warnings.filter((w: any) => w.type === type);
    }

    warnings.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const warningsWithTask = warnings.map((warning: any) => ({
      ...warning,
      task: db.findOne('tasks', (t: any) => t.id === warning.taskId)
    }));

    res.json(warningsWithTask);
  } catch (error) {
    res.status(500).json({ error: '获取预警列表失败' });
  }
});

router.get('/:warningId', async (req: Request, res: Response) => {
  try {
    const warning = db.findOne('warnings', (w: any) => w.id === req.params.warningId);

    if (!warning) {
      return res.status(404).json({ error: '预警不存在' });
    }

    const warningWithTask = {
      ...warning,
      task: db.findOne('tasks', (t: any) => t.id === warning.taskId)
    };

    res.json(warningWithTask);
  } catch (error) {
    res.status(500).json({ error: '获取预警详情失败' });
  }
});

router.put('/:warningId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { acknowledgedBy, ackComment } = req.body;
    const warning = db.findOne('warnings', (w: any) => w.id === req.params.warningId);

    if (!warning) {
      return res.status(404).json({ error: '预警不存在' });
    }

    const updatedWarning = db.update('warnings', (w: any) => w.id === req.params.warningId, {
      acknowledged: true,
      acknowledgedBy: acknowledgedBy || 'engineer',
      ackComment: ackComment || ''
    });

    res.json({ message: '预警已确认', warning: updatedWarning });
  } catch (error) {
    res.status(500).json({ error: '确认预警失败' });
  }
});

export { router as warningRoutes };

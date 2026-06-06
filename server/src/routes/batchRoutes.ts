import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    let batches = db.getAll('batches');
    batches.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const batchesWithTasks = batches.map((batch: any) => ({
      ...batch,
      tasks: db.find('tasks', (t: any) => t.batchId === batch.id)
    }));

    res.json(batchesWithTasks);
  } catch (error) {
    res.status(500).json({ error: '获取批次列表失败' });
  }
});

router.get('/:batchId', async (req: Request, res: Response) => {
  try {
    const batch = db.findOne('batches', (b: any) => b.id === req.params.batchId);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const batchWithTasks = {
      ...batch,
      tasks: db.find('tasks', (t: any) => t.batchId === batch.id)
    };

    res.json(batchWithTasks);
  } catch (error) {
    res.status(500).json({ error: '获取批次详情失败' });
  }
});

router.get('/:batchId/tasks', async (req: Request, res: Response) => {
  try {
    let tasks = db.find('tasks', (t: any) => t.batchId === req.params.batchId);
    tasks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const tasksWithRelations = tasks.map((task: any) => ({
      ...task,
      warnings: db.find('warnings', (w: any) => w.taskId === task.id),
      approvals: db.find('approvals', (a: any) => a.taskId === task.id)
    }));

    res.json(tasksWithRelations);
  } catch (error) {
    res.status(500).json({ error: '获取批次任务失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    const batch = db.create('batches', {
      id: uuidv4(),
      name: name || `批次-${new Date().toLocaleDateString()}`,
      status: 'active',
      nonuniformCount: 0,
      taskCount: 0,
      completedCount: 0,
      createdAt: new Date()
    });

    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: '创建批次失败' });
  }
});

router.put('/:batchId/pause', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const batch = db.findOne('batches', (b: any) => b.id === req.params.batchId);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const updatedBatch = db.update('batches', (b: any) => b.id === req.params.batchId, {
      status: 'paused',
      pauseReason: reason || '手动暂停'
    });

    res.json({ message: '批次已暂停', batch: updatedBatch });
  } catch (error) {
    res.status(500).json({ error: '暂停批次失败' });
  }
});

router.put('/:batchId/resume', async (req: Request, res: Response) => {
  try {
    const batch = db.findOne('batches', (b: any) => b.id === req.params.batchId);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const updatedBatch = db.update('batches', (b: any) => b.id === req.params.batchId, {
      status: 'active',
      pauseReason: null,
      nonuniformCount: 0
    });

    res.json({ message: '批次已恢复', batch: updatedBatch });
  } catch (error) {
    res.status(500).json({ error: '恢复批次失败' });
  }
});

export { router as batchRoutes };

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/sqlite';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const batches = db.all('SELECT * FROM batches ORDER BY created_at DESC');

    const batchesWithTasks = batches.map((batch: any) => ({
      ...batch,
      tasks: db.all('SELECT * FROM tasks WHERE batch_id = ?', [batch.id]).map((task: any) => ({
        ...task,
        parameters: task.parameters ? JSON.parse(task.parameters) : null,
        result: task.result ? JSON.parse(task.result) : null
      }))
    }));

    res.json(batchesWithTasks);
  } catch (error) {
    res.status(500).json({ error: '获取批次列表失败' });
  }
});

router.get('/:batchId', async (req: Request, res: Response) => {
  try {
    const batch = db.get('SELECT * FROM batches WHERE id = ?', [req.params.batchId]);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    const batchWithTasks = {
      ...batch,
      tasks: db.all('SELECT * FROM tasks WHERE batch_id = ?', [batch.id]).map((task: any) => ({
        ...task,
        parameters: task.parameters ? JSON.parse(task.parameters) : null,
        result: task.result ? JSON.parse(task.result) : null
      }))
    };

    res.json(batchWithTasks);
  } catch (error) {
    res.status(500).json({ error: '获取批次详情失败' });
  }
});

router.get('/:batchId/tasks', async (req: Request, res: Response) => {
  try {
    const tasks = db.all('SELECT * FROM tasks WHERE batch_id = ? ORDER BY created_at DESC', [req.params.batchId]);

    const tasksWithRelations = tasks.map((task: any) => ({
      ...task,
      parameters: task.parameters ? JSON.parse(task.parameters) : null,
      result: task.result ? JSON.parse(task.result) : null,
      warnings: db.all('SELECT * FROM warnings WHERE task_id = ?', [task.id]),
      approvals: db.all('SELECT * FROM approvals WHERE task_id = ?', [task.id])
    }));

    res.json(tasksWithRelations);
  } catch (error) {
    res.status(500).json({ error: '获取批次任务失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    const batchId = uuidv4();
    db.run(`
      INSERT INTO batches (id, name, status, nonuniform_count, task_count, completed_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [batchId, name || `批次-${new Date().toLocaleDateString()}`, 'active', 0, 0, 0]);

    const batch = db.get('SELECT * FROM batches WHERE id = ?', [batchId]);

    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: '创建批次失败' });
  }
});

router.put('/:batchId/pause', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const batch = db.get('SELECT * FROM batches WHERE id = ?', [req.params.batchId]);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    db.run(`
      UPDATE batches 
      SET status = ?, pause_reason = ?
      WHERE id = ?
    `, ['paused', reason || '手动暂停', req.params.batchId]);

    const updatedBatch = db.get('SELECT * FROM batches WHERE id = ?', [req.params.batchId]);

    res.json({ message: '批次已暂停', batch: updatedBatch });
  } catch (error) {
    res.status(500).json({ error: '暂停批次失败' });
  }
});

router.put('/:batchId/resume', async (req: Request, res: Response) => {
  try {
    const batch = db.get('SELECT * FROM batches WHERE id = ?', [req.params.batchId]);

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    db.run(`
      UPDATE batches 
      SET status = ?, pause_reason = ?, nonuniform_count = 0
      WHERE id = ?
    `, ['active', null, req.params.batchId]);

    const updatedBatch = db.get('SELECT * FROM batches WHERE id = ?', [req.params.batchId]);

    res.json({ message: '批次已恢复', batch: updatedBatch });
  } catch (error) {
    res.status(500).json({ error: '恢复批次失败' });
  }
});

export { router as batchRoutes };

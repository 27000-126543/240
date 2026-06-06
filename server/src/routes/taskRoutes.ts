import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/sqlite';
import { simulationEngine } from '../services/simulationEngine';
import { ProcessParams, TaskStatus } from '../types';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.gds', '.oas', '.gdsii'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 .gds, .oas, .gdsii 格式文件'));
    }
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { batchId, status, page = 1, limit = 20 } = req.query;
    
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];
    
    if (batchId) {
      sql += ' AND batch_id = ?';
      params.push(batchId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), (Number(page) - 1) * Number(limit));
    
    const tasks = db.all(sql, params);
    
    let countSql = 'SELECT COUNT(*) as count FROM tasks WHERE 1=1';
    const countParams: any[] = [];
    if (batchId) {
      countSql += ' AND batch_id = ?';
      countParams.push(batchId);
    }
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    const total = db.count(countSql, countParams);

    const tasksWithRelations = tasks.map((task: any) => ({
      ...task,
      parameters: task.parameters ? JSON.parse(task.parameters) : null,
      result: task.result ? JSON.parse(task.result) : null,
      realtime_metrics: task.realtime_metrics ? JSON.parse(task.realtime_metrics) : null,
      mask_data: task.mask_data ? JSON.parse(task.mask_data) : null,
      warnings: db.all('SELECT * FROM warnings WHERE task_id = ?', [task.id]),
      approvals: db.all('SELECT * FROM approvals WHERE task_id = ?', [task.id]),
      adjustments: db.all('SELECT * FROM adjustments WHERE task_id = ?', [task.id]).map((a: any) => ({
        ...a,
        before_params: a.before_params ? JSON.parse(a.before_params) : null,
        after_params: a.after_params ? JSON.parse(a.after_params) : null
      }))
    }));

    res.json({
      data: tasksWithRelations,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

router.get('/:taskId', async (req: Request, res: Response) => {
  try {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const taskWithRelations = {
      ...task,
      parameters: task.parameters ? JSON.parse(task.parameters) : null,
      result: task.result ? JSON.parse(task.result) : null,
      realtime_metrics: task.realtime_metrics ? JSON.parse(task.realtime_metrics) : null,
      mask_data: task.mask_data ? JSON.parse(task.mask_data) : null,
      warnings: db.all('SELECT * FROM warnings WHERE task_id = ?', [task.id]),
      approvals: db.all('SELECT * FROM approvals WHERE task_id = ?', [task.id]),
      adjustments: db.all('SELECT * FROM adjustments WHERE task_id = ?', [task.id]).map((a: any) => ({
        ...a,
        before_params: a.before_params ? JSON.parse(a.before_params) : null,
        after_params: a.after_params ? JSON.parse(a.after_params) : null
      }))
    };

    res.json(taskWithRelations);
  } catch (error) {
    res.status(500).json({ error: '获取任务详情失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, batchId, parameters } = req.body;
    const actualBatchId = batchId || uuidv4();

    let batch = db.get('SELECT * FROM batches WHERE id = ?', [actualBatchId]);
    if (!batch) {
      db.run(`
        INSERT INTO batches (id, name, status, nonuniform_count, task_count, completed_count, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [actualBatchId, `批次-${new Date().toLocaleDateString()}`, 'active', 0, 0, 0]);
      batch = db.get('SELECT * FROM batches WHERE id = ?', [actualBatchId]);
    }

    if (!batch) {
      return res.status(500).json({ error: '创建批次失败' });
    }

    if (batch.status === 'paused') {
      return res.status(400).json({ error: '该批次已暂停，无法创建新任务' });
    }

    const taskId = uuidv4();
    const taskParams = parameters || {
      rf_power: 800,
      bias_power: 200,
      pressure: 50,
      gas_ratio: { Ar: 40, CF4: 30, O2: 30 },
      temperature: 25,
      time: 300
    };
    
    db.run(`
      INSERT INTO tasks (id, batch_id, name, status, progress, parameters, adjust_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [taskId, actualBatchId, name, 'pending', 0, JSON.stringify(taskParams), 0]);

    db.run('UPDATE batches SET task_count = task_count + 1 WHERE id = ?', [actualBatchId]);

    const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(500).json({ error: '创建任务失败' });
    }
    
    const responseTask = {
      ...task,
      parameters: task.parameters ? JSON.parse(task.parameters) : null
    };

    res.status(201).json(responseTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建任务失败' });
  }
});

router.post('/:taskId/upload', upload.single('maskFile'), async (req: Request, res: Response) => {
  try {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const maskData = parseMaskFile(req.file.path);

    db.run(`
      UPDATE tasks 
      SET mask_file = ?, mask_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.file.filename, JSON.stringify(maskData), req.params.taskId]);

    res.json({
      message: '掩模文件上传成功',
      maskFile: req.file.filename,
      maskData
    });
  } catch (error) {
    res.status(500).json({ error: '文件上传失败' });
  }
});

function parseMaskFile(filePath: string) {
  return {
    layers: [
      { id: 1, name: '掩模层1', type: 'polygon', count: 25 },
      { id: 2, name: '掩模层2', type: 'path', count: 18 }
    ],
    boundingBox: { width: 1000, height: 1000 },
    features: 43,
    parsedAt: new Date()
  };
}

router.post('/:taskId/start', async (req: Request, res: Response) => {
  try {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (task.status !== 'pending') {
      return res.status(400).json({ error: '任务状态不允许启动' });
    }

    await simulationEngine.startTask(task.id);

    res.json({ message: '任务已启动', taskId: task.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '启动任务失败' });
  }
});

router.put('/:taskId/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    db.run(`
      UPDATE tasks 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status as TaskStatus, req.params.taskId]);

    const updatedTask = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    const responseTask = {
      ...updatedTask,
      parameters: updatedTask.parameters ? JSON.parse(updatedTask.parameters) : null,
      result: updatedTask.result ? JSON.parse(updatedTask.result) : null
    };

    res.json(responseTask);
  } catch (error) {
    res.status(500).json({ error: '更新任务状态失败' });
  }
});

router.get('/:taskId/metrics', async (req: Request, res: Response) => {
  try {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    res.json({
      status: task.status,
      progress: task.progress,
      metrics: task.realtime_metrics ? JSON.parse(task.realtime_metrics) : [],
      result: task.result ? JSON.parse(task.result) : null
    });
  } catch (error) {
    res.status(500).json({ error: '获取监控数据失败' });
  }
});

router.post('/:taskId/adjust', async (req: Request, res: Response) => {
  try {
    const { parameters, reason, adjustedBy } = req.body;
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const taskParams = task.parameters ? JSON.parse(task.parameters) : {};
    const adjustmentId = uuidv4();
    
    db.run(`
      INSERT INTO adjustments (id, task_id, before_params, after_params, reason, adjusted_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [adjustmentId, task.id, JSON.stringify(taskParams), JSON.stringify({ ...taskParams, ...parameters }), reason, adjustedBy || 'system']);

    const updatedTask = await simulationEngine.adjustParameters(
      task.id,
      parameters,
      reason,
      adjustedBy || 'system'
    );

    const adjustment = db.get('SELECT * FROM adjustments WHERE id = ?', [adjustmentId]);
    const responseAdjustment = {
      ...adjustment,
      before_params: adjustment.before_params ? JSON.parse(adjustment.before_params) : null,
      after_params: adjustment.after_params ? JSON.parse(adjustment.after_params) : null
    };

    res.json({ task: updatedTask, adjustment: responseAdjustment });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '参数调整失败' });
  }
});

router.delete('/:taskId', async (req: Request, res: Response) => {
  try {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    simulationEngine.stopTask(task.id);
    db.run('DELETE FROM tasks WHERE id = ?', [req.params.taskId]);

    res.json({ message: '任务已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除任务失败' });
  }
});

export { router as taskRoutes };

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';
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
    
    let filteredTasks = db.getAll('tasks');
    if (batchId) {
      filteredTasks = filteredTasks.filter((t: any) => t.batchId === batchId);
    }
    if (status) {
      filteredTasks = filteredTasks.filter((t: any) => t.status === status);
    }

    filteredTasks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filteredTasks.length;
    const start = (Number(page) - 1) * Number(limit);
    const tasks = filteredTasks.slice(start, start + Number(limit));

    const tasksWithRelations = tasks.map((task: any) => ({
      ...task,
      warnings: db.find('warnings', (w: any) => w.taskId === task.id),
      approvals: db.find('approvals', (a: any) => a.taskId === task.id),
      adjustments: db.find('adjustments', (a: any) => a.taskId === task.id)
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
    const task = db.findOne('tasks', (t: any) => t.id === req.params.taskId);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const taskWithRelations = {
      ...task,
      warnings: db.find('warnings', (w: any) => w.taskId === task.id),
      approvals: db.find('approvals', (a: any) => a.taskId === task.id),
      adjustments: db.find('adjustments', (a: any) => a.taskId === task.id)
    };

    res.json(taskWithRelations);
  } catch (error) {
    res.status(500).json({ error: '获取任务详情失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, batchId, parameters } = req.body;

    let batch = db.findOne('batches', (b: any) => b.id === batchId);
    if (!batch) {
      batch = db.create('batches', {
        id: batchId || uuidv4(),
        name: `批次-${new Date().toLocaleDateString()}`,
        status: 'active',
        taskCount: 0,
        completedCount: 0,
        nonuniformCount: 0,
        createdAt: new Date()
      });
    }

    if (batch.status === 'paused') {
      return res.status(400).json({ error: '该批次已暂停，无法创建新任务' });
    }

    const task = db.create('tasks', {
      id: uuidv4(),
      name,
      batchId: batch.id,
      status: 'pending',
      progress: 0,
      parameters: parameters || {
        rf_power: 800,
        bias_power: 200,
        pressure: 50,
        gas_ratio: { Ar: 40, CF4: 30, O2: 30 },
        temperature: 25,
        time: 300
      },
      adjustCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    db.update('batches', (b: any) => b.id === batch.id, {
      taskCount: (batch.taskCount || 0) + 1
    });

    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建任务失败' });
  }
});

router.post('/:taskId/upload', upload.single('maskFile'), async (req: Request, res: Response) => {
  try {
    const task = db.findOne('tasks', (t: any) => t.id === req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const maskData = parseMaskFile(req.file.path);

    const updatedTask = db.update('tasks', (t: any) => t.id === req.params.taskId, {
      maskFile: req.file.filename,
      maskData
    });

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
    const task = db.findOne('tasks', (t: any) => t.id === req.params.taskId);
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
    const task = db.findOne('tasks', (t: any) => t.id === req.params.taskId);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const updatedTask = db.update('tasks', (t: any) => t.id === req.params.taskId, {
      status: status as TaskStatus,
      updatedAt: new Date()
    });

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: '更新任务状态失败' });
  }
});

router.get('/:taskId/metrics', async (req: Request, res: Response) => {
  try {
    const task = db.findOne('tasks', (t: any) => t.id === req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    res.json({
      status: task.status,
      progress: task.progress,
      metrics: task.realtimeMetrics || [],
      result: task.result
    });
  } catch (error) {
    res.status(500).json({ error: '获取监控数据失败' });
  }
});

router.post('/:taskId/adjust', async (req: Request, res: Response) => {
  try {
    const { parameters, reason, adjustedBy } = req.body;
    const task = db.findOne('tasks', (t: any) => t.id === req.params.taskId);

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const adjustment = db.create('adjustments', {
      id: uuidv4(),
      taskId: task.id,
      beforeParams: task.parameters,
      afterParams: { ...task.parameters, ...parameters },
      reason,
      adjustedBy: adjustedBy || 'system',
      createdAt: new Date()
    });

    const updatedTask = await simulationEngine.adjustParameters(
      task.id,
      parameters,
      reason,
      adjustedBy || 'system'
    );

    res.json({ task: updatedTask, adjustment });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '参数调整失败' });
  }
});

router.delete('/:taskId', async (req: Request, res: Response) => {
  try {
    const task = db.findOne('tasks', (t: any) => t.id === req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    simulationEngine.stopTask(task.id);
    db.remove('tasks', (t: any) => t.id === req.params.taskId);

    res.json({ message: '任务已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除任务失败' });
  }
});

export { router as taskRoutes };

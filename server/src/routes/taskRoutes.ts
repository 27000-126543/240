import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppDataSource } from '../data-source';
import { Task } from '../entities/Task';
import { Batch } from '../entities/Batch';
import { ParamAdjustment } from '../entities/ParamAdjustment';
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

const taskRepository = AppDataSource.getRepository(Task);
const batchRepository = AppDataSource.getRepository(Batch);
const adjustmentRepository = AppDataSource.getRepository(ParamAdjustment);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { batchId, status, page = 1, limit = 20 } = req.query;
    
    const where: any = {};
    if (batchId) where.batchId = batchId;
    if (status) where.status = status;

    const [tasks, total] = await taskRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      relations: ['warnings', 'approvals', 'adjustments']
    });

    res.json({
      data: tasks,
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
    const task = await taskRepository.findOne({
      where: { id: req.params.taskId },
      relations: ['warnings', 'approvals', 'adjustments']
    });

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: '获取任务详情失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, batchId, parameters } = req.body;

    let batch = await batchRepository.findOne({ where: { id: batchId } });
    if (!batch) {
      batch = batchRepository.create({
        id: batchId || uuidv4(),
        name: `批次-${new Date().toLocaleDateString()}`,
        status: 'active',
        taskCount: 0
      });
      await batchRepository.save(batch);
    }

    if (batch.status === 'paused') {
      return res.status(400).json({ error: '该批次已暂停，无法创建新任务' });
    }

    const task = taskRepository.create({
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
      adjustCount: 0
    });

    await taskRepository.save(task);

    batch.taskCount = (batch.taskCount || 0) + 1;
    await batchRepository.save(batch);

    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建任务失败' });
  }
});

router.post('/:taskId/upload', upload.single('maskFile'), async (req: Request, res: Response) => {
  try {
    const task = await taskRepository.findOne({ where: { id: req.params.taskId } });
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    if (!req.file) {
      return res.status(400).json({ error: '未上传文件' });
    }

    const maskData = parseMaskFile(req.file.path);

    task.maskFile = req.file.filename;
    task.maskData = maskData;
    await taskRepository.save(task);

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
    const task = await taskRepository.findOne({ where: { id: req.params.taskId } });
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
    const task = await taskRepository.findOne({ where: { id: req.params.taskId } });

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    task.status = status as TaskStatus;
    await taskRepository.save(task);

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: '更新任务状态失败' });
  }
});

router.get('/:taskId/metrics', async (req: Request, res: Response) => {
  try {
    const task = await taskRepository.findOne({ where: { id: req.params.taskId } });
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
    const task = await taskRepository.findOne({ where: { id: req.params.taskId } });

    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const adjustment = adjustmentRepository.create({
      id: uuidv4(),
      taskId: task.id,
      beforeParams: task.parameters,
      afterParams: { ...task.parameters, ...parameters },
      reason,
      adjustedBy: adjustedBy || 'system'
    });
    await adjustmentRepository.save(adjustment);

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
    const task = await taskRepository.findOne({ where: { id: req.params.taskId } });
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    simulationEngine.stopTask(task.id);
    await taskRepository.remove(task);

    res.json({ message: '任务已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除任务失败' });
  }
});

export { router as taskRoutes };

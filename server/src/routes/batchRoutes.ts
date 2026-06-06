import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../data-source';
import { Batch } from '../entities/Batch';
import { Task } from '../entities/Task';

const router = Router();

const batchRepository = AppDataSource.getRepository(Batch);
const taskRepository = AppDataSource.getRepository(Task);

router.get('/', async (req: Request, res: Response) => {
  try {
    const batches = await batchRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['tasks']
    });

    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: '获取批次列表失败' });
  }
});

router.get('/:batchId', async (req: Request, res: Response) => {
  try {
    const batch = await batchRepository.findOne({
      where: { id: req.params.batchId },
      relations: ['tasks']
    });

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    res.json(batch);
  } catch (error) {
    res.status(500).json({ error: '获取批次详情失败' });
  }
});

router.get('/:batchId/tasks', async (req: Request, res: Response) => {
  try {
    const tasks = await taskRepository.find({
      where: { batchId: req.params.batchId },
      order: { createdAt: 'DESC' },
      relations: ['warnings', 'approvals']
    });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: '获取批次任务失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    const batch = batchRepository.create({
      id: uuidv4(),
      name: name || `批次-${new Date().toLocaleDateString()}`,
      status: 'active',
      nonuniformCount: 0,
      taskCount: 0,
      completedCount: 0
    });

    await batchRepository.save(batch);
    res.status(201).json(batch);
  } catch (error) {
    res.status(500).json({ error: '创建批次失败' });
  }
});

router.put('/:batchId/pause', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const batch = await batchRepository.findOne({ where: { id: req.params.batchId } });

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    batch.status = 'paused';
    batch.pauseReason = reason || '手动暂停';
    await batchRepository.save(batch);

    res.json({ message: '批次已暂停', batch });
  } catch (error) {
    res.status(500).json({ error: '暂停批次失败' });
  }
});

router.put('/:batchId/resume', async (req: Request, res: Response) => {
  try {
    const batch = await batchRepository.findOne({ where: { id: req.params.batchId } });

    if (!batch) {
      return res.status(404).json({ error: '批次不存在' });
    }

    batch.status = 'active';
    batch.pauseReason = null as any;
    batch.nonuniformCount = 0;
    await batchRepository.save(batch);

    res.json({ message: '批次已恢复', batch });
  } catch (error) {
    res.status(500).json({ error: '恢复批次失败' });
  }
});

export { router as batchRoutes };

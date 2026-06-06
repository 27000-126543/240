import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, level, taskId } = req.query;
    
    let approvals = db.getAll('approvals');
    if (status) {
      approvals = approvals.filter((a: any) => a.status === status);
    }
    if (level) {
      approvals = approvals.filter((a: any) => a.level === level);
    }
    if (taskId) {
      approvals = approvals.filter((a: any) => a.taskId === taskId);
    }

    approvals.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const approvalsWithTask = approvals.map((approval: any) => ({
      ...approval,
      task: db.findOne('tasks', (t: any) => t.id === approval.taskId)
    }));

    res.json(approvalsWithTask);
  } catch (error) {
    res.status(500).json({ error: '获取审批列表失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { taskId, level, approver } = req.body;

    const task = db.findOne('tasks', (t: any) => t.id === taskId);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const approval = db.create('approvals', {
      id: uuidv4(),
      taskId,
      level,
      approver,
      status: 'pending',
      createdAt: new Date()
    });

    res.status(201).json(approval);
  } catch (error) {
    res.status(500).json({ error: '创建审批失败' });
  }
});

router.put('/:approvalId/decide', async (req: Request, res: Response) => {
  try {
    const { status, comment } = req.body;
    const approval = db.findOne('approvals', (a: any) => a.id === req.params.approvalId);

    if (!approval) {
      return res.status(404).json({ error: '审批不存在' });
    }

    const updatedApproval = db.update('approvals', (a: any) => a.id === req.params.approvalId, {
      status,
      comment: comment || '',
      decidedAt: new Date()
    });

    if (status === 'approved' && approval.level === 'engineer') {
      db.create('approvals', {
        id: uuidv4(),
        taskId: approval.taskId,
        level: 'manager',
        approver: 'system',
        status: 'pending',
        createdAt: new Date()
      });
    }

    if (status === 'approved' && approval.level === 'manager') {
      console.log(`任务 ${approval.taskId} 已通过两级审批，准备推送至量产系统`);
    }

    const approvalWithTask = {
      ...updatedApproval,
      task: db.findOne('tasks', (t: any) => t.id === approval.taskId)
    };

    res.json({ message: '审批已处理', approval: approvalWithTask });
  } catch (error) {
    res.status(500).json({ error: '处理审批失败' });
  }
});

router.post('/:approvalId/submit-engineer', async (req: Request, res: Response) => {
  try {
    const { approver, comment } = req.body;
    const approval = db.findOne('approvals', (a: any) => a.id === req.params.approvalId);

    if (!approval) {
      return res.status(404).json({ error: '审批不存在' });
    }

    const updatedApproval = db.update('approvals', (a: any) => a.id === req.params.approvalId, {
      status: 'approved',
      comment: comment || '均匀性验证通过',
      decidedAt: new Date(),
      approver: approver || 'engineer'
    });

    const managerApproval = db.create('approvals', {
      id: uuidv4(),
      taskId: approval.taskId,
      level: 'manager',
      approver: 'pending',
      status: 'pending',
      createdAt: new Date()
    });

    const approvalWithTask = {
      ...updatedApproval,
      task: db.findOne('tasks', (t: any) => t.id === approval.taskId)
    };

    res.json({ 
      message: '工艺工程师验证通过，已提交技术经理审批', 
      approval: approvalWithTask,
      managerApproval
    });
  } catch (error) {
    res.status(500).json({ error: '提交审批失败' });
  }
});

export { router as approvalRoutes };

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/sqlite';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, level, taskId } = req.query;
    
    let sql = 'SELECT * FROM approvals WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (level) {
      sql += ' AND level = ?';
      params.push(level);
    }
    if (taskId) {
      sql += ' AND task_id = ?';
      params.push(taskId);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const approvals = db.all(sql, params);

    const approvalsWithTask = approvals.map((approval: any) => ({
      ...approval,
      task: db.get('SELECT * FROM tasks WHERE id = ?', [approval.task_id])
    }));

    res.json(approvalsWithTask);
  } catch (error) {
    res.status(500).json({ error: '获取审批列表失败' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { taskId, level, approver } = req.body;

    const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      return res.status(404).json({ error: '任务不存在' });
    }

    const approvalId = uuidv4();
    db.run(`
      INSERT INTO approvals (id, task_id, level, approver, status, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [approvalId, taskId, level, approver, 'pending']);

    const approval = db.get('SELECT * FROM approvals WHERE id = ?', [approvalId]);

    res.status(201).json(approval);
  } catch (error) {
    res.status(500).json({ error: '创建审批失败' });
  }
});

router.put('/:approvalId/decide', async (req: Request, res: Response) => {
  try {
    const { status, comment } = req.body;
    const approval = db.get('SELECT * FROM approvals WHERE id = ?', [req.params.approvalId]);

    if (!approval) {
      return res.status(404).json({ error: '审批不存在' });
    }

    db.run(`
      UPDATE approvals 
      SET status = ?, comment = ?, decided_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, comment || '', req.params.approvalId]);

    if (status === 'approved' && approval.level === 'engineer') {
      const managerApprovalId = uuidv4();
      db.run(`
        INSERT INTO approvals (id, task_id, level, approver, status, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [managerApprovalId, approval.task_id, 'manager', 'system', 'pending']);
    }

    if (status === 'approved' && approval.level === 'manager') {
      console.log(`任务 ${approval.task_id} 已通过两级审批，准备推送至量产系统`);
    }

    const updatedApproval = db.get('SELECT * FROM approvals WHERE id = ?', [req.params.approvalId]);
    const approvalWithTask = {
      ...updatedApproval,
      task: db.get('SELECT * FROM tasks WHERE id = ?', [approval.task_id])
    };

    res.json({ message: '审批已处理', approval: approvalWithTask });
  } catch (error) {
    res.status(500).json({ error: '处理审批失败' });
  }
});

router.post('/:approvalId/submit-engineer', async (req: Request, res: Response) => {
  try {
    const { approver, comment } = req.body;
    const approval = db.get('SELECT * FROM approvals WHERE id = ?', [req.params.approvalId]);

    if (!approval) {
      return res.status(404).json({ error: '审批不存在' });
    }

    db.run(`
      UPDATE approvals 
      SET status = ?, comment = ?, decided_at = CURRENT_TIMESTAMP, approver = ?
      WHERE id = ?
    `, ['approved', comment || '均匀性验证通过', approver || 'engineer', req.params.approvalId]);

    const managerApprovalId = uuidv4();
    db.run(`
      INSERT INTO approvals (id, task_id, level, approver, status, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [managerApprovalId, approval.task_id, 'manager', 'pending', 'pending']);

    const updatedApproval = db.get('SELECT * FROM approvals WHERE id = ?', [req.params.approvalId]);
    const managerApproval = db.get('SELECT * FROM approvals WHERE id = ?', [managerApprovalId]);
    
    const approvalWithTask = {
      ...updatedApproval,
      task: db.get('SELECT * FROM tasks WHERE id = ?', [approval.task_id])
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

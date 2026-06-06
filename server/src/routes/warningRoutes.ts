import { Router, Request, Response } from 'express';
import { db } from '../db/sqlite';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { acknowledged, taskId, type } = req.query;
    
    let sql = 'SELECT * FROM warnings WHERE 1=1';
    const params: any[] = [];
    
    if (acknowledged !== undefined) {
      sql += ' AND acknowledged = ?';
      params.push(acknowledged === 'true' ? 1 : 0);
    }
    if (taskId) {
      sql += ' AND task_id = ?';
      params.push(taskId);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const warnings = db.all(sql, params);

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

router.get('/:warningId', async (req: Request, res: Response) => {
  try {
    const warning = db.get('SELECT * FROM warnings WHERE id = ?', [req.params.warningId]);

    if (!warning) {
      return res.status(404).json({ error: '预警不存在' });
    }

    const warningWithTask = {
      ...warning,
      acknowledged: warning.acknowledged === 1,
      task: db.get('SELECT * FROM tasks WHERE id = ?', [warning.task_id])
    };

    res.json(warningWithTask);
  } catch (error) {
    res.status(500).json({ error: '获取预警详情失败' });
  }
});

router.put('/:warningId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { acknowledgedBy, ackComment } = req.body;
    const warning = db.get('SELECT * FROM warnings WHERE id = ?', [req.params.warningId]);

    if (!warning) {
      return res.status(404).json({ error: '预警不存在' });
    }

    db.run(`
      UPDATE warnings 
      SET acknowledged = 1, acknowledged_by = ?, ack_comment = ?
      WHERE id = ?
    `, [acknowledgedBy || 'engineer', ackComment || '', req.params.warningId]);

    const updatedWarning = db.get('SELECT * FROM warnings WHERE id = ?', [req.params.warningId]);
    const responseWarning = {
      ...updatedWarning,
      acknowledged: updatedWarning.acknowledged === 1
    };

    res.json({ message: '预警已确认', warning: responseWarning });
  } catch (error) {
    res.status(500).json({ error: '确认预警失败' });
  }
});

export { router as warningRoutes };

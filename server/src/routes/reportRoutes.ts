import { Router, Request, Response } from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/sqlite';
import { reportGenerator } from '../services/reportGenerator';

const router = Router();

router.get('/:taskId/pdf', async (req: Request, res: Response) => {
  try {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    if (!task || !task.result) {
      return res.status(404).json({ error: '任务不存在或未完成' });
    }

    const pdfBuffer = await reportGenerator.generateReport(req.params.taskId);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report_${task.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '生成PDF报告失败' });
  }
});

router.get('/:taskId/export', async (req: Request, res: Response) => {
  try {
    const { format = 'csv', dimension = 'bias' } = req.query;
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [req.params.taskId]);
    
    if (!task || !task.result) {
      return res.status(404).json({ error: '任务不存在或未完成' });
    }

    const taskWithParsedData = {
      ...task,
      parameters: task.parameters ? JSON.parse(task.parameters) : null,
      result: task.result ? JSON.parse(task.result) : null
    };

    const records = generateExportData(taskWithParsedData, String(dimension));

    if (format === 'csv') {
      const exportDir = path.join(__dirname, '../../exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const csvWriter = createObjectCsvWriter({
        path: path.join(exportDir, `task_${task.id}.csv`),
        header: Object.keys(records[0]).map(key => ({ id: key, title: key }))
      });

      await csvWriter.writeRecords(records);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${task.id}.csv"`);
      fs.createReadStream(path.join(exportDir, `task_${task.id}.csv`)).pipe(res);
    } else {
      res.json(records);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '导出数据失败' });
  }
});

function calculateStats(arr: number[]) {
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(arr.reduce((a, b) => a + (b - avg) ** 2, 0) / arr.length);
  return { max, min, avg, std };
}

function generateExportData(task: any, dimension: string) {
  if (!task.result) return [];
  
  const baseParams = task.parameters;
  const records = [];

  for (let i = 0; i < task.result.rate_distribution.length; i++) {
    const record: any = {
      position: i,
      etch_rate: task.result.rate_distribution[i].toFixed(2),
      rf_power: baseParams.rf_power,
      bias_power: baseParams.bias_power,
      pressure: baseParams.pressure,
      Ar_ratio: baseParams.gas_ratio.Ar,
      CF4_ratio: baseParams.gas_ratio.CF4,
      O2_ratio: baseParams.gas_ratio.O2,
    };
    
    if (dimension === 'bias') {
      record.bias_variation = (baseParams.bias_power * (0.8 + i * 0.01)).toFixed(0);
    } else if (dimension === 'pressure') {
      record.pressure_variation = (baseParams.pressure * (0.8 + i * 0.01)).toFixed(1);
    } else if (dimension === 'gas') {
      record.CF4_variation = (baseParams.gas_ratio.CF4 * (0.7 + i * 0.01)).toFixed(1);
    }
    
    records.push(record);
  }

  return records;
}

export { router as reportRoutes };

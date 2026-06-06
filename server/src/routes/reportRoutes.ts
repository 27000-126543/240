import { Router, Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';

const router = Router();

router.get('/:taskId/pdf', async (req: Request, res: Response) => {
  try {
    const task = db.findOne('tasks', (t: any) => t.id === req.params.taskId);
    if (!task || !task.result) {
      return res.status(404).json({ error: '任务不存在或未完成' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report_${task.id}.pdf"`);
    
    doc.pipe(res);

    doc.fontSize(20).fillColor('#0ea5e9').text('等离子体刻蚀模拟报告', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(14).fillColor('#334155').text(`任务名称: ${task.name}`);
    doc.text(`任务ID: ${task.id}`);
    doc.text(`完成时间: ${task.completedAt ? new Date(task.completedAt).toLocaleString() : '-'}`);
    doc.moveDown();

    doc.fontSize(16).fillColor('#0ea5e9').text('一、工艺参数');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#475569');
    doc.text(`射频功率: ${task.parameters.rf_power} W`);
    doc.text(`偏压功率: ${task.parameters.bias_power} W`);
    doc.text(`工作气压: ${task.parameters.pressure} mTorr`);
    doc.text(`气体比例 - Ar: ${task.parameters.gas_ratio.Ar}%, CF4: ${task.parameters.gas_ratio.CF4}%, O2: ${task.parameters.gas_ratio.O2}%`);
    doc.text(`温度: ${task.parameters.temperature} °C`);
    doc.text(`刻蚀时间: ${task.parameters.time} s`);
    doc.moveDown();

    doc.fontSize(16).fillColor('#0ea5e9').text('二、模拟结果');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#475569');
    doc.text(`刻蚀剖面角度: ${task.result.profile_angle.toFixed(2)}°`);
    doc.text(`刻蚀选择性: ${task.result.selectivity.toFixed(2)}`);
    doc.text(`刻蚀均匀性: ${task.result.uniformity.toFixed(2)}%`);
    doc.text(`刻蚀深度: ${task.result.etch_depth.toFixed(2)} nm`);
    doc.text(`刻蚀速率: ${task.result.etch_rate.toFixed(2)} nm/min`);
    doc.moveDown();

    doc.fontSize(16).fillColor('#0ea5e9').text('三、速率分布');
    doc.moveDown(0.5);
    const rateStats = calculateStats(task.result.rate_distribution);
    doc.fontSize(11).fillColor('#475569');
    doc.text(`最大速率: ${rateStats.max.toFixed(2)} nm/min`);
    doc.text(`最小速率: ${rateStats.min.toFixed(2)} nm/min`);
    doc.text(`平均速率: ${rateStats.avg.toFixed(2)} nm/min`);
    doc.text(`标准差: ${rateStats.std.toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(16).fillColor('#0ea5e9').text('四、表面粗糙度');
    doc.moveDown(0.5);
    const roughnessStats = calculateStats(task.result.roughness_curve);
    doc.fontSize(11).fillColor('#475569');
    doc.text(`平均粗糙度 (Ra): ${roughnessStats.avg.toFixed(3)} nm`);
    doc.text(`最大粗糙度 (Rmax): ${roughnessStats.max.toFixed(3)} nm`);
    doc.moveDown();

    doc.fontSize(10).fillColor('#94a3b8').text('报告生成时间: ' + new Date().toLocaleString(), { align: 'center' });
    
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '生成PDF报告失败' });
  }
});

router.get('/:taskId/export', async (req: Request, res: Response) => {
  try {
    const { format = 'csv', dimension = 'bias' } = req.query;
    const task = db.findOne('tasks', (t: any) => t.id === req.params.taskId);
    
    if (!task || !task.result) {
      return res.status(404).json({ error: '任务不存在或未完成' });
    }

    const records = generateExportData(task, String(dimension));

    if (format === 'csv') {
      const csvWriter = createObjectCsvWriter({
        path: path.join(__dirname, `../../exports/task_${task.id}.csv`),
        header: Object.keys(records[0]).map(key => ({ id: key, title: key }))
      });

      await csvWriter.writeRecords(records);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${task.id}.csv"`);
      fs.createReadStream(path.join(__dirname, `../../exports/task_${task.id}.csv`)).pipe(res);
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

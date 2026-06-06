import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    let recommendations = db.getAll('recommendations');
    recommendations.sort((a: any, b: any) => b.score - a.score);
    recommendations = recommendations.slice(0, 10);

    if (recommendations.length === 0) {
      const defaultRecs = generateDefaultRecommendations();
      for (const rec of defaultRecs) {
        const recommendation = db.create('recommendations', rec);
        recommendations.push(recommendation);
      }
    }

    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: '获取推荐失败' });
  }
});

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const completedTasks = db.find('tasks', (t: any) => t.status === 'completed');

    const recommendations = generateRecommendations(completedTasks);
    
    for (const rec of recommendations) {
      const existing = db.findOne('recommendations', (r: any) => r.name === rec.name);
      if (!existing) {
        db.create('recommendations', rec);
      }
    }

    res.json({ message: '推荐已生成', count: recommendations.length });
  } catch (error) {
    res.status(500).json({ error: '生成推荐失败' });
  }
});

router.post('/:recId/apply', async (req: Request, res: Response) => {
  try {
    const recommendation = db.findOne('recommendations', (r: any) => r.id === req.params.recId);

    if (!recommendation) {
      return res.status(404).json({ error: '推荐不存在' });
    }

    const updatedRecommendation = db.update('recommendations', (r: any) => r.id === req.params.recId, {
      usageCount: (recommendation.usageCount || 0) + 1
    });

    res.json({ 
      message: '参数方案已应用', 
      parameters: recommendation.parameters 
    });
  } catch (error) {
    res.status(500).json({ error: '应用推荐失败' });
  }
});

function generateDefaultRecommendations(): any[] {
  return [
    {
      id: uuidv4(),
      name: '高精度刻蚀方案',
      parameters: {
        rf_power: 600,
        bias_power: 150,
        pressure: 30,
        gas_ratio: { Ar: 50, CF4: 35, O2: 15 },
        temperature: 20,
        time: 400
      },
      score: 92.5,
      predictedAngle: 89.8,
      predictedSelectivity: 18.5,
      predictedUniformity: 97.2,
      usageCount: 0,
      适用场景: ['高深宽比结构', '关键层刻蚀', '高精度要求'],
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: '高选择比方案',
      parameters: {
        rf_power: 800,
        bias_power: 100,
        pressure: 50,
        gas_ratio: { Ar: 40, CF4: 45, O2: 15 },
        temperature: 25,
        time: 350
      },
      score: 88.3,
      predictedAngle: 88.5,
      predictedSelectivity: 22.0,
      predictedUniformity: 94.8,
      usageCount: 0,
      适用场景: ['掩模选择比要求高', '多层堆叠结构', '介质层刻蚀'],
      createdAt: new Date()
    },
    {
      id: uuidv4(),
      name: '高速量产方案',
      parameters: {
        rf_power: 1200,
        bias_power: 300,
        pressure: 80,
        gas_ratio: { Ar: 60, CF4: 25, O2: 15 },
        temperature: 30,
        time: 200
      },
      score: 85.0,
      predictedAngle: 87.2,
      predictedSelectivity: 12.5,
      predictedUniformity: 93.5,
      usageCount: 0,
      适用场景: ['量产线优化', '非关键层刻蚀', '高吞吐量要求'],
      createdAt: new Date()
    }
  ];
}

function generateRecommendations(tasks: any[]): any[] {
  if (tasks.length < 5) {
    return generateDefaultRecommendations();
  }

  const goodTasks = tasks.filter(t => t.result && t.result.uniformity >= 95);
  
  if (goodTasks.length === 0) {
    return generateDefaultRecommendations();
  }

  const avgParams = {
    rf_power: 0,
    bias_power: 0,
    pressure: 0,
    gas_ratio: { Ar: 0, CF4: 0, O2: 0 },
    temperature: 0,
    time: 0
  };

  goodTasks.forEach(t => {
    avgParams.rf_power += t.parameters.rf_power;
    avgParams.bias_power += t.parameters.bias_power;
    avgParams.pressure += t.parameters.pressure;
    avgParams.gas_ratio.Ar += t.parameters.gas_ratio.Ar;
    avgParams.gas_ratio.CF4 += t.parameters.gas_ratio.CF4;
    avgParams.gas_ratio.O2 += t.parameters.gas_ratio.O2;
    avgParams.temperature += t.parameters.temperature;
    avgParams.time += t.parameters.time;
  });

  const count = goodTasks.length;
  avgParams.rf_power = Math.round(avgParams.rf_power / count);
  avgParams.bias_power = Math.round(avgParams.bias_power / count);
  avgParams.pressure = Math.round(avgParams.pressure / count);
  avgParams.gas_ratio.Ar = Math.round(avgParams.gas_ratio.Ar / count);
  avgParams.gas_ratio.CF4 = Math.round(avgParams.gas_ratio.CF4 / count);
  avgParams.gas_ratio.O2 = Math.round(avgParams.gas_ratio.O2 / count);
  avgParams.temperature = Math.round(avgParams.temperature / count);
  avgParams.time = Math.round(avgParams.time / count);

  const avgAngle = goodTasks.reduce((s, t) => s + (t.result?.profile_angle || 0), 0) / count;
  const avgSelectivity = goodTasks.reduce((s, t) => s + (t.result?.selectivity || 0), 0) / count;
  const avgUniformity = goodTasks.reduce((s, t) => s + (t.result?.uniformity || 0), 0) / count;
  const score = (avgUniformity * 0.5 + avgSelectivity * 2 + (90 - Math.abs(avgAngle - 90)) * 2) / 3;

  return [
    {
      id: uuidv4(),
      name: '历史数据优化方案',
      parameters: avgParams,
      score: Math.min(95, score),
      predictedAngle: avgAngle,
      predictedSelectivity: avgSelectivity,
      predictedUniformity: avgUniformity,
      usageCount: 0,
      适用场景: ['基于历史数据优化', '常规工艺调优'],
      createdAt: new Date()
    }
  ];
}

export { router as recommendationRoutes };

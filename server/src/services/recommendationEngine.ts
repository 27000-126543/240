import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/sqlite';
import { ProcessParams } from '../types';
import { physicsEngine } from './physicsEngine';

interface ScoredTask {
  taskId: string;
  params: ProcessParams;
  score: number;
  uniformity: number;
  selectivity: number;
  angle: number;
}

interface PresetScheme {
  name: string;
  description: string;
  params: ProcessParams;
  scenarios: string[];
}

class RecommendationEngine {
  private readonly PRESET_SCHEMES: PresetScheme[] = [
    {
      name: '高精度方案',
      description: '追求最高的剖面角度精度和均匀性',
      params: {
        rf_power: 400,
        bias_power: 200,
        pressure: 10,
        gas_ratio: { Ar: 40, CF4: 40, O2: 20 },
        temperature: 25,
        time: 120
      },
      scenarios: ['高精度刻蚀', '关键尺寸控制', '深宽比>5:1']
    },
    {
      name: '高选择比方案',
      description: '最大化掩模与衬底的刻蚀选择比',
      params: {
        rf_power: 600,
        bias_power: 150,
        pressure: 20,
        gas_ratio: { Ar: 30, CF4: 50, O2: 20 },
        temperature: 30,
        time: 100
      },
      scenarios: ['掩模保护', '多层膜刻蚀', '浅槽隔离']
    },
    {
      name: '高速量产方案',
      description: '追求高刻蚀速率，适用于大批量生产',
      params: {
        rf_power: 800,
        bias_power: 300,
        pressure: 30,
        gas_ratio: { Ar: 50, CF4: 35, O2: 15 },
        temperature: 40,
        time: 60
      },
      scenarios: ['大批量生产', '厚膜刻蚀', '成本优化']
    }
  ];

  calculateTaskScore(uniformity: number, selectivity: number, angle: number): number {
    return 0.4 * uniformity + 0.3 * selectivity + 0.3 * (90 - Math.abs(angle - 90));
  }

  private getAllCompletedTasks(): ScoredTask[] {
    const tasks = db.all("SELECT * FROM tasks WHERE status = ? AND result IS NOT NULL", ['completed']);
    
    return tasks
      .filter(task => {
        try {
          const result = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
          const params = typeof task.parameters === 'string' ? JSON.parse(task.parameters) : task.parameters;
          return result && params && result.uniformity && result.selectivity && result.profile_angle;
        } catch {
          return false;
        }
      })
      .map(task => {
        const result = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;
        const params = typeof task.parameters === 'string' ? JSON.parse(task.parameters) : task.parameters;
        const score = this.calculateTaskScore(result.uniformity, result.selectivity, result.profile_angle);
        
        return {
          taskId: task.id,
          params,
          score,
          uniformity: result.uniformity,
          selectivity: result.selectivity,
          angle: result.profile_angle
        };
      });
  }

  generateWeightedRecommendation(scoredTasks: ScoredTask[]): ProcessParams {
    if (scoredTasks.length === 0) {
      return this.PRESET_SCHEMES[0].params;
    }

    const totalScore = scoredTasks.reduce((sum, t) => sum + t.score, 0);
    if (totalScore === 0) {
      return this.PRESET_SCHEMES[0].params;
    }

    const weightedParams: ProcessParams = {
      rf_power: 0,
      bias_power: 0,
      pressure: 0,
      gas_ratio: { Ar: 0, CF4: 0, O2: 0 },
      temperature: 0,
      time: 0
    };

    scoredTasks.forEach(task => {
      const weight = task.score / totalScore;
      weightedParams.rf_power += task.params.rf_power * weight;
      weightedParams.bias_power += task.params.bias_power * weight;
      weightedParams.pressure += task.params.pressure * weight;
      weightedParams.gas_ratio.Ar += task.params.gas_ratio.Ar * weight;
      weightedParams.gas_ratio.CF4 += task.params.gas_ratio.CF4 * weight;
      weightedParams.gas_ratio.O2 += task.params.gas_ratio.O2 * weight;
      weightedParams.temperature += task.params.temperature * weight;
      weightedParams.time += task.params.time * weight;
    });

    return {
      rf_power: Math.round(weightedParams.rf_power),
      bias_power: Math.round(weightedParams.bias_power),
      pressure: Math.round(weightedParams.pressure),
      gas_ratio: {
        Ar: Math.round(weightedParams.gas_ratio.Ar),
        CF4: Math.round(weightedParams.gas_ratio.CF4),
        O2: Math.round(weightedParams.gas_ratio.O2)
      },
      temperature: Math.round(weightedParams.temperature),
      time: Math.round(weightedParams.time)
    };
  }

  collaborativeFiltering(
    targetParams: Partial<ProcessParams>,
    scoredTasks: ScoredTask[],
    topK: number = 5
  ): ProcessParams {
    if (scoredTasks.length === 0) {
      return this.PRESET_SCHEMES[0].params;
    }

    const similarities = scoredTasks.map(task => {
      const similarity = this.calculateParamsSimilarity(targetParams, task.params);
      return { ...task, similarity };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topTasks = similarities.slice(0, Math.min(topK, similarities.length));

    return this.generateWeightedRecommendation(
      topTasks.map(t => ({
        taskId: t.taskId,
        params: t.params,
        score: t.score * t.similarity,
        uniformity: t.uniformity,
        selectivity: t.selectivity,
        angle: t.angle
      }))
    );
  }

  private calculateParamsSimilarity(params1: Partial<ProcessParams>, params2: ProcessParams): number {
    let similarity = 0;
    let count = 0;

    if (params1.rf_power !== undefined) {
      similarity += 1 - Math.abs(params1.rf_power - params2.rf_power) / 1000;
      count++;
    }
    if (params1.bias_power !== undefined) {
      similarity += 1 - Math.abs(params1.bias_power - params2.bias_power) / 500;
      count++;
    }
    if (params1.pressure !== undefined) {
      similarity += 1 - Math.abs(params1.pressure - params2.pressure) / 100;
      count++;
    }
    if (params1.temperature !== undefined) {
      similarity += 1 - Math.abs(params1.temperature - params2.temperature) / 100;
      count++;
    }

    return count > 0 ? similarity / count : 0.5;
  }

  getPresetSchemes(): PresetScheme[] {
    return this.PRESET_SCHEMES;
  }

  async generateRecommendations(): Promise<any[]> {
    const scoredTasks = this.getAllCompletedTasks();
    const recommendations: any[] = [];

    for (const scheme of this.PRESET_SCHEMES) {
      const plasma = physicsEngine.calculatePlasmaState(scheme.params);
      const metrics = physicsEngine.calculateAllMetrics(scheme.params, 100, scheme.params.time);
      const score = this.calculateTaskScore(metrics.uniformity, metrics.selectivity, metrics.profileAngle);

      const existing = db.get('SELECT * FROM recommendations WHERE name = ?', [scheme.name]);
      
      const recommendationData = {
        id: existing?.id || uuidv4(),
        name: scheme.name,
        parameters: JSON.stringify(scheme.params),
        score: Number(score.toFixed(2)),
        predicted_angle: Number(metrics.profileAngle.toFixed(2)),
        predicted_selectivity: Number(metrics.selectivity.toFixed(2)),
        predicted_uniformity: Number(metrics.uniformity.toFixed(2)),
        usage_count: existing?.usage_count || 0,
        scenarios: JSON.stringify(scheme.scenarios)
      };

      if (existing) {
        db.run(
          'UPDATE recommendations SET parameters = ?, score = ?, predicted_angle = ?, predicted_selectivity = ?, predicted_uniformity = ?, scenarios = ? WHERE id = ?',
          [recommendationData.parameters, recommendationData.score, recommendationData.predicted_angle, recommendationData.predicted_selectivity, recommendationData.predicted_uniformity, recommendationData.scenarios, recommendationData.id]
        );
      } else {
        db.run(
          'INSERT INTO recommendations (id, name, parameters, score, predicted_angle, predicted_selectivity, predicted_uniformity, usage_count, scenarios, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [recommendationData.id, recommendationData.name, recommendationData.parameters, recommendationData.score, recommendationData.predicted_angle, recommendationData.predicted_selectivity, recommendationData.predicted_uniformity, recommendationData.usage_count, recommendationData.scenarios]
        );
      }

      recommendations.push({
        ...recommendationData,
        parameters: scheme.params,
        scenarios: scheme.scenarios,
        description: scheme.description
      });
    }

    if (scoredTasks.length >= 3) {
      const weightedParams = this.generateWeightedRecommendation(scoredTasks);
      const plasma = physicsEngine.calculatePlasmaState(weightedParams);
      const metrics = physicsEngine.calculateAllMetrics(weightedParams, 100, weightedParams.time);
      const score = this.calculateTaskScore(metrics.uniformity, metrics.selectivity, metrics.profileAngle);

      const name = '历史数据优化方案';
      const existing = db.get('SELECT * FROM recommendations WHERE name = ?', [name]);

      const recommendationData = {
        id: existing?.id || uuidv4(),
        name,
        parameters: JSON.stringify(weightedParams),
        score: Number(score.toFixed(2)),
        predicted_angle: Number(metrics.profileAngle.toFixed(2)),
        predicted_selectivity: Number(metrics.selectivity.toFixed(2)),
        predicted_uniformity: Number(metrics.uniformity.toFixed(2)),
        usage_count: existing?.usage_count || 0,
        scenarios: JSON.stringify(['通用优化', '历史数据驱动'])
      };

      if (existing) {
        db.run(
          'UPDATE recommendations SET parameters = ?, score = ?, predicted_angle = ?, predicted_selectivity = ?, predicted_uniformity = ?, scenarios = ? WHERE id = ?',
          [recommendationData.parameters, recommendationData.score, recommendationData.predicted_angle, recommendationData.predicted_selectivity, recommendationData.predicted_uniformity, recommendationData.scenarios, recommendationData.id]
        );
      } else {
        db.run(
          'INSERT INTO recommendations (id, name, parameters, score, predicted_angle, predicted_selectivity, predicted_uniformity, usage_count, scenarios, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [recommendationData.id, recommendationData.name, recommendationData.parameters, recommendationData.score, recommendationData.predicted_angle, recommendationData.predicted_selectivity, recommendationData.predicted_uniformity, recommendationData.usage_count, recommendationData.scenarios]
        );
      }

      recommendations.push({
        ...recommendationData,
        parameters: weightedParams,
        scenarios: ['通用优化', '历史数据驱动'],
        description: '基于历史高评分任务的加权平均优化方案'
      });
    }

    return recommendations;
  }

  getRecommendations(): any[] {
    const recs = db.all('SELECT * FROM recommendations ORDER BY score DESC');
    return recs.map(r => ({
      ...r,
      parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters,
      scenarios: typeof r.scenarios === 'string' ? JSON.parse(r.scenarios) : r.scenarios
    }));
  }

  incrementUsage(recommendationId: string): void {
    const rec = db.get('SELECT * FROM recommendations WHERE id = ?', [recommendationId]);
    if (rec) {
      db.run(
        'UPDATE recommendations SET usage_count = ? WHERE id = ?',
        [(rec.usage_count || 0) + 1, recommendationId]
      );
    }
  }

  generateRecommendation(
    targetParams: Partial<ProcessParams>,
    useCollaborative: boolean = true
  ): ProcessParams {
    const scoredTasks = this.getAllCompletedTasks();

    if (scoredTasks.length < 3 || !useCollaborative) {
      return this.generateWeightedRecommendation(scoredTasks);
    }

    return this.collaborativeFiltering(targetParams, scoredTasks);
  }

  async ensureDefaultRecommendations(): Promise<void> {
    const count = db.count('SELECT COUNT(*) as count FROM recommendations');
    if (count === 0) {
      await this.generateRecommendations();
    }
  }

  getTopTasks(limit: number = 10): ScoredTask[] {
    const scoredTasks = this.getAllCompletedTasks();
    return scoredTasks
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

export const recommendationEngine = new RecommendationEngine();

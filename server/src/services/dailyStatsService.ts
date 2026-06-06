import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/sqlite';

interface ProcessCapability {
  dimension: string;
  value: number;
  fullMark: number;
}

interface DailyStatsData {
  date: string;
  completionRate: number;
  rateDeviation: number;
  optimizationCount: number;
  totalTasks: number;
  completedTasks: number;
  warningCount: number;
  approvalCount: number;
  processCapability: ProcessCapability[];
}

interface WeeklyTrend {
  date: string;
  completionRate: number;
  avgScore: number;
  totalTasks: number;
}

class DailyStatsService {
  private readonly PROCESS_DIMENSIONS = [
    { key: 'etchRateControl', name: '刻蚀速率控制' },
    { key: 'profileAngleAccuracy', name: '剖面角度精度' },
    { key: 'selectivityControl', name: '选择比控制' },
    { key: 'uniformityControl', name: '均匀性控制' },
    { key: 'roughnessControl', name: '粗糙度控制' },
    { key: 'processStability', name: '工艺稳定性' }
  ];

  async calculateDailyStats(date?: string): Promise<DailyStatsData> {
    const targetDate = date || this.formatDate(new Date());
    const startOfDay = new Date(targetDate + 'T00:00:00').toISOString();
    const endOfDay = new Date(targetDate + 'T23:59:59').toISOString();

    const tasks = db.all(
      'SELECT * FROM tasks WHERE created_at >= ? AND created_at <= ?',
      [startOfDay, endOfDay]
    );

    const completedTasks = tasks.filter(t => t.status === 'completed');
    const totalTasks = tasks.length;
    const completedCount = completedTasks.length;
    const completionRate = totalTasks > 0 ? completedCount / totalTasks : 0;

    const warnings = db.all(
      'SELECT * FROM warnings WHERE created_at >= ? AND created_at <= ?',
      [startOfDay, endOfDay]
    );
    const warningCount = warnings.length;

    const approvals = db.all(
      'SELECT * FROM approvals WHERE created_at >= ? AND created_at <= ?',
      [startOfDay, endOfDay]
    );
    const approvalCount = approvals.length;

    const adjustments = db.all(
      'SELECT * FROM adjustments WHERE created_at >= ? AND created_at <= ?',
      [startOfDay, endOfDay]
    );
    const optimizationCount = adjustments.length;

    let rateDeviation = 0;
    if (completedTasks.length > 0) {
      const etchRates = completedTasks
        .map(t => {
          try {
            const result = typeof t.result === 'string' ? JSON.parse(t.result) : t.result;
            return result?.etch_rate;
          } catch {
            return null;
          }
        })
        .filter(r => r !== null) as number[];

      if (etchRates.length > 0) {
        const avgRate = etchRates.reduce((a, b) => a + b, 0) / etchRates.length;
        const variance = etchRates.reduce((sum, rate) => sum + Math.pow(rate - avgRate, 2), 0) / etchRates.length;
        rateDeviation = Math.sqrt(variance) / avgRate * 100;
      }
    }

    const processCapability = this.calculateProcessCapability(completedTasks);

    const statsData: DailyStatsData = {
      date: targetDate,
      completionRate: Number(completionRate.toFixed(4)),
      rateDeviation: Number(rateDeviation.toFixed(2)),
      optimizationCount,
      totalTasks,
      completedTasks: completedCount,
      warningCount,
      approvalCount,
      processCapability
    };

    await this.saveStats(statsData);

    return statsData;
  }

  private calculateProcessCapability(completedTasks: any[]): ProcessCapability[] {
    const results = completedTasks
      .map(t => {
        try {
          return typeof t.result === 'string' ? JSON.parse(t.result) : t.result;
        } catch {
          return null;
        }
      })
      .filter(r => r !== null);

    if (results.length === 0) {
      return this.PROCESS_DIMENSIONS.map(d => ({
        dimension: d.name,
        value: 0,
        fullMark: 100
      }));
    }

    const etchRates = results.map(r => r.etch_rate).filter(r => r !== undefined);
    const angles = results.map(r => r.profile_angle).filter(r => r !== undefined);
    const selectivities = results.map(r => r.selectivity).filter(r => r !== undefined);
    const uniformities = results.map(r => r.uniformity).filter(r => r !== undefined);
    const roughnessList = results.map(r => {
      const curve = r.roughness_curve;
      return curve && curve.length > 0 ? curve[curve.length - 1] : null;
    }).filter(r => r !== null);

    const etchRateControl = this.calculateDimensionScore(etchRates, 100, 300, true);
    const profileAngleAccuracy = angles.length > 0
      ? 100 - angles.reduce((sum, a) => sum + Math.abs(a - 90), 0) / angles.length * 10
      : 0;
    const selectivityControl = this.calculateDimensionScore(selectivities, 10, 30, true);
    const uniformityControl = this.calculateDimensionScore(uniformities, 90, 99, true);
    const roughnessControl = roughnessList.length > 0
      ? Math.max(0, 100 - roughnessList.reduce((sum, r) => sum + r, 0) / roughnessList.length * 20)
      : 0;

    let processStability = 80;
    if (results.length >= 3) {
      const recentResults = results.slice(-3);
      const angleStd = this.calculateStdDev(recentResults.map(r => r.profile_angle).filter(r => r !== undefined));
      const selectivityStd = this.calculateStdDev(recentResults.map(r => r.selectivity).filter(r => r !== undefined));
      processStability = Math.max(0, 100 - (angleStd * 5 + selectivityStd * 2));
    }

    const scores = [etchRateControl, profileAngleAccuracy, selectivityControl, uniformityControl, roughnessControl, processStability];

    return this.PROCESS_DIMENSIONS.map((d, i) => ({
      dimension: d.name,
      value: Number(Math.min(100, Math.max(0, scores[i])).toFixed(1)),
      fullMark: 100
    }));
  }

  private calculateDimensionScore(values: number[], minTarget: number, maxTarget: number, higherIsBetter: boolean): number {
    if (values.length === 0) return 0;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const range = maxTarget - minTarget;

    if (higherIsBetter) {
      if (avg >= maxTarget) return 100;
      if (avg <= minTarget) return 50;
      return 50 + ((avg - minTarget) / range) * 50;
    } else {
      if (avg <= minTarget) return 100;
      if (avg >= maxTarget) return 50;
      return 50 + ((maxTarget - avg) / range) * 50;
    }
  }

  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async saveStats(stats: DailyStatsData) {
    const existing = db.get('SELECT * FROM daily_stats WHERE date = ?', [stats.date]);

    if (existing) {
      db.run(
        'UPDATE daily_stats SET completion_rate = ?, rate_deviation = ?, optimization_count = ?, total_tasks = ?, completed_tasks = ?, warning_count = ?, approval_count = ?, process_capability = ?, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
        [
          stats.completionRate,
          stats.rateDeviation,
          stats.optimizationCount,
          stats.totalTasks,
          stats.completedTasks,
          stats.warningCount,
          stats.approvalCount,
          JSON.stringify(stats.processCapability),
          stats.date
        ]
      );
    } else {
      db.run(
        'INSERT INTO daily_stats (id, date, completion_rate, rate_deviation, optimization_count, total_tasks, completed_tasks, warning_count, approval_count, process_capability, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [
          uuidv4(),
          stats.date,
          stats.completionRate,
          stats.rateDeviation,
          stats.optimizationCount,
          stats.totalTasks,
          stats.completedTasks,
          stats.warningCount,
          stats.approvalCount,
          JSON.stringify(stats.processCapability)
        ]
      );
    }
  }

  getDailyStats(date?: string): DailyStatsData | null {
    const targetDate = date || this.formatDate(new Date());
    const stats = db.get('SELECT * FROM daily_stats WHERE date = ?', [targetDate]);

    if (!stats) return null;

    return {
      date: stats.date,
      completionRate: stats.completion_rate,
      rateDeviation: stats.rate_deviation,
      optimizationCount: stats.optimization_count,
      totalTasks: stats.total_tasks,
      completedTasks: stats.completed_tasks,
      warningCount: stats.warning_count,
      approvalCount: stats.approval_count,
      processCapability: typeof stats.process_capability === 'string' ? JSON.parse(stats.process_capability) : stats.process_capability
    };
  }

  async getWeeklyTrend(): Promise<WeeklyTrend[]> {
    const today = new Date();
    const trends: WeeklyTrend[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDate(date);

      let stats = this.getDailyStats(dateStr);
      if (!stats) {
        stats = await this.calculateDailyStats(dateStr);
      }

      const startOfDay = new Date(dateStr + 'T00:00:00').toISOString();
      const endOfDay = new Date(dateStr + 'T23:59:59').toISOString();

      const tasks = db.all(
        'SELECT * FROM tasks WHERE created_at >= ? AND created_at <= ? AND status = ? AND result IS NOT NULL',
        [startOfDay, endOfDay, 'completed']
      );

      let avgScore = 0;
      if (tasks.length > 0) {
        const scores = tasks.map(t => {
          try {
            const result = typeof t.result === 'string' ? JSON.parse(t.result) : t.result;
            if (result) {
              return 0.4 * result.uniformity + 0.3 * result.selectivity + 0.3 * (90 - Math.abs(result.profile_angle - 90));
            }
            return 0;
          } catch {
            return 0;
          }
        });
        avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      }

      trends.push({
        date: dateStr,
        completionRate: stats.completionRate,
        avgScore: Number(avgScore.toFixed(2)),
        totalTasks: stats.totalTasks
      });
    }

    return trends;
  }

  getStatsRange(startDate: string, endDate: string): DailyStatsData[] {
    const statsList = db.all(
      'SELECT * FROM daily_stats WHERE date >= ? AND date <= ? ORDER BY date ASC',
      [startDate, endDate]
    );

    return statsList.map(stats => ({
      date: stats.date,
      completionRate: stats.completion_rate,
      rateDeviation: stats.rate_deviation,
      optimizationCount: stats.optimization_count,
      totalTasks: stats.total_tasks,
      completedTasks: stats.completed_tasks,
      warningCount: stats.warning_count,
      approvalCount: stats.approval_count,
      processCapability: typeof stats.process_capability === 'string' ? JSON.parse(stats.process_capability) : stats.process_capability
    }));
  }

  async ensureTodayStats(): Promise<void> {
    const today = this.formatDate(new Date());
    const existing = db.get('SELECT id FROM daily_stats WHERE date = ?', [today]);
    if (!existing) {
      await this.calculateDailyStats(today);
    }
  }

  async getOverallStatistics() {
    const totalTasks = db.count('SELECT COUNT(*) as count FROM tasks');
    const completedTasks = db.count("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'");
    const totalWarnings = db.count('SELECT COUNT(*) as count FROM warnings');
    const totalAdjustments = db.count('SELECT COUNT(*) as count FROM adjustments');

    const allCompleted = db.all("SELECT * FROM tasks WHERE status = 'completed' AND result IS NOT NULL");
    let avgUniformity = 0;
    let avgSelectivity = 0;
    let avgAngle = 0;
    let avgEtchRate = 0;

    if (allCompleted.length > 0) {
      const metrics = allCompleted.map(t => {
        try {
          const result = typeof t.result === 'string' ? JSON.parse(t.result) : t.result;
          return result || {};
        } catch {
          return {};
        }
      });

      avgUniformity = metrics.filter(m => m.uniformity).reduce((sum, m) => sum + m.uniformity, 0) / metrics.filter(m => m.uniformity).length || 0;
      avgSelectivity = metrics.filter(m => m.selectivity).reduce((sum, m) => sum + m.selectivity, 0) / metrics.filter(m => m.selectivity).length || 0;
      avgAngle = metrics.filter(m => m.profile_angle).reduce((sum, m) => sum + m.profile_angle, 0) / metrics.filter(m => m.profile_angle).length || 0;
      avgEtchRate = metrics.filter(m => m.etch_rate).reduce((sum, m) => sum + m.etch_rate, 0) / metrics.filter(m => m.etch_rate).length || 0;
    }

    return {
      totalTasks,
      completedTasks,
      completionRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
      totalWarnings,
      totalAdjustments,
      avgUniformity: Number(avgUniformity.toFixed(2)),
      avgSelectivity: Number(avgSelectivity.toFixed(2)),
      avgAngle: Number(avgAngle.toFixed(2)),
      avgEtchRate: Number(avgEtchRate.toFixed(2))
    };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export const dailyStatsService = new DailyStatsService();

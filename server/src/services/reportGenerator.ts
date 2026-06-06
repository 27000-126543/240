import PDFDocument from 'pdfkit';
import { db } from '../db/sqlite';
import { ProcessParams, SimulationResult } from '../types';
import { physicsEngine } from './physicsEngine';

interface ReportData {
  task: any;
  batch: any;
  params: ProcessParams;
  result: SimulationResult;
}

class ReportGenerator {
  private readonly PAGE_WIDTH = 595.28;
  private readonly PAGE_HEIGHT = 841.89;
  private readonly MARGIN = 50;
  private readonly CONTENT_WIDTH = this.PAGE_WIDTH - 2 * this.MARGIN;

  async generateReport(taskId: string): Promise<Buffer> {
    const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    const batch = db.get('SELECT * FROM batches WHERE id = ?', [task.batch_id]);
    const params = typeof task.parameters === 'string' ? JSON.parse(task.parameters) : task.parameters;
    const result = typeof task.result === 'string' ? JSON.parse(task.result) : task.result;

    if (!result) {
      throw new Error('Task result not available');
    }

    const reportData: ReportData = { task, batch, params, result };

    return this.createPDF(reportData);
  }

  private createPDF(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: this.MARGIN,
        info: {
          Title: `刻蚀工艺模拟报告 - ${data.task.name}`,
          Author: '等离子体刻蚀工艺模拟平台',
          Subject: '刻蚀工艺模拟结果报告',
          Creator: 'Plasma Etching Simulation Platform'
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.drawCoverPage(doc, data);
      doc.addPage();
      this.drawParamsTable(doc, data);
      doc.addPage();
      this.drawProfileSection(doc, data);
      doc.addPage();
      this.drawRateDistribution(doc, data);
      doc.addPage();
      this.drawRoughnessCurve(doc, data);
      doc.addPage();
      this.drawSummaryTable(doc, data);

      doc.end();
    });
  }

  private drawCoverPage(doc: PDFKit.PDFDocument, data: ReportData) {
    const centerX = this.PAGE_WIDTH / 2;
    const centerY = this.PAGE_HEIGHT / 2;

    doc.rect(0, 0, this.PAGE_WIDTH, this.PAGE_HEIGHT)
       .fillColor('#f5f7fa')
       .fill();

    doc.rect(0, 0, this.PAGE_WIDTH, 150)
       .fillColor('#1a56db')
       .fill();

    doc.rect(0, this.PAGE_HEIGHT - 100, this.PAGE_WIDTH, 100)
       .fillColor('#1a56db')
       .fill();

    doc.fillColor('#ffffff')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('等离子体刻蚀工艺模拟报告', this.MARGIN, 60, {
         align: 'center',
         width: this.CONTENT_WIDTH
       });

    doc.fontSize(16)
       .font('Helvetica')
       .text('Plasma Etching Process Simulation Report', this.MARGIN, 100, {
         align: 'center',
         width: this.CONTENT_WIDTH
       });

    doc.fillColor('#ffffff')
       .fontSize(12)
       .text('报告生成时间: ' + new Date().toLocaleString('zh-CN'), this.MARGIN, this.PAGE_HEIGHT - 70, {
         align: 'center',
         width: this.CONTENT_WIDTH
       });

    doc.fillColor('#1a202c')
       .fontSize(22)
       .font('Helvetica-Bold')
       .text(data.task.name, this.MARGIN, centerY - 80, {
         align: 'center',
         width: this.CONTENT_WIDTH
       });

    const tableY = centerY - 20;
    const col1X = centerX - 150;
    const col2X = centerX + 20;

    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#4a5568');

    const infoItems = [
      { label: '任务编号', value: data.task.id.slice(0, 8) + '...' },
      { label: '批次名称', value: data.batch?.name || '默认批次' },
      { label: '工艺类型', value: '等离子体刻蚀' },
      { label: '创建时间', value: new Date(data.task.created_at).toLocaleString('zh-CN') },
      { label: '完成时间', value: data.task.completed_at ? new Date(data.task.completed_at).toLocaleString('zh-CN') : '-' },
      { label: '参数调整次数', value: String(data.task.adjust_count || 0) }
    ];

    infoItems.forEach((item, index) => {
      const y = tableY + index * 30;
      doc.fillColor('#718096').text(item.label + ':', col1X, y);
      doc.fillColor('#1a202c').font('Helvetica-Bold').text(item.value, col2X, y);
      doc.font('Helvetica');
    });

    const logoY = centerY + 140;
    doc.rect(centerX - 80, logoY, 160, 50)
       .strokeColor('#cbd5e0')
       .lineWidth(1)
       .stroke();

    doc.fillColor('#a0aec0')
       .fontSize(14)
       .text('Company Logo', centerX - 80, logoY + 18, {
         width: 160,
         align: 'center'
       });
  }

  private drawParamsTable(doc: PDFKit.PDFDocument, data: ReportData) {
    this.drawPageHeader(doc, '工艺参数表');

    const tableTop = 120;
    const rowHeight = 35;
    const col1Width = 180;
    const col2Width = 120;
    const col3Width = 120;

    doc.rect(this.MARGIN, tableTop, col1Width + col2Width + col3Width, rowHeight)
       .fillColor('#1a56db')
       .fill();

    doc.fillColor('#ffffff')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('参数名称', this.MARGIN + 10, tableTop + 12)
       .text('参数值', this.MARGIN + col1Width + 10, tableTop + 12)
       .text('单位', this.MARGIN + col1Width + col2Width + 10, tableTop + 12);

    const params = data.params;
    const paramsList = [
      { name: '射频功率 (RF Power)', value: params.rf_power, unit: 'W' },
      { name: '偏压功率 (Bias Power)', value: params.bias_power, unit: 'W' },
      { name: '腔体压力 (Pressure)', value: params.pressure, unit: 'mTorr' },
      { name: 'Ar 气体比例', value: params.gas_ratio.Ar, unit: '%' },
      { name: 'CF4 气体比例', value: params.gas_ratio.CF4, unit: '%' },
      { name: 'O2 气体比例', value: params.gas_ratio.O2, unit: '%' },
      { name: '衬底温度', value: params.temperature, unit: '°C' },
      { name: '工艺时间', value: params.time, unit: 's' }
    ];

    paramsList.forEach((item, index) => {
      const y = tableTop + rowHeight * (index + 1);
      const isEven = index % 2 === 0;

      if (isEven) {
        doc.rect(this.MARGIN, y, col1Width + col2Width + col3Width, rowHeight)
           .fillColor('#f7fafc')
           .fill();
      }

      doc.strokeColor('#e2e8f0')
         .lineWidth(0.5)
         .moveTo(this.MARGIN, y)
         .lineTo(this.MARGIN + col1Width + col2Width + col3Width, y)
         .stroke();

      doc.fillColor('#2d3748')
         .fontSize(11)
         .font('Helvetica')
         .text(item.name, this.MARGIN + 10, y + 12);

      doc.font('Helvetica-Bold')
         .fillColor('#1a56db')
         .text(String(item.value), this.MARGIN + col1Width + 10, y + 12);

      doc.font('Helvetica')
         .fillColor('#718096')
         .text(item.unit, this.MARGIN + col1Width + col2Width + 10, y + 12);
    });

    this.drawPageFooter(doc, 2);
  }

  private drawProfileSection(doc: PDFKit.PDFDocument, data: ReportData) {
    this.drawPageHeader(doc, '刻蚀轮廓截面图');

    const chartX = this.MARGIN;
    const chartY = 120;
    const chartWidth = this.CONTENT_WIDTH;
    const chartHeight = 350;

    doc.rect(chartX, chartY, chartWidth, chartHeight)
       .fillColor('#fafafa')
       .strokeColor('#e2e8f0')
       .lineWidth(1)
       .stroke();

    const padding = 60;
    const plotX = chartX + padding;
    const plotY = chartY + padding;
    const plotWidth = chartWidth - 2 * padding;
    const plotHeight = chartHeight - 2 * padding;

    doc.strokeColor('#cbd5e0')
       .lineWidth(0.5);

    for (let i = 0; i <= 5; i++) {
      const y = plotY + (plotHeight / 5) * i;
      doc.moveTo(plotX, y)
         .lineTo(plotX + plotWidth, y)
         .stroke();

      const depth = (data.result.etch_depth * i / 5).toFixed(0);
      doc.fillColor('#718096')
         .fontSize(9)
         .text(depth + ' nm', plotX - 50, y - 5);
    }

    for (let i = 0; i <= 5; i++) {
      const x = plotX + (plotWidth / 5) * i;
      doc.moveTo(x, plotY)
         .lineTo(x, plotY + plotHeight)
         .stroke();

      const width = (100 * i / 5).toFixed(0);
      doc.fillColor('#718096')
         .fontSize(9)
         .text(width + ' nm', x - 15, plotY + plotHeight + 10);
    }

    doc.strokeColor('#2d3748')
       .lineWidth(2);

    const coords = data.result.profile_coords;
    if (coords && coords.length > 0) {
      const maxX = Math.max(...coords.map(c => c.x));
      const maxY = Math.max(...coords.map(c => c.y));

      const xScale = plotWidth / (maxX * 2.5);
      const yScale = plotHeight / (maxY || 1);

      doc.moveTo(plotX + plotWidth / 2, plotY);

      coords.forEach((coord, i) => {
        const x = plotX + plotWidth / 2 - coord.x * xScale;
        const y = plotY + coord.y * yScale;
        if (i === 0) {
          doc.moveTo(x, y);
        } else {
          doc.lineTo(x, y);
        }
      });
      doc.stroke();

      doc.moveTo(plotX + plotWidth / 2, plotY);
      coords.forEach((coord, i) => {
        const x = plotX + plotWidth / 2 + coord.x * xScale;
        const y = plotY + coord.y * yScale;
        if (i === 0) {
          doc.moveTo(x, y);
        } else {
          doc.lineTo(x, y);
        }
      });
      doc.stroke();

      const maxCoordY = Math.max(...coords.map(c => c.y));
      const bottomY = plotY + maxCoordY * yScale;
      doc.moveTo(plotX + plotWidth / 2 - coords[0].x * xScale, bottomY)
         .lineTo(plotX + plotWidth / 2 + coords[0].x * xScale, bottomY)
         .stroke();
    }

    doc.fillColor('#2d3748')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('横向位置 (nm)', plotX + plotWidth / 2 - 30, plotY + plotHeight + 30);

    doc.save();
    doc.translate(plotX - 40, plotY + plotHeight / 2);
    doc.rotate(-90);
    doc.fillColor('#2d3748')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('刻蚀深度 (nm)', -30, 0);
    doc.restore();

    const legendY = chartY + chartHeight + 20;
    doc.rect(chartX + 10, legendY, 15, 15)
       .strokeColor('#2d3748')
       .lineWidth(2)
       .stroke();
    doc.fillColor('#2d3748')
       .fontSize(10)
       .font('Helvetica')
       .text('刻蚀轮廓', chartX + 35, legendY + 3);

    const angleText = `剖面角度: ${data.result.profile_angle.toFixed(2)}°`;
    const depthText = `刻蚀深度: ${data.result.etch_depth.toFixed(2)} nm`;
    doc.fillColor('#1a56db')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(angleText, chartX + chartWidth - 200, legendY + 3)
       .text(depthText, chartX + chartWidth - 200, legendY + 23);

    this.drawPageFooter(doc, 3);
  }

  private drawRateDistribution(doc: PDFKit.PDFDocument, data: ReportData) {
    this.drawPageHeader(doc, '速率分布云图');

    const chartX = this.MARGIN;
    const chartY = 120;
    const chartWidth = this.CONTENT_WIDTH;
    const chartHeight = 350;

    doc.rect(chartX, chartY, chartWidth, chartHeight)
       .fillColor('#fafafa')
       .strokeColor('#e2e8f0')
       .lineWidth(1)
       .stroke();

    const padding = 60;
    const plotX = chartX + padding;
    const plotY = chartY + padding;
    const plotWidth = chartWidth - 2 * padding;
    const plotHeight = chartHeight - 2 * padding;

    const rateDistribution = data.result.rate_distribution || [];
    if (rateDistribution.length > 0) {
      const minRate = Math.min(...rateDistribution);
      const maxRate = Math.max(...rateDistribution);
      const rateRange = maxRate - minRate || 1;

      const cellWidth = plotWidth / rateDistribution.length;
      const cellHeight = plotHeight / 20;

      for (let i = 0; i < rateDistribution.length; i++) {
        const rate = rateDistribution[i];
        const normalized = (rate - minRate) / rateRange;

        const color = this.getHeatmapColor(normalized);

        for (let j = 0; j < 20; j++) {
          const x = plotX + i * cellWidth;
          const y = plotY + j * cellHeight;
          doc.rect(x, y, cellWidth + 0.5, cellHeight + 0.5)
             .fillColor(color)
             .fill();
        }
      }

      const gradientX = plotX + plotWidth + 20;
      const gradientY = plotY;
      const gradientWidth = 20;
      const gradientHeight = plotHeight;

      for (let i = 0; i < gradientHeight; i++) {
        const normalized = 1 - i / gradientHeight;
        const color = this.getHeatmapColor(normalized);
        doc.rect(gradientX, gradientY + i, gradientWidth, 1)
           .fillColor(color)
           .fill();
      }

      doc.strokeColor('#cbd5e0')
         .lineWidth(1)
         .rect(gradientX, gradientY, gradientWidth, gradientHeight)
         .stroke();

      doc.fillColor('#2d3748')
         .fontSize(9)
         .text(maxRate.toFixed(1), gradientX + gradientWidth + 5, gradientY - 5)
         .text(((maxRate + minRate) / 2).toFixed(1), gradientX + gradientWidth + 5, gradientY + gradientHeight / 2 - 5)
         .text(minRate.toFixed(1), gradientX + gradientWidth + 5, gradientY + gradientHeight - 5);
    }

    doc.strokeColor('#2d3748')
       .lineWidth(1.5)
       .moveTo(plotX, plotY + plotHeight)
       .lineTo(plotX + plotWidth, plotY + plotHeight)
       .stroke();

    doc.moveTo(plotX, plotY)
       .lineTo(plotX, plotY + plotHeight)
       .stroke();

    for (let i = 0; i <= 5; i++) {
      const x = plotX + (plotWidth / 5) * i;
      doc.moveTo(x, plotY + plotHeight)
         .lineTo(x, plotY + plotHeight + 5)
         .stroke();

      const width = (100 * i / 5).toFixed(0);
      doc.fillColor('#718096')
         .fontSize(9)
         .text(width, x - 10, plotY + plotHeight + 10);
    }

    doc.fillColor('#2d3748')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('晶圆位置 (%)', plotX + plotWidth / 2 - 30, plotY + plotHeight + 30);

    doc.save();
    doc.translate(plotX - 45, plotY + plotHeight / 2);
    doc.rotate(-90);
    doc.fillColor('#2d3748')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('刻蚀速率 (nm/min)', -50, 0);
    doc.restore();

    const avgRate = rateDistribution.length > 0 ? rateDistribution.reduce((a, b) => a + b, 0) / rateDistribution.length : 0;
    const uniformity = data.result.uniformity;

    const summaryY = chartY + chartHeight + 20;
    doc.fillColor('#2d3748')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(`平均刻蚀速率: ${avgRate.toFixed(2)} nm/min`, chartX + 10, summaryY)
       .text(`均匀性: ${uniformity.toFixed(2)}%`, chartX + 250, summaryY);

    this.drawPageFooter(doc, 4);
  }

  private drawRoughnessCurve(doc: PDFKit.PDFDocument, data: ReportData) {
    this.drawPageHeader(doc, '表面粗糙度曲线');

    const chartX = this.MARGIN;
    const chartY = 120;
    const chartWidth = this.CONTENT_WIDTH;
    const chartHeight = 350;

    doc.rect(chartX, chartY, chartWidth, chartHeight)
       .fillColor('#fafafa')
       .strokeColor('#e2e8f0')
       .lineWidth(1)
       .stroke();

    const padding = 60;
    const plotX = chartX + padding;
    const plotY = chartY + padding;
    const plotWidth = chartWidth - 2 * padding;
    const plotHeight = chartHeight - 2 * padding;

    doc.strokeColor('#cbd5e0')
       .lineWidth(0.5);

    for (let i = 0; i <= 5; i++) {
      const y = plotY + (plotHeight / 5) * i;
      doc.moveTo(plotX, y)
         .lineTo(plotX + plotWidth, y)
         .stroke();
    }

    for (let i = 0; i <= 5; i++) {
      const x = plotX + (plotWidth / 5) * i;
      doc.moveTo(x, plotY)
         .lineTo(x, plotY + plotHeight)
         .stroke();
    }

    const roughnessCurve = data.result.roughness_curve || [];
    if (roughnessCurve.length > 0) {
      const minRoughness = Math.min(...roughnessCurve);
      const maxRoughness = Math.max(...roughnessCurve);
      const roughnessRange = maxRoughness - minRoughness || 1;

      for (let i = 0; i <= 5; i++) {
        const value = maxRoughness - (roughnessRange * i / 5);
        doc.fillColor('#718096')
           .fontSize(9)
           .text(value.toFixed(2), plotX - 40, plotY + (plotHeight / 5) * i - 5);
      }

      for (let i = 0; i <= 5; i++) {
        const time = (roughnessCurve.length * i / 5).toFixed(0);
        doc.fillColor('#718096')
           .fontSize(9)
           .text(time + 's', plotX + (plotWidth / 5) * i - 15, plotY + plotHeight + 10);
      }

      doc.strokeColor('#e53e3e')
         .lineWidth(2);

      roughnessCurve.forEach((value, i) => {
        const x = plotX + (i / (roughnessCurve.length - 1)) * plotWidth;
        const y = plotY + plotHeight - ((value - minRoughness) / roughnessRange) * plotHeight;
        if (i === 0) {
          doc.moveTo(x, y);
        } else {
          doc.lineTo(x, y);
        }
      });
      doc.stroke();
    }

    doc.strokeColor('#2d3748')
       .lineWidth(1.5)
       .moveTo(plotX, plotY + plotHeight)
       .lineTo(plotX + plotWidth, plotY + plotHeight)
       .stroke();

    doc.moveTo(plotX, plotY)
       .lineTo(plotX, plotY + plotHeight)
       .stroke();

    doc.fillColor('#2d3748')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('时间 (s)', plotX + plotWidth / 2 - 20, plotY + plotHeight + 30);

    doc.save();
    doc.translate(plotX - 50, plotY + plotHeight / 2);
    doc.rotate(-90);
    doc.fillColor('#2d3748')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text('粗糙度 Ra (nm)', -40, 0);
    doc.restore();

    const legendY = chartY + chartHeight + 20;
    doc.rect(chartX + 10, legendY, 30, 3)
       .strokeColor('#e53e3e')
       .lineWidth(3)
       .stroke();
    doc.fillColor('#2d3748')
       .fontSize(10)
       .font('Helvetica')
       .text('表面粗糙度', chartX + 50, legendY - 3);

    const finalRoughness = roughnessCurve.length > 0 ? roughnessCurve[roughnessCurve.length - 1] : 0;
    doc.fillColor('#1a56db')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(`最终粗糙度: ${finalRoughness.toFixed(3)} nm`, chartX + chartWidth - 200, legendY - 3);

    this.drawPageFooter(doc, 5);
  }

  private drawSummaryTable(doc: PDFKit.PDFDocument, data: ReportData) {
    this.drawPageHeader(doc, '结果总结');

    const tableTop = 120;
    const rowHeight = 35;
    const col1Width = 200;
    const col2Width = 150;
    const col3Width = 100;

    doc.rect(this.MARGIN, tableTop, col1Width + col2Width + col3Width, rowHeight)
       .fillColor('#1a56db')
       .fill();

    doc.fillColor('#ffffff')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('指标名称', this.MARGIN + 10, tableTop + 12)
       .text('数值', this.MARGIN + col1Width + 10, tableTop + 12)
       .text('评价', this.MARGIN + col1Width + col2Width + 10, tableTop + 12);

    const result = data.result;
    const summary = [
      { name: '刻蚀速率 (Etch Rate)', value: `${result.etch_rate.toFixed(2)} nm/min`, rating: this.getRateRating(result.etch_rate) },
      { name: '剖面角度 (Profile Angle)', value: `${result.profile_angle.toFixed(2)}°`, rating: this.getAngleRating(result.profile_angle) },
      { name: '选择比 (Selectivity)', value: `${result.selectivity.toFixed(2)}`, rating: this.getSelectivityRating(result.selectivity) },
      { name: '均匀性 (Uniformity)', value: `${result.uniformity.toFixed(2)}%`, rating: this.getUniformityRating(result.uniformity) },
      { name: '刻蚀深度 (Etch Depth)', value: `${result.etch_depth.toFixed(2)} nm`, rating: '正常' },
      { name: '最终粗糙度 (Roughness)', value: `${result.roughness_curve?.[result.roughness_curve.length - 1]?.toFixed(3) || '-'} nm`, rating: '正常' }
    ];

    summary.forEach((item, index) => {
      const y = tableTop + rowHeight * (index + 1);
      const isEven = index % 2 === 0;

      if (isEven) {
        doc.rect(this.MARGIN, y, col1Width + col2Width + col3Width, rowHeight)
           .fillColor('#f7fafc')
           .fill();
      }

      doc.strokeColor('#e2e8f0')
         .lineWidth(0.5)
         .moveTo(this.MARGIN, y)
         .lineTo(this.MARGIN + col1Width + col2Width + col3Width, y)
         .stroke();

      doc.fillColor('#2d3748')
         .fontSize(11)
         .font('Helvetica')
         .text(item.name, this.MARGIN + 10, y + 12);

      doc.font('Helvetica-Bold')
         .fillColor('#1a56db')
         .text(item.value, this.MARGIN + col1Width + 10, y + 12);

      const ratingColor = item.rating === '优秀' ? '#38a169' : item.rating === '良好' ? '#d69e2e' : '#e53e3e';
      doc.fillColor(ratingColor)
         .text(item.rating, this.MARGIN + col1Width + col2Width + 10, y + 12);
    });

    const conclusionY = tableTop + rowHeight * (summary.length + 2);
    doc.fillColor('#2d3748')
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('工艺评价', this.MARGIN, conclusionY);

    const score = 0.4 * result.uniformity + 0.3 * result.selectivity + 0.3 * (90 - Math.abs(result.profile_angle - 90));
    const conclusion = score >= 85 ? '工艺参数优秀，各项指标均达到较高水平，可用于量产。' :
                       score >= 70 ? '工艺参数良好，部分指标需要优化调整。' :
                       '工艺参数需要优化，建议调整气体比例和偏压功率。';

    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#4a5568')
       .text(conclusion, this.MARGIN, conclusionY + 30, {
         width: this.CONTENT_WIDTH,
         lineGap: 5
       });

    this.drawPageFooter(doc, 6);
  }

  private getHeatmapColor(value: number): string {
    const hue = (1 - value) * 240;
    return `hsl(${hue}, 80%, 60%)`;
  }

  private getRateRating(rate: number): string {
    if (rate >= 200) return '优秀';
    if (rate >= 100) return '良好';
    return '偏低';
  }

  private getAngleRating(angle: number): string {
    if (Math.abs(angle - 90) <= 1) return '优秀';
    if (Math.abs(angle - 90) <= 2) return '良好';
    return '偏差';
  }

  private getSelectivityRating(selectivity: number): string {
    if (selectivity >= 20) return '优秀';
    if (selectivity >= 10) return '良好';
    return '偏低';
  }

  private getUniformityRating(uniformity: number): string {
    if (uniformity >= 97) return '优秀';
    if (uniformity >= 93) return '良好';
    return '偏差';
  }

  private drawPageHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.rect(0, 0, this.PAGE_WIDTH, 70)
       .fillColor('#1a56db')
       .fill();

    doc.fillColor('#ffffff')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text(title, this.MARGIN, 30);

    doc.fillColor('#e2e8f0')
       .fontSize(10)
       .font('Helvetica')
       .text('等离子体刻蚀工艺模拟平台', this.MARGIN, 52);
  }

  private drawPageFooter(doc: PDFKit.PDFDocument, pageNum: number) {
    doc.strokeColor('#e2e8f0')
       .lineWidth(0.5)
       .moveTo(this.MARGIN, this.PAGE_HEIGHT - 50)
       .lineTo(this.PAGE_WIDTH - this.MARGIN, this.PAGE_HEIGHT - 50)
       .stroke();

    doc.fillColor('#a0aec0')
       .fontSize(9)
       .text('第 ' + pageNum + ' 页', this.MARGIN, this.PAGE_HEIGHT - 35)
       .text('© 2024 等离子体刻蚀工艺模拟平台', 0, this.PAGE_HEIGHT - 35, {
         align: 'right',
         width: this.PAGE_WIDTH - this.MARGIN
       });
  }
}

export const reportGenerator = new ReportGenerator();

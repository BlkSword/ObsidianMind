import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ReportConfig {
  taskId: string;
  taskName: string;
  target: string;
  format: 'html' | 'pdf' | 'json';
  template?: string;
  includeScreenshots?: boolean;
  includeLogs?: boolean;
  customSections?: string[];
}

export interface ReportData {
  taskInfo: {
    id: string;
    name: string;
    target: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    status: string;
  };
  summary: {
    totalVulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    score: number; // CVSS 分数
  };
  vulnerabilities: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    cvssScore: number;
    cveId?: string;
    affectedComponent: string;
    attackVector: string;
    impact: string;
    remediation: string;
    pocVerified: boolean;
    evidence?: string[];
    references?: string[];
  }>;
  scanResults: Array<{
    tool: string;
    startTime: Date;
    endTime: Date;
    results: any;
  }>;
  recommendations: Array<{
    category: string;
    priority: string;
    description: string;
    implementation: string;
    timeline: string;
  }>;
  methodology: {
    approach: string;
    tools: string[];
    scope: string[];
    limitations: string[];
  };
}

export class ReportGenerator {
  private logger: winston.Logger;
  private reportStoragePath: string;
  private templatePath: string;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'logs/report-generator.log' }),
        new winston.transports.Console()
      ]
    });

    this.reportStoragePath = path.join(process.cwd(), 'reports');
    this.templatePath = path.join(process.cwd(), 'templates');
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.reportStoragePath, { recursive: true });
      await fs.mkdir(this.templatePath, { recursive: true });
      await this.createDefaultTemplates();
      this.logger.info('Report storage initialized');
    } catch (error) {
      this.logger.error('Failed to initialize report storage', error);
    }
  }

  private async createDefaultTemplates(): Promise<void> {
    const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>渗透测试报告 - {{taskName}}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header .meta {
            margin-top: 10px;
            opacity: 0.9;
        }
        .section {
            background: white;
            margin: 20px 0;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #667eea;
        }
        .section h2 {
            color: #667eea;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
            margin-top: 0;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .summary-card {
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
        }
        .critical { background: linear-gradient(135deg, #ff6b6b, #ee5a24); }
        .high { background: linear-gradient(135deg, #ffa726, #ff7043); }
        .medium { background: linear-gradient(135deg, #ffca28, #ffa726); }
        .low { background: linear-gradient(135deg, #66bb6a, #43a047); }
        .info { background: linear-gradient(135deg, #42a5f5, #1e88e5); }
        .vulnerability {
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin: 15px 0;
            padding: 20px;
            background: #fafafa;
        }
        .vulnerability.critical { border-left: 4px solid #dc3545; }
        .vulnerability.high { border-left: 4px solid #fd7e14; }
        .vulnerability.medium { border-left: 4px solid #ffc107; }
        .vulnerability.low { border-left: 4px solid #28a745; }
        .vulnerability.info { border-left: 4px solid #17a2b8; }
        .severity-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .recommendation {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 10px 0;
            border-radius: 0 8px 8px 0;
        }
        .code-block {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            overflow-x: auto;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
        }
        @media print {
            body { background: white; }
            .section { box-shadow: none; border: 1px solid #dee2e6; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>渗透测试报告</h1>
        <div class="meta">
            <strong>任务名称:</strong> {{taskName}} | 
            <strong>测试目标:</strong> {{target}} | 
            <strong>执行时间:</strong> {{startTime}} - {{endTime}}
        </div>
    </div>

    <div class="section">
        <h2>📊 执行摘要</h2>
        <div class="summary-grid">
            <div class="summary-card critical">
                <div style="font-size: 2em;">{{critical}}</div>
                <div>严重漏洞</div>
            </div>
            <div class="summary-card high">
                <div style="font-size: 2em;">{{high}}</div>
                <div>高危漏洞</div>
            </div>
            <div class="summary-card medium">
                <div style="font-size: 2em;">{{medium}}</div>
                <div>中危漏洞</div>
            </div>
            <div class="summary-card low">
                <div style="font-size: 2em;">{{low}}</div>
                <div>低危漏洞</div>
            </div>
            <div class="summary-card info">
                <div style="font-size: 2em;">{{info}}</div>
                <div>信息泄露</div>
            </div>
        </div>
        <p><strong>总体评分:</strong> {{score}}/10</p>
        <p><strong>测试持续时间:</strong> {{duration}} 分钟</p>
    </div>

    <div class="section">
        <h2>🎯 发现的漏洞</h2>
        {{#vulnerabilities}}
        <div class="vulnerability {{severity}}">
            <h3>
                {{title}} 
                <span class="severity-badge {{severity}}">{{severity}}</span>
                {{#cveId}}<span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">CVE: {{cveId}}</span>{{/cveId}}
            </h3>
            <p><strong>描述:</strong> {{description}}</p>
            <p><strong>影响组件:</strong> {{affectedComponent}}</p>
            <p><strong>攻击向量:</strong> {{attackVector}}</p>
            <p><strong>影响:</strong> {{impact}}</p>
            <p><strong>CVSS评分:</strong> {{cvssScore}}/10</p>
            {{#pocVerified}}
            <p><strong>POC验证:</strong> ✅ 已验证</p>
            {{/pocVerified}}
            <div class="code-block">
                <strong>修复建议:</strong><br>
                {{remediation}}
            </div>
        </div>
        {{/vulnerabilities}}
    </div>

    <div class="section">
        <h2>🔧 修复建议</h2>
        {{#recommendations}}
        <div class="recommendation">
            <h4>{{category}} ({{priority}})</h4>
            <p><strong>描述:</strong> {{description}}</p>
            <p><strong>实施方法:</strong> {{implementation}}</p>
            <p><strong>时间线:</strong> {{timeline}}</p>
        </div>
        {{/recommendations}}
    </div>

    <div class="section">
        <h2>📋 测试方法</h2>
        <p><strong>测试方法:</strong> {{methodology.approach}}</p>
        <p><strong>使用工具:</strong> {{#methodology.tools}}{{.}}, {{/methodology.tools}}</p>
        <p><strong>测试范围:</strong> {{#methodology.scope}}{{.}}, {{/methodology.scope}}</p>
        <p><strong>测试限制:</strong> {{#methodology.limitations}}{{.}}, {{/methodology.limitations}}</p>
    </div>

    <div class="footer">
        <p>本报告由AI全自动渗透测试LLM-Agent系统生成</p>
        <p>生成时间: {{generatedAt}}</p>
    </div>
</body>
</html>`;

    await fs.writeFile(path.join(this.templatePath, 'default.html'), htmlTemplate);

    // JSON模板
    const jsonTemplate = {
      metadata: {
        version: "1.0",
        generator: "AI Penetration Testing LLM-Agent",
        generatedAt: "{{generatedAt}}"
      },
      taskInfo: "{{taskInfo}}",
      summary: "{{summary}}",
      vulnerabilities: "{{vulnerabilities}}",
      recommendations: "{{recommendations}}",
      methodology: "{{methodology}}"
    };

    await fs.writeFile(path.join(this.templatePath, 'default.json'), JSON.stringify(jsonTemplate, null, 2));
  }

  async generateReport(reportConfig: ReportConfig, reportData: ReportData): Promise<{
    success: boolean;
    reportId: string;
    filePath: string;
    fileSize: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const reportId = uuidv4();

    try {
      this.logger.info('Generating report', { reportId, format: reportConfig.format });

      let reportContent: string;
      let fileExtension: string;

      switch (reportConfig.format) {
        case 'html':
          reportContent = await this.generateHTMLReport(reportData);
          fileExtension = 'html';
          break;
        case 'json':
          reportContent = await this.generateJSONReport(reportData);
          fileExtension = 'json';
          break;
        case 'pdf':
          // 先生成HTML，然后转换为PDF
          const htmlContent = await this.generateHTMLReport(reportData);
          reportContent = htmlContent; // 这里需要PDF转换库
          fileExtension = 'pdf';
          break;
        default:
          throw new Error(`Unsupported report format: ${reportConfig.format}`);
      }

      // 保存报告文件
      const fileName = `report_${reportId}_${Date.now()}.${fileExtension}`;
      const filePath = path.join(this.reportStoragePath, fileName);
      
      await fs.writeFile(filePath, reportContent, 'utf8');
      
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      const generationTime = Date.now() - startTime;
      
      this.logger.info('Report generated successfully', {
        reportId,
        filePath,
        fileSize,
        generationTime
      });

      return {
        success: true,
        reportId,
        filePath,
        fileSize
      };
    } catch (error) {
      this.logger.error('Report generation failed', { reportId, error: error.message });
      
      return {
        success: false,
        reportId,
        filePath: '',
        fileSize: 0,
        error: error.message
      };
    }
  }

  private async generateHTMLReport(reportData: ReportData): Promise<string> {
    try {
      const templatePath = path.join(this.templatePath, 'default.html');
      let template = await fs.readFile(templatePath, 'utf8');

      // 准备模板数据
      const templateData = {
        taskName: reportData.taskInfo.name,
        target: reportData.taskInfo.target,
        startTime: reportData.taskInfo.startTime.toLocaleString('zh-CN'),
        endTime: reportData.taskInfo.endTime.toLocaleString('zh-CN'),
        duration: Math.round(reportData.taskInfo.duration / 60000), // 转换为分钟
        critical: reportData.summary.critical,
        high: reportData.summary.high,
        medium: reportData.summary.medium,
        low: reportData.summary.low,
        info: reportData.summary.info,
        score: reportData.summary.score,
        vulnerabilities: reportData.vulnerabilities,
        recommendations: reportData.recommendations,
        methodology: reportData.methodology,
        generatedAt: new Date().toLocaleString('zh-CN')
      };

      // 简单的模板替换
      let html = template;
      Object.keys(templateData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, templateData[key]);
      });

      return html;
    } catch (error) {
      this.logger.error('HTML report generation failed', error);
      throw error;
    }
  }

  private async generateJSONReport(reportData: ReportData): Promise<string> {
    try {
      const jsonData = {
        metadata: {
          version: "1.0",
          generator: "AI Penetration Testing LLM-Agent",
          generatedAt: new Date().toISOString()
        },
        taskInfo: reportData.taskInfo,
        summary: reportData.summary,
        vulnerabilities: reportData.vulnerabilities,
        scanResults: reportData.scanResults,
        recommendations: reportData.recommendations,
        methodology: reportData.methodology
      };

      return JSON.stringify(jsonData, null, 2);
    } catch (error) {
      this.logger.error('JSON report generation failed', error);
      throw error;
    }
  }

  async getReport(reportId: string): Promise<{
    reportId: string;
    filePath: string;
    fileSize: number;
    createdAt: Date;
  } | null> {
    try {
      const files = await fs.readdir(this.reportStoragePath);
      const reportFile = files.find(file => file.includes(reportId));
      
      if (reportFile) {
        const filePath = path.join(this.reportStoragePath, reportFile);
        const stats = await fs.stat(filePath);
        
        return {
          reportId,
          filePath,
          fileSize: stats.size,
          createdAt: stats.birthtime
        };
      }
      
      return null;
    } catch (error) {
      this.logger.error('Failed to get report', { reportId, error: error.message });
      return null;
    }
  }

  async deleteReport(reportId: string): Promise<boolean> {
    try {
      const files = await fs.readdir(this.reportStoragePath);
      const reportFile = files.find(file => file.includes(reportId));
      
      if (reportFile) {
        const filePath = path.join(this.reportStoragePath, reportFile);
        await fs.unlink(filePath);
        
        this.logger.info('Report deleted', { reportId });
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to delete report', { reportId, error: error.message });
      return false;
    }
  }

  async getReportsList(): Promise<Array<{
    reportId: string;
    fileName: string;
    fileSize: number;
    createdAt: Date;
    format: string;
  }>> {
    try {
      const files = await fs.readdir(this.reportStoragePath);
      const reports = [];
      
      for (const file of files) {
        const filePath = path.join(this.reportStoragePath, file);
        const stats = await fs.stat(filePath);
        const reportId = file.split('_')[1];
        const format = path.extname(file).slice(1);
        
        reports.push({
          reportId,
          fileName: file,
          fileSize: stats.size,
          createdAt: stats.birthtime,
          format
        });
      }
      
      return reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      this.logger.error('Failed to get reports list', error);
      return [];
    }
  }
}
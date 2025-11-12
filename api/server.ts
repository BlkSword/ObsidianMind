import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { TaskManager } from './services/TaskManager';
import { ReportGenerator } from './services/ReportGenerator';
import { LLMService } from './services/ai/LLMService';
import { ToolManager } from './services/tools/ToolManager';
import { SqliteDB } from './db/sqlite';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 初始化服务
const taskManager = new TaskManager();
const reportGenerator = new ReportGenerator();
const llmService = new LLMService();
const toolManager = new ToolManager();
const appDb = new SqliteDB(path.join(process.cwd(), 'pentest.db'));

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

const runtimeConfig: any = { allowActiveAttacks: process.env.ALLOW_ACTIVE_ATTACKS === 'true', origins: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:5173'], rateLimit: { windowMs: 15 * 60 * 1000, max: 100 }, apiKeys: { openai: process.env.OPENAI_API_KEY || '', anthropic: process.env.ANTHROPIC_API_KEY || '', google: process.env.GOOGLE_API_KEY || '' } };
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (runtimeConfig.origins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// 速率限制
const limiter = rateLimit({ windowMs: runtimeConfig.rateLimit.windowMs, max: runtimeConfig.rateLimit.max, message: { error: '请求过于频繁，请稍后再试' } });

app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      llm: llmService.getHealthStatus(),
      tools: toolManager.getHealthStatus(),
      tasks: 'healthy'
    }
  });
});

// 任务管理API
app.post('/api/tasks', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.name || !payload.target || !payload.ai_model) {
      return res.status(400).json({ error: '缺少必需参数：name, target, ai_model' });
    }
    const provider = payload.ai_model.startsWith('gpt') ? 'openai' : payload.ai_model.startsWith('claude') ? 'anthropic' : 'gemini';
    const priorityMap: Record<string, number> = { low: 1, medium: 2, high: 3, urgent: 4 };
    const id = payload.id || `task_${Date.now()}`;
    const taskConfig = {
      id,
      name: payload.name,
      target: payload.target,
      aiModel: provider,
      aiModelConfig: {
        apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_API_KEY || '',
        model: payload.ai_model,
        temperature: 0.2,
        maxTokens: 2048
      },
      tools: Array.isArray(payload.tools) ? payload.tools : [],
      strategy: {
        type: payload.strategy === 'quick' ? 'fast' : payload.strategy,
        depth: 1,
        scope: [payload.target]
      },
      userId: 'anonymous',
      priority: priorityMap[payload.priority] || 2,
      scheduledAt: payload.scheduled_time ? new Date(payload.scheduled_time) : undefined
    };
    const result = await taskManager.createTask(taskConfig);
    res.json({ success: true, taskId: result.taskId, jobId: result.jobId, message: '任务创建成功' });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({ error: '创建任务失败', message: (error as any).message });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await taskManager.getAllTasks();
    res.json({
      success: true,
      tasks: tasks.map(task => ({
        jobId: task.jobId,
        taskId: task.taskId,
        status: task.status,
        progress: task.progress,
        currentStage: task.currentStage,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        vulnerabilities: task.vulnerabilities,
        logs: task.logs.slice(-10) // 只返回最近10条日志
      }))
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      error: '获取任务列表失败',
      message: error.message
    });
  }
});

app.get('/api/tasks/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const task = await taskManager.getTaskStatus(jobId);
    
    if (!task) {
      return res.status(404).json({
        error: '任务不存在'
      });
    }

    res.json({
      success: true,
      task: {
        jobId: task.jobId,
        taskId: task.taskId,
        status: task.status,
        progress: task.progress,
        currentStage: task.currentStage,
        results: task.results,
        vulnerabilities: task.vulnerabilities,
        logs: task.logs,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        error: task.error
      }
    });
  } catch (error) {
    console.error('获取任务状态失败:', error);
    res.status(500).json({
      error: '获取任务状态失败',
      message: error.message
    });
  }
});

app.get('/api/tasks/:jobId/logs', async (req, res) => {
  try {
    const { jobId } = req.params;
    const exec = await taskManager.getTaskStatus(jobId);
    if (!exec) return res.status(404).json({ error: '任务不存在' });
    const logs = await (taskManager as any).db?.getExecutions?.() ? exec.logs : exec.logs;
    res.json({ success: true, logs: logs.map((m) => ({ timestamp: Date.now(), level: (typeof m === 'string' && m.startsWith('ERROR')) ? 'error' : 'info', message: m })) });
  } catch (error) {
    res.status(500).json({ error: '获取日志失败', message: (error as any).message });
  }
});

app.post('/api/tasks/:jobId/pause', async (req, res) => {
  try {
    const { jobId } = req.params;
    const success = await taskManager.pauseTask(jobId);
    
    res.json({
      success,
      message: success ? '任务已暂停' : '暂停任务失败'
    });
  } catch (error) {
    console.error('暂停任务失败:', error);
    res.status(500).json({
      error: '暂停任务失败',
      message: error.message
    });
  }
});

app.post('/api/tasks/:jobId/resume', async (req, res) => {
  try {
    const { jobId } = req.params;
    const success = await taskManager.resumeTask(jobId);
    
    res.json({
      success,
      message: success ? '任务已恢复' : '恢复任务失败'
    });
  } catch (error) {
    console.error('恢复任务失败:', error);
    res.status(500).json({
      error: '恢复任务失败',
      message: error.message
    });
  }
});

app.delete('/api/tasks/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const success = await taskManager.cancelTask(jobId);
    
    res.json({
      success,
      message: success ? '任务已取消' : '取消任务失败'
    });
  } catch (error) {
    console.error('取消任务失败:', error);
    res.status(500).json({
      error: '取消任务失败',
      message: error.message
    });
  }
});

// 报告生成API
app.post('/api/reports', async (req, res) => {
  try {
    const { taskId, taskName, target, format, vulnerabilities, scanResults } = req.body;
    
    if (!taskId || !taskName || !target || !format) {
      return res.status(400).json({
        error: '缺少必需参数：taskId, taskName, target, format'
      });
    }

    const reportConfig = {
      taskId,
      taskName,
      target,
      format
    };

    const reportData = {
      taskInfo: {
        id: taskId,
        name: taskName,
        target,
        startTime: new Date(),
        endTime: new Date(),
        duration: 3600000, // 1小时示例
        status: 'completed'
      },
      summary: {
        totalVulnerabilities: vulnerabilities?.length || 0,
        critical: vulnerabilities?.filter(v => v.severity === 'critical').length || 0,
        high: vulnerabilities?.filter(v => v.severity === 'high').length || 0,
        medium: vulnerabilities?.filter(v => v.severity === 'medium').length || 0,
        low: vulnerabilities?.filter(v => v.severity === 'low').length || 0,
        info: vulnerabilities?.filter(v => v.severity === 'info').length || 0,
        score: 7.5
      },
      vulnerabilities: vulnerabilities || [],
      scanResults: scanResults || [],
      recommendations: [
        {
          category: '安全加固',
          priority: 'high',
          description: '建议对所有发现的漏洞进行修复',
          implementation: '按照报告中的修复建议逐一修复漏洞',
          timeline: '30天内完成'
        }
      ],
      methodology: {
        approach: 'AI驱动的自动化渗透测试',
        tools: ['nmap', 'sqlmap', 'nikto', 'custom AI tools'],
        scope: [target],
        limitations: ['时间限制', '网络访问限制']
      }
    };

    const result = await reportGenerator.generateReport(reportConfig, reportData);

    if (result.success) {
      res.json({
        success: true,
        reportId: result.reportId,
        filePath: result.filePath,
        fileSize: result.fileSize,
        message: '报告生成成功'
      });
    } else {
      res.status(500).json({
        error: '报告生成失败',
        message: result.error
      });
    }
  } catch (error) {
    console.error('生成报告失败:', error);
    res.status(500).json({
      error: '生成报告失败',
      message: error.message
    });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const reports = await reportGenerator.getReportsList();
    res.json({
      success: true,
      reports
    });
  } catch (error) {
    console.error('获取报告列表失败:', error);
    res.status(500).json({
      error: '获取报告列表失败',
      message: error.message
    });
  }
});

app.get('/api/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await reportGenerator.getReport(reportId);
    
    if (!report) {
      return res.status(404).json({
        error: '报告不存在'
      });
    }

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('获取报告失败:', error);
    res.status(500).json({
      error: '获取报告失败',
      message: error.message
    });
  }
});

app.delete('/api/reports/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const success = await reportGenerator.deleteReport(reportId);
    
    res.json({
      success,
      message: success ? '报告已删除' : '删除报告失败'
    });
  } catch (error) {
    console.error('删除报告失败:', error);
    res.status(500).json({
      error: '删除报告失败',
      message: error.message
    });
  }
});

// 工具管理API
app.get('/api/tools', async (req, res) => {
  try {
    const tools = toolManager.getAvailableTools();
    res.json({
      success: true,
      tools
    });
  } catch (error) {
    console.error('获取工具列表失败:', error);
    res.status(500).json({
      error: '获取工具列表失败',
      message: error.message
    });
  }
});

app.get('/api/tools/status', async (req, res) => {
  try {
    const status = await toolManager.getHealthStatus();
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('获取工具状态失败:', error);
    res.status(500).json({
      error: '获取工具状态失败',
      message: error.message
    });
  }
});

// AI模型管理API
app.get('/api/ai/models', (req, res) => {
  res.json({
    success: true,
    models: [
      {
        provider: 'openai',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        description: 'OpenAI GPT系列模型'
      },
      {
        provider: 'anthropic',
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        description: 'Anthropic Claude系列模型'
      },
      {
        provider: 'gemini',
        models: ['gemini-pro', 'gemini-pro-vision'],
        description: 'Google Gemini系列模型'
      }
    ]
  });
});

app.get('/api/ai/status', (req, res) => {
  try {
    const status = llmService.getHealthStatus();
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('获取AI服务状态失败:', error);
    res.status(500).json({
      error: '获取AI服务状态失败',
      message: error.message
    });
  }
});

// 系统状态API
app.get('/api/system/stats', async (req, res) => {
  try {
    const taskStats = await taskManager.getTaskQueueStats();
    
    res.json({
      success: true,
      stats: {
        tasks: taskStats,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        }
      }
    });
  } catch (error) {
    console.error('获取系统统计失败:', error);
    res.status(500).json({
      error: '获取系统统计失败',
      message: error.message
    });
  }
});

app.get('/api/system/config', (req, res) => {
  res.json({ success: true, config: runtimeConfig });
});
app.post('/api/system/config', (req, res) => {
  try {
    const { allowActiveAttacks, origins, rateLimit, apiKeys } = req.body || {};
    if (Array.isArray(origins)) runtimeConfig.origins = origins;
    if (rateLimit && rateLimit.windowMs && rateLimit.max) runtimeConfig.rateLimit = rateLimit;
    if (apiKeys) {
      runtimeConfig.apiKeys = apiKeys;
      process.env.OPENAI_API_KEY = apiKeys.openai || '';
      process.env.ANTHROPIC_API_KEY = apiKeys.anthropic || '';
      process.env.GOOGLE_API_KEY = apiKeys.google || '';
    }
    runtimeConfig.allowActiveAttacks = !!allowActiveAttacks;
    process.env.ALLOW_ACTIVE_ATTACKS = runtimeConfig.allowActiveAttacks ? 'true' : 'false';
    res.json({ success: true, config: runtimeConfig });
  } catch (error) {
    res.status(500).json({ error: '配置更新失败', message: (error as any).message });
  }
});

app.get('/api/users', async (req, res) => {
  const users = await appDb.getUsers();
  res.json({ success: true, users });
});
app.post('/api/users', async (req, res) => {
  const { name, email, role } = req.body || {};
  if (!name || !email || !role) return res.status(400).json({ error: '缺少必填字段' });
  const id = `u_${Date.now()}`;
  await appDb.upsertUser({ id, name, email, role, status: 'active', createdAt: Date.now() });
  res.json({ success: true, id });
});
app.patch('/api/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: '缺少状态' });
  await appDb.updateUserStatus(id, status);
  res.json({ success: true });
});
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  await appDb.deleteUser(id);
  res.json({ success: true });
});

app.get('/api/tasks/:jobId/report', async (req, res) => {
  try {
    const { jobId } = req.params;
    const format = (req.query.format as string) || 'html';
    const task = await taskManager.getTaskStatus(jobId);
    if (!task) return res.status(404).json({ error: '任务不存在' });
    const reportData = {
      taskInfo: {
        id: task.taskId,
        name: task.taskId,
        target: '',
        startTime: task.startedAt || new Date(),
        endTime: task.completedAt || new Date(),
        duration: task.completedAt && task.startedAt ? (task.completedAt.getTime() - task.startedAt.getTime()) : 0,
        status: task.status
      },
      summary: {
        totalVulnerabilities: task.vulnerabilities?.length || 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        score: 0
      },
      vulnerabilities: task.vulnerabilities || [],
      scanResults: task.results || []
    };
    const result = await reportGenerator.generateReport({ taskId: task.taskId, taskName: task.taskId, target: '', format }, reportData as any);
    if (!result.success) return res.status(500).json({ error: '报告生成失败', message: result.error });
    if (format === 'json') {
      return res.json({ success: true, filePath: result.filePath });
    }
    res.sendFile(result.filePath);
  } catch (error) {
    res.status(500).json({ error: '生成或获取报告失败', message: (error as any).message });
  }
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message || '未知错误'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.originalUrl
  });
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`🚀 AI渗透测试LLM-Agent服务器运行在端口 ${PORT}`);
  console.log(`📋 API文档: http://localhost:${PORT}/api/health`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('正在关闭服务器...');
  await taskManager.cleanup();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

export default app;

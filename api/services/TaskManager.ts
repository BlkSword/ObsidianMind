import Bull from 'bull';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import path from 'path';
import { LLMService } from '../services/ai/LLMService';
import { PentestChainEngine } from '../services/pentest/PentestChainEngine';
import { ToolManager } from '../services/tools/ToolManager';
import { POCManager } from '../services/poc/POCManager';
import { SqliteDB } from '../db/sqlite';

export interface TaskConfig {
  id: string;
  name: string;
  target: string;
  aiModel: 'openai' | 'anthropic' | 'gemini';
  aiModelConfig: {
    apiKey: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  tools: string[];
  strategy: {
    type: 'comprehensive' | 'fast' | 'deep' | 'custom';
    depth: number;
    scope: string[];
    excludeRules?: string[];
  };
  userId: string;
  priority: number;
  scheduledAt?: Date;
}

export interface TaskExecution {
  jobId: string;
  taskId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStage: string;
  results: any[];
  vulnerabilities: any[];
  logs: string[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export class TaskManager {
  private taskQueue: Bull.Queue;
  private executionQueue: Bull.Queue;
  private logger: winston.Logger;
  private llmService: LLMService;
  private pentestEngine: PentestChainEngine;
  private toolManager: ToolManager;
  private pocManager: POCManager;
  private activeExecutions: Map<string, TaskExecution>;
  private db: SqliteDB;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'logs/task-manager.log' }),
        new winston.transports.Console()
      ]
    });

    // 初始化队列
    this.taskQueue = new Bull('pentest-tasks', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      },
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    this.executionQueue = new Bull('task-executions', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });

    // 初始化服务
    this.llmService = new LLMService();
    this.pentestEngine = new PentestChainEngine(this.llmService, this.toolManager);
    this.toolManager = new ToolManager();
    this.pocManager = new POCManager();
    
    this.activeExecutions = new Map();
    this.db = new SqliteDB(path.join(process.cwd(), 'pentest.db'));

    this.setupQueueProcessors();
  }

  private setupQueueProcessors(): void {
    // 任务执行处理器
    this.taskQueue.process('pentest-task', 5, async (job) => {
      return await this.executeTask(job.data);
    });

    // 任务状态更新处理器
    this.executionQueue.process('update-status', async (job) => {
      const { jobId, status, progress, stage } = job.data;
      await this.updateExecutionStatus(jobId, status, progress, stage);
    });

    // 设置事件监听
    this.taskQueue.on('completed', (job) => {
      this.logger.info('Task completed', { jobId: job.id, taskId: job.data.taskId });
    });

    this.taskQueue.on('failed', (job, err) => {
      this.logger.error('Task failed', { jobId: job.id, error: err.message });
    });
  }

  async createTask(taskConfig: TaskConfig): Promise<{ taskId: string; jobId: string }> {
    try {
      const jobId = uuidv4();
      
      // 初始化任务执行记录
      const execution: TaskExecution = {
        jobId,
        taskId: taskConfig.id,
        status: 'pending',
        progress: 0,
        currentStage: '初始化中',
        results: [],
        vulnerabilities: [],
        logs: []
      };
      this.db.appendLog({ id: uuidv4(), jobId, message: `INFO: 任务创建: ${taskConfig.name}`, ts: Date.now() });

      this.activeExecutions.set(jobId, execution);
      await this.db.upsertTask({
        id: taskConfig.id,
        name: taskConfig.name,
        target: taskConfig.target,
        aiModel: taskConfig.aiModel,
        priority: taskConfig.priority,
        scheduledAt: taskConfig.scheduledAt ? taskConfig.scheduledAt.getTime() : undefined,
        createdAt: Date.now()
      });
      await this.db.upsertExecution({
        jobId,
        taskId: taskConfig.id,
        status: 'pending',
        progress: 0,
        currentStage: '初始化中',
        startedAt: undefined,
        completedAt: undefined,
        error: undefined
      });

      // 添加任务到队列
      try {
        await this.taskQueue.add('pentest-task', {
          jobId,
          taskConfig,
          timestamp: new Date()
        }, {
          priority: taskConfig.priority,
          delay: taskConfig.scheduledAt ? taskConfig.scheduledAt.getTime() - Date.now() : 0
        });
      } catch (e) {
        this.logger.warn('Queue unavailable, executing task inline', { error: (e as any).message });
        setImmediate(async () => {
          try {
            await this.executeTask({ jobId, taskConfig });
          } catch (err) {
            this.logger.error('Inline execution failed', { jobId, error: (err as any).message });
          }
        });
      }

      this.logger.info('Task created', { taskId: taskConfig.id, jobId });

      return {
        taskId: taskConfig.id,
        jobId
      };
    } catch (error) {
      this.logger.error('Failed to create task', error);
      throw error;
    }
  }

  private async executeTask(data: any): Promise<any> {
    const { jobId, taskConfig } = data;
    const execution = this.activeExecutions.get(jobId);
    
    if (!execution) {
      throw new Error('Task execution not found');
    }

    try {
      execution.status = 'running';
      execution.startedAt = new Date();
      execution.currentStage = '初始化AI服务';

      await this.db.upsertExecution({
        jobId,
        taskId: taskConfig.id,
        status: 'running',
        progress: execution.progress,
        currentStage: execution.currentStage,
        startedAt: execution.startedAt.getTime(),
        completedAt: undefined,
        error: undefined
      });
      
      this.logger.info('Starting task execution', { jobId, taskId: taskConfig.id });

      await this.db.upsertExecution({
        jobId,
        taskId: taskConfig.id,
        status: 'running',
        progress: execution.progress,
        currentStage: execution.currentStage,
        startedAt: Date.now(),
        completedAt: undefined,
        error: undefined
      });

      // 1. 初始化AI服务
      await this.initializeAIService({ ...taskConfig.aiModelConfig, provider: taskConfig.aiModel });
      execution.progress = 10;
      execution.currentStage = '目标分析';
      await this.updateExecutionProgress(jobId, 10, '目标分析');

      // 2. 执行渗透测试链
      const chainResult = await this.executePentestChain(taskConfig, execution);
      
      execution.results = chainResult.results;
      execution.vulnerabilities = chainResult.vulnerabilities;
      execution.progress = 80;
      execution.currentStage = '生成报告';
      await this.updateExecutionProgress(jobId, 80, '生成报告');

      // 3. 生成最终报告
      const report = await this.generateReport(taskConfig, execution);
      
      execution.progress = 100;
      execution.currentStage = '任务完成';
      execution.status = 'completed';
      execution.completedAt = new Date();

      await this.updateExecutionProgress(jobId, 100, '任务完成');

      await this.db.upsertExecution({
        jobId,
        taskId: taskConfig.id,
        status: 'completed',
        progress: 100,
        currentStage: '任务完成',
        startedAt: execution.startedAt!.getTime(),
        completedAt: execution.completedAt!.getTime(),
        error: undefined
      });

      await this.db.upsertExecution({
        jobId,
        taskId: taskConfig.id,
        status: 'completed',
        progress: 100,
        currentStage: '任务完成',
        startedAt: execution.startedAt!.getTime(),
        completedAt: execution.completedAt!.getTime(),
        error: undefined
      });

      this.logger.info('Task execution completed', { jobId, taskId: taskConfig.id });

      return {
        success: true,
        taskId: taskConfig.id,
        jobId,
        results: chainResult.results,
        vulnerabilities: chainResult.vulnerabilities,
        report,
        executionTime: Date.now() - execution.startedAt!.getTime()
      };
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date();
      execution.logs.push(`任务失败: ${error.message}`);

      this.logger.error('Task execution failed', { jobId, error: error.message });

      await this.db.upsertExecution({
        jobId,
        taskId: taskConfig.id,
        status: 'failed',
        progress: execution.progress,
        currentStage: execution.currentStage,
        startedAt: execution.startedAt ? execution.startedAt.getTime() : undefined,
        completedAt: execution.completedAt.getTime(),
        error: error.message
      });

      throw error;
    }
  }

  private async initializeAIService(config: any): Promise<void> {
    try {
      this.llmService.initialize({
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        temperature: config.temperature || 0.3,
        maxTokens: config.maxTokens || 2048
      });
    } catch (error) {
      this.logger.error('Failed to initialize AI service', error);
      throw error;
    }
  }

  private async executePentestChain(taskConfig: TaskConfig, execution: TaskExecution): Promise<{
    results: any[];
    vulnerabilities: any[];
  }> {
    try {
      execution.currentStage = '执行渗透测试链';
      execution.logs.push('INFO: 开始执行渗透测试链');
      this.db.appendLog({ id: uuidv4(), jobId: execution.jobId, message: 'INFO: 开始执行渗透测试链', ts: Date.now() });

      const llmConfig = {
        provider: taskConfig.aiModel,
        model: taskConfig.aiModelConfig.model,
        apiKey: taskConfig.aiModelConfig.apiKey
      };

      const result = await this.pentestEngine.executeChain(
        taskConfig.id,
        taskConfig.target,
        llmConfig
      );

      if (!result.success) {
        throw new Error('Pentest chain execution failed');
      }

      execution.logs.push(`渗透测试链执行完成，发现 ${result.vulnerabilities.length} 个漏洞`);

      // 执行POC验证
      if (result.vulnerabilities.length > 0) {
        execution.currentStage = 'POC漏洞验证';
        await this.updateExecutionProgress(execution.jobId, 60, 'POC漏洞验证');
        
        for (const vulnerability of result.vulnerabilities) {
          try {
            const pocCode = await this.pocManager.generatePOCCode(vulnerability);
            const pocExecution = {
              id: uuidv4(),
              vulnerabilityId: vulnerability.id,
              code: pocCode.code,
              language: pocCode.language,
              description: pocCode.description,
              target: taskConfig.target,
              parameters: {},
              timeout: 30000,
              sandboxed: true
            };

            const pocResult = await this.pocManager.executePOC(pocExecution);
            
            if (pocResult.vulnerabilityConfirmed) {
              vulnerability.pocVerified = true;
              vulnerability.pocResult = pocResult;
              execution.logs.push(`INFO: 漏洞 ${vulnerability.title} POC验证成功`);
              this.db.appendLog({ id: uuidv4(), jobId: execution.jobId, message: `INFO: 漏洞 ${vulnerability.title} POC验证成功`, ts: Date.now() });
            }
          } catch (error) {
            this.logger.error('POC execution failed', { vulnerabilityId: vulnerability.id, error: error.message });
          }
        }
      }

      return {
        results: result.results,
        vulnerabilities: result.vulnerabilities
      };
    } catch (error) {
      this.logger.error('Pentest chain execution failed', error);
      throw error;
    }
  }

  private async generateReport(taskConfig: TaskConfig, execution: TaskExecution): Promise<any> {
    try {
      execution.logs.push('INFO: 生成渗透测试报告');
      this.db.appendLog({ id: uuidv4(), jobId: execution.jobId, message: 'INFO: 生成渗透测试报告', ts: Date.now() });

      const report = {
        taskId: taskConfig.id,
        taskName: taskConfig.name,
        target: taskConfig.target,
        executionTime: execution.completedAt!.getTime() - execution.startedAt!.getTime(),
        vulnerabilities: execution.vulnerabilities,
        results: execution.results,
        summary: {
          totalVulnerabilities: execution.vulnerabilities.length,
          critical: execution.vulnerabilities.filter(v => v.severity === 'critical').length,
          high: execution.vulnerabilities.filter(v => v.severity === 'high').length,
          medium: execution.vulnerabilities.filter(v => v.severity === 'medium').length,
          low: execution.vulnerabilities.filter(v => v.severity === 'low').length
        },
        generatedAt: new Date()
      };

      return report;
    } catch (error) {
      this.logger.error('Report generation failed', error);
      throw error;
    }
  }

  async getTaskStatus(jobId: string): Promise<TaskExecution | null> {
    const inMem = this.activeExecutions.get(jobId);
    if (inMem) return inMem;
    const row = await this.db.getExecution(jobId);
    if (!row) return null;
    const logsRows = await this.db.getLogs(jobId);
    const logs = logsRows.map(l => l.message);
    return {
      jobId: row.jobId,
      taskId: row.taskId,
      status: row.status as any,
      progress: row.progress,
      currentStage: row.currentStage,
      results: [],
      vulnerabilities: [],
      logs,
      startedAt: row.startedAt ? new Date(row.startedAt) : undefined,
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      error: row.error
    };
  }

  async getAllTasks(): Promise<TaskExecution[]> {
    const rows = await this.db.getExecutions();
    const list: TaskExecution[] = rows.map(r => ({
      jobId: r.jobId,
      taskId: r.taskId,
      status: r.status as any,
      progress: r.progress,
      currentStage: r.currentStage,
      results: [],
      vulnerabilities: [],
      logs: [],
      startedAt: r.startedAt ? new Date(r.startedAt) : undefined,
      completedAt: r.completedAt ? new Date(r.completedAt) : undefined,
      error: r.error
    }))
    for (const e of this.activeExecutions.values()) {
      const idx = list.findIndex(x => x.jobId === e.jobId);
      if (idx >= 0) list[idx] = e; else list.push(e);
    }
    return list;
  }

  async pauseTask(jobId: string): Promise<boolean> {
    try {
      const job = await this.taskQueue.getJob(jobId);
      if (job) {
        await job.pause();
        
        const execution = this.activeExecutions.get(jobId);
        if (execution) {
          execution.status = 'paused';
        }
        
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to pause task', { jobId, error: error.message });
      return false;
    }
  }

  async resumeTask(jobId: string): Promise<boolean> {
    try {
      const job = await this.taskQueue.getJob(jobId);
      if (job) {
        await job.resume();
        
        const execution = this.activeExecutions.get(jobId);
        if (execution) {
          execution.status = 'running';
        }
        
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to resume task', { jobId, error: error.message });
      return false;
    }
  }

  async cancelTask(jobId: string): Promise<boolean> {
    try {
      const job = await this.taskQueue.getJob(jobId);
      if (job) {
        await job.remove();
        
        const execution = this.activeExecutions.get(jobId);
        if (execution) {
          execution.status = 'cancelled';
          execution.completedAt = new Date();
        }
        
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to cancel task', { jobId, error: error.message });
      return false;
    }
  }

  private async updateExecutionProgress(jobId: string, progress: number, stage: string): Promise<void> {
    const execution = this.activeExecutions.get(jobId);
    if (execution) {
      execution.progress = progress;
      execution.currentStage = stage;
      execution.logs.push(`INFO: ${stage} - ${progress}%`);
      this.db.appendLog({ id: uuidv4(), jobId, message: `INFO: ${stage} - ${progress}%`, ts: Date.now() });
      this.db.upsertExecution({
        jobId,
        taskId: execution.taskId,
        status: execution.status,
        progress,
        currentStage: stage,
        startedAt: execution.startedAt ? execution.startedAt.getTime() : undefined,
        completedAt: execution.completedAt ? execution.completedAt.getTime() : undefined,
        error: execution.error
      });
    }
  }

  private async updateExecutionStatus(jobId: string, status: string, progress: number, stage: string): Promise<void> {
    const execution = this.activeExecutions.get(jobId);
    if (execution) {
      execution.status = status as any;
      execution.progress = progress;
      execution.currentStage = stage;
    }
  }

  async getTaskQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    return {
      waiting: await this.taskQueue.getWaitingCount(),
      active: await this.taskQueue.getActiveCount(),
      completed: await this.taskQueue.getCompletedCount(),
      failed: await this.taskQueue.getFailedCount(),
      delayed: await this.taskQueue.getDelayedCount()
    };
  }

  async cleanup(): Promise<void> {
    await this.taskQueue.close();
    await this.executionQueue.close();
  }
}

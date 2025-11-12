import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import winston from 'winston';

const execAsync = promisify(exec);

export interface ToolConfig {
  name: string;
  command: string;
  version: string;
  timeout: number;
  allowedArgs: string[];
  outputFormat: 'json' | 'xml' | 'text';
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  parsedData?: any;
}

export interface ToolExecution {
  toolName: string;
  args: string[];
  target: string;
  timeout?: number;
}

export class ToolManager {
  private tools: Map<string, ToolConfig> = new Map();
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'logs/tool-manager.log' }),
        new winston.transports.Console()
      ]
    });

    this.initializeDefaultTools();
  }

  private initializeDefaultTools(): void {
    // Nmap 配置
    this.tools.set('nmap', {
      name: 'nmap',
      command: 'nmap',
      version: '7.93',
      timeout: 300000, // 5分钟
      allowedArgs: ['-sS', '-sT', '-sU', '-O', '-sV', '-p', '-Pn', '-A', '-T4'],
      outputFormat: 'text'
    });

    // SQLMap 配置
    this.tools.set('sqlmap', {
      name: 'sqlmap',
      command: 'sqlmap',
      version: '1.7',
      timeout: 600000, // 10分钟
      allowedArgs: ['--batch', '--random-agent', '--level', '--risk', '--threads'],
      outputFormat: 'text'
    });

    // Nikto 配置
    this.tools.set('nikto', {
      name: 'nikto',
      command: 'nikto',
      version: '2.5.0',
      timeout: 300000,
      allowedArgs: ['-h', '-p', '-Tuning', '-Plugins'],
      outputFormat: 'text'
    });

    // Dirb 配置
    this.tools.set('dirb', {
      name: 'dirb',
      command: 'dirb',
      version: '2.22',
      timeout: 300000,
      allowedArgs: ['-w', '-t', '-r', '-l'],
      outputFormat: 'text'
    });
  }

  async executeTool(execution: ToolExecution): Promise<ToolResult> {
    const startTime = Date.now();
    const toolConfig = this.tools.get(execution.toolName);

    if (!toolConfig) {
      return {
        success: false,
        output: '',
        error: `Tool ${execution.toolName} not found`,
        exitCode: -1,
        executionTime: Date.now() - startTime
      };
    }

    // 验证参数安全性
    const validationResult = this.validateArgs(execution.args, toolConfig.allowedArgs);
    if (!validationResult.valid) {
      return {
        success: false,
        output: '',
        error: validationResult.error,
        exitCode: -1,
        executionTime: Date.now() - startTime
      };
    }

    try {
      this.logger.info(`Executing tool: ${execution.toolName}`, {
        target: execution.target,
        args: execution.args
      });

      // 构建命令
      const command = this.buildCommand(toolConfig, execution);
      const timeout = execution.timeout || toolConfig.timeout;

      // 执行命令
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        killSignal: 'SIGTERM',
        maxBuffer: 50 * 1024 * 1024 // 50MB 输出限制
      });

      const executionTime = Date.now() - startTime;

      // 解析输出
      const parsedData = this.parseOutput(stdout, toolConfig.outputFormat, execution.toolName);

      this.logger.info(`Tool execution completed`, {
        tool: execution.toolName,
        executionTime,
        exitCode: 0
      });

      return {
        success: true,
        output: stdout,
        error: stderr || undefined,
        exitCode: 0,
        executionTime,
        parsedData
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error(`Tool execution failed`, {
        tool: execution.toolName,
        executionTime,
        error: error.message
      });

      return {
        success: false,
        output: error.stdout || '',
        error: error.message,
        exitCode: error.code || -1,
        executionTime
      };
    }
  }

  private validateArgs(args: string[], allowedArgs: string[]): { valid: boolean; error?: string } {
    for (const arg of args) {
      // 检查是否包含危险字符
      if (/[;&|`$]/.test(arg)) {
        return { valid: false, error: `Argument contains dangerous characters: ${arg}` };
      }

      // 检查是否在允许列表中（对于以-开头的参数）
      if (arg.startsWith('-')) {
        const baseArg = arg.split(' ')[0];
        if (!allowedArgs.some(allowed => baseArg.startsWith(allowed))) {
          return { valid: false, error: `Argument not allowed: ${arg}` };
        }
      }
    }

    return { valid: true };
  }

  private buildCommand(toolConfig: ToolConfig, execution: ToolExecution): string {
    const args = execution.args.join(' ');
    return `${toolConfig.command} ${args} ${execution.target}`;
  }

  private parseOutput(output: string, format: string, toolName: string): any {
    try {
      switch (toolName) {
        case 'nmap':
          return this.parseNmapOutput(output);
        case 'sqlmap':
          return this.parseSqlmapOutput(output);
        case 'nikto':
          return this.parseNiktoOutput(output);
        case 'dirb':
          return this.parseDirbOutput(output);
        default:
          return { raw: output };
      }
    } catch (error) {
      this.logger.error('Failed to parse tool output', { toolName, error: error.message });
      return { raw: output };
    }
  }

  private parseNmapOutput(output: string): any {
    const result: any = {
      ports: [],
      services: [],
      os: null
    };

    // 解析端口信息
    const portRegex = /^(\d+)\/(tcp|udp)\s+(open|closed|filtered)\s+(.+?)(?:\s+(.+))?$/gm;
    let match;
    while ((match = portRegex.exec(output)) !== null) {
      result.ports.push({
        port: parseInt(match[1]),
        protocol: match[2],
        state: match[3],
        service: match[4] || 'unknown',
        version: match[5] || null
      });
    }

    // 解析操作系统信息
    const osRegex = /OS details:\s+(.+)$/m;
    const osMatch = output.match(osRegex);
    if (osMatch) {
      result.os = osMatch[1].trim();
    }

    return result;
  }

  private parseSqlmapOutput(output: string): any {
    const result: any = {
      vulnerabilities: [],
      databases: [],
      tables: []
    };

    // 解析SQL注入漏洞
    if (output.includes('Parameter:') && output.includes('is vulnerable')) {
      const paramRegex = /Parameter:\s+(.+?)\s+\((.+?)\)/g;
      let match;
      while ((match = paramRegex.exec(output)) !== null) {
        result.vulnerabilities.push({
          parameter: match[1],
          type: match[2],
          severity: 'high'
        });
      }
    }

    // 解析数据库信息
    if (output.includes('available databases')) {
      const dbRegex = /\[(\d+)\]\s+(.+)$/gm;
      let match;
      while ((match = dbRegex.exec(output)) !== null) {
        result.databases.push(match[2].trim());
      }
    }

    return result;
  }

  private parseNiktoOutput(output: string): any {
    const result: any = {
      vulnerabilities: [],
      server: null,
      items: []
    };

    // 解析服务器信息
    const serverRegex = /\+ Server:\s+(.+)$/m;
    const serverMatch = output.match(serverRegex);
    if (serverMatch) {
      result.server = serverMatch[1].trim();
    }

    // 解析发现的漏洞
    const vulnRegex = /\+\s+(.+?):\s+(.+)$/gm;
    let match;
    while ((match = vulnRegex.exec(output)) !== null) {
      result.vulnerabilities.push({
        category: match[1].trim(),
        description: match[2].trim()
      });
    }

    return result;
  }

  private parseDirbOutput(output: string): any {
    const result: any = {
      directories: [],
      files: [],
      totalFound: 0
    };

    // 解析发现的目录和文件
    const itemRegex = /^\+\s+http:\/\/\S+\/(\S+)\s+\((.+?)\)$/gm;
    let match;
    while ((match = itemRegex.exec(output)) !== null) {
      const path = match[1];
      const status = match[2];
      
      if (path.endsWith('/')) {
        result.directories.push({ path, status });
      } else {
        result.files.push({ path, status });
      }
    }

    result.totalFound = result.directories.length + result.files.length;
    return result;
  }

  async validateTool(toolName: string): Promise<{
    available: boolean;
    version?: string;
    error?: string;
  }> {
    const toolConfig = this.tools.get(toolName);
    if (!toolConfig) {
      return { available: false, error: 'Tool not configured' };
    }

    try {
      const { stdout } = await execAsync(`${toolConfig.command} --version`, { timeout: 10000 });
      return {
        available: true,
        version: stdout.trim()
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  getAvailableTools(): ToolConfig[] {
    return Array.from(this.tools.values());
  }

  addTool(toolConfig: ToolConfig): void {
    this.tools.set(toolConfig.name, toolConfig);
    this.logger.info(`Added new tool: ${toolConfig.name}`);
  }

  removeTool(toolName: string): boolean {
    const result = this.tools.delete(toolName);
    if (result) {
      this.logger.info(`Removed tool: ${toolName}`);
    }
    return result;
  }

  getToolConfig(toolName: string): ToolConfig | undefined {
    return this.tools.get(toolName);
  }

  async getHealthStatus(): Promise<{
    status: string;
    tools: Record<string, {
      available: boolean;
      version?: string;
      error?: string;
    }>;
  }> {
    const toolStatus: Record<string, any> = {};
    
    for (const [toolName] of this.tools) {
      toolStatus[toolName] = await this.validateTool(toolName);
    }

    const allAvailable = Object.values(toolStatus).every((status: any) => status.available);

    return {
      status: allAvailable ? 'healthy' : 'degraded',
      tools: toolStatus
    };
  }
}
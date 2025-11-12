import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface LLMRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  functions?: Array<{
    name: string;
    description: string;
    parameters: object;
  }>;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  id: string;
  content: string;
  functionCall?: {
    name: string;
    arguments: any;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  timestamp: Date;
}

export class LLMService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'logs/ai-service.log' }),
        new winston.transports.Console()
      ]
    });
  }

  initialize(config: LLMConfig): void {
    try {
      switch (config.provider) {
        case 'openai':
          this.openai = new OpenAI({
            apiKey: config.apiKey,
            timeout: config.timeout || 30000
          });
          break;
        case 'anthropic':
          this.anthropic = new Anthropic({
            apiKey: config.apiKey,
            timeout: config.timeout || 30000
          });
          break;
        case 'gemini':
          this.gemini = new GoogleGenerativeAI(config.apiKey);
          break;
        default:
          throw new Error(`Unsupported LLM provider: ${config.provider}`);
      }
      this.logger.info(`LLM service initialized with ${config.provider}`);
    } catch (error) {
      this.logger.error('Failed to initialize LLM service:', error);
      throw error;
    }
  }

  async generateResponse(request: LLMRequest, config: LLMConfig): Promise<LLMResponse> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      this.logger.info(`LLM request started`, { requestId, provider: config.provider, model: config.model });

      let response: LLMResponse;

      switch (config.provider) {
        case 'openai':
          response = await this.callOpenAI(request, config);
          break;
        case 'anthropic':
          response = await this.callAnthropic(request, config);
          break;
        case 'gemini':
          response = await this.callGemini(request, config);
          break;
        default:
          throw new Error(`Unsupported LLM provider: ${config.provider}`);
      }

      const duration = Date.now() - startTime;
      this.logger.info(`LLM request completed`, { 
        requestId, 
        duration, 
        tokens: response.usage.totalTokens 
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`LLM request failed`, { requestId, duration, error: error.message });
      throw error;
    }
  }

  private async callOpenAI(request: LLMRequest, config: LLMConfig): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const completion = await this.openai.chat.completions.create({
      model: config.model,
      messages: request.messages,
      max_tokens: request.maxTokens || config.maxTokens || 2048,
      temperature: request.temperature || config.temperature || 0.3,
      functions: request.functions,
      function_call: request.functions ? 'auto' : undefined
    });

    const choice = completion.choices[0];
    const message = choice.message;

    return {
      id: completion.id,
      content: message.content || '',
      functionCall: message.function_call ? {
        name: message.function_call.name,
        arguments: JSON.parse(message.function_call.arguments || '{}')
      } : undefined,
      usage: {
        promptTokens: completion.usage?.prompt_tokens || 0,
        completionTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0
      },
      model: completion.model,
      timestamp: new Date()
    };
  }

  private async callAnthropic(request: LLMRequest, config: LLMConfig): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const systemMessage = request.messages.find(m => m.role === 'system')?.content || '';
    const userMessages = request.messages.filter(m => m.role !== 'system');

    const response = await this.anthropic.messages.create({
      model: config.model,
      max_tokens: request.maxTokens || config.maxTokens || 2048,
      temperature: request.temperature || config.temperature || 0.3,
      system: systemMessage,
      messages: userMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    });

    const content = response.content[0];
    const textContent = content.type === 'text' ? content.text : '';

    return {
      id: response.id,
      content: textContent,
      usage: {
        promptTokens: response.usage.input_tokens || 0,
        completionTokens: response.usage.output_tokens || 0,
        totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
      },
      model: response.model,
      timestamp: new Date()
    };
  }

  private async callGemini(request: LLMRequest, config: LLMConfig): Promise<LLMResponse> {
    if (!this.gemini) {
      throw new Error('Gemini client not initialized');
    }

    const model = this.gemini.getGenerativeModel({ model: config.model });
    
    const prompt = request.messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Note: Gemini doesn't provide detailed token usage in the free tier
    return {
      id: uuidv4(),
      content: text,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      model: config.model,
      timestamp: new Date()
    };
  }

  async analyzePentestResults(scanResults: any[], context: any): Promise<{
    analysis: string;
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const prompt = `
      作为一位专业的渗透测试专家，请分析以下扫描结果并提供专业的安全评估：
      
      扫描结果：${JSON.stringify(scanResults, null, 2)}
      
      目标上下文：${JSON.stringify(context, null, 2)}
      
      请提供：
      1. 详细的安全分析
      2. 具体的修复建议
      3. 风险等级评估（low/medium/high/critical）
      
      请以JSON格式返回结果，包含analysis、recommendations和riskLevel字段。
    `;

    const request: LLMRequest = {
      messages: [
        { role: 'system', content: '你是一个专业的网络安全专家，具有丰富的渗透测试经验。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    };

    const response = await this.generateResponse(request, { 
      provider: 'openai', 
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    try {
      const result = JSON.parse(response.content);
      return {
        analysis: result.analysis || '分析失败',
        recommendations: result.recommendations || [],
        riskLevel: result.riskLevel || 'medium'
      };
    } catch (error) {
      this.logger.error('Failed to parse AI analysis result', error);
      return {
        analysis: response.content,
        recommendations: [],
        riskLevel: 'medium'
      };
    }
  }

  async generatePocCode(vulnerability: any): Promise<{
    code: string;
    language: string;
    description: string;
  }> {
    const prompt = `
      请为以下漏洞生成验证代码（POC）：
      
      漏洞类型：${vulnerability.type}
      漏洞描述：${vulnerability.description}
      影响组件：${vulnerability.component}
      严重程度：${vulnerability.severity}
      
      要求：
      1. 代码应该能够验证漏洞的存在
      2. 代码应该是安全的，不会造成破坏
      3. 包含必要的错误处理
      4. 提供详细的使用说明
      
      请以JSON格式返回结果，包含code、language和description字段。
    `;

    const request: LLMRequest = {
      messages: [
        { role: 'system', content: '你是一个专业的安全研究员，擅长编写漏洞验证代码。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    };

    const response = await this.generateResponse(request, { 
      provider: 'openai', 
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    try {
      const result = JSON.parse(response.content);
      return {
        code: result.code || '',
        language: result.language || 'python',
        description: result.description || ''
      };
    } catch (error) {
      this.logger.error('Failed to parse POC generation result', error);
      return {
        code: response.content,
        language: 'python',
        description: 'POC代码生成失败'
      };
    }
  }

  getHealthStatus(): { status: string; providers: Record<string, boolean> } {
    return {
      status: 'healthy',
      providers: {
        openai: !!this.openai,
        anthropic: !!this.anthropic,
        gemini: !!this.gemini
      }
    };
  }
}
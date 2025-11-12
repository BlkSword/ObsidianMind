# AI全自动渗透测试LLM-Agent系统

一个基于大语言模型的智能渗透测试平台，通过AI技术自动化执行安全评估任务。

## 🚀 功能特性

### 核心功能
- **LLM集成模块** - 支持OpenAI、Claude、Gemini等多种AI模型
- **工具联动系统** - 集成nmap、sqlmap、burpsuite等渗透测试工具
- **渗透思维链** - 自动化决策流程，智能规划渗透路径
- **POC/EXP验证** - 自动生成和验证漏洞利用代码
- **任务管理系统** - 支持多任务并发执行和进度跟踪
- **报告生成** - 自动化生成渗透测试报告
- **前端管理界面** - 支持任务配置、进度监控和结果展示

### 技术栈
- **前端**: React 18 + TypeScript + TailwindCSS
- **后端**: Node.js + Express.js + TypeScript
- **数据库**: Supabase (PostgreSQL)
- **缓存**: Redis
- **消息队列**: Bull Queue
- **AI集成**: OpenAI SDK、Anthropic SDK、Google AI SDK

## 📋 快速开始

### 环境要求
- Node.js 20+
- Redis 6+
- 可选: nmap、sqlmap、nikto等渗透测试工具

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd ai-penetration-testing-system
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的API密钥和数据库连接
```

4. **启动服务**
```bash
# 启动后端服务
npm run dev:api

# 启动前端服务
npm run dev:frontend
```

5. **访问系统**
- 前端界面: http://localhost:3000
- 后端API: http://localhost:3001
- API文档: http://localhost:3001/api/health

## 🔧 配置说明

### 环境变量
```bash
# 基础配置
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# AI模型API密钥
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_API_KEY=your_google_api_key

# 数据库配置（Supabase）
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# 安全配置
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=your_encryption_key
```

### AI模型配置
系统支持多种AI模型，您可以根据需求选择合适的模型：

- **OpenAI**: GPT-4、GPT-4 Turbo、GPT-3.5 Turbo
- **Anthropic**: Claude 3 Opus、Claude 3 Sonnet、Claude 3 Haiku
- **Google**: Gemini Pro、Gemini Pro Vision

## 🎯 使用指南

### 1. 创建渗透测试任务
```bash
# API调用示例
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Web应用安全测试",
    "target": "https://example.com",
    "aiModel": "openai",
    "aiModelConfig": {
      "apiKey": "your_api_key",
      "model": "gpt-4",
      "temperature": 0.3
    },
    "tools": ["nmap", "sqlmap", "nikto"],
    "strategy": {
      "type": "comprehensive",
      "depth": 3,
      "scope": ["web", "network"]
    },
    "userId": "user123",
    "priority": 1
  }'
```

### 2. 监控任务进度
```bash
# 获取任务状态
curl http://localhost:3001/api/tasks/{jobId}
```

### 3. 生成测试报告
```bash
# 生成HTML格式报告
curl -X POST http://localhost:3001/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task123",
    "taskName": "Web应用安全测试",
    "target": "https://example.com",
    "format": "html",
    "vulnerabilities": [],
    "scanResults": []
  }'
```

## 🔍 核心模块详解

### LLM服务模块
支持多种AI模型的统一接口，提供智能分析和决策能力：

```typescript
import { LLMService } from './api/services/ai/LLMService';

const llmService = new LLMService();
await llmService.initialize({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'your_api_key'
});

const response = await llmService.generateResponse({
  messages: [
    { role: 'system', content: '你是一个网络安全专家' },
    { role: 'user', content: '分析这个扫描结果' }
  ]
});
```

### 渗透思维链引擎
智能规划渗透测试路径，自动调整测试策略：

```typescript
import { PentestChainEngine } from './api/services/pentest/PentestChainEngine';

const engine = new PentestChainEngine(llmService);
const result = await engine.executeChain(
  'task123',
  'https://example.com',
  { provider: 'openai', model: 'gpt-4', apiKey: 'your_key' }
);
```

### 工具管理器
集成多种渗透测试工具，统一管理工具调用：

```typescript
import { ToolManager } from './api/services/tools/ToolManager';

const toolManager = new ToolManager();
const result = await toolManager.executeTool({
  toolName: 'nmap',
  target: 'example.com',
  args: ['-sS', '-O']
});
```

### POC验证管理器
自动生成和验证漏洞利用代码：

```typescript
import { POCManager } from './api/services/poc/POCManager';

const pocManager = new POCManager();
const pocCode = await pocManager.generatePOCCode(vulnerability);
const result = await pocManager.executePOC({
  code: pocCode.code,
  language: pocCode.language,
  target: 'https://example.com'
});
```

## 📊 API文档

### 任务管理API
- `POST /api/tasks` - 创建渗透测试任务
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/:jobId` - 获取任务状态
- `POST /api/tasks/:jobId/pause` - 暂停任务
- `POST /api/tasks/:jobId/resume` - 恢复任务
- `DELETE /api/tasks/:jobId` - 取消任务

### 报告管理API
- `POST /api/reports` - 生成测试报告
- `GET /api/reports` - 获取报告列表
- `GET /api/reports/:reportId` - 获取报告详情
- `DELETE /api/reports/:reportId` - 删除报告

### 工具管理API
- `GET /api/tools` - 获取可用工具列表
- `GET /api/tools/status` - 获取工具状态

### AI模型管理API
- `GET /api/ai/models` - 获取可用AI模型
- `GET /api/ai/status` - 获取AI服务状态

### 系统管理API
- `GET /api/system/stats` - 获取系统统计信息
- `GET /api/health` - 健康检查

## 🔒 安全考虑

### 输入验证
- 所有用户输入都进行严格的验证和清理
- 使用参数化查询防止SQL注入
- 实施XSS防护，对所有输出进行编码

### 权限控制
- 基于角色的访问控制(RBAC)
- 最小权限原则
- 定期审查和更新权限设置

### 数据保护
- 敏感数据加密存储(AES-256)
- 传输过程使用TLS 1.3加密
- 实施数据脱敏，保护用户隐私

### 审计监控
- 完整的操作审计日志
- 实时安全监控和告警
- 异常行为检测和响应

## 🧪 测试

### 单元测试
```bash
npm run test
```

### 集成测试
```bash
npm run test:integration
```

### 端到端测试
```bash
npm run test:e2e
```

## 🚀 部署

### Docker部署
```bash
# 构建镜像
docker build -t ai-pentest-system .

# 运行容器
docker run -d -p 3001:3001 --env-file .env ai-pentest-system
```

### Docker Compose部署
```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## ⚠️ 免责声明

本工具仅供安全研究和教育目的使用。使用本工具进行任何未经授权的渗透测试或攻击行为都是非法的。使用者应当遵守当地法律法规，仅在获得明确授权的情况下使用本工具。

## 🆘 支持

如遇到问题，请：

1. 查看文档和常见问题
2. 在GitHub Issues中搜索类似问题
3. 创建新的Issue描述问题

## 📞 联系方式

- 项目维护者：[Your Name]
- 邮箱：your.email@example.com
- 项目主页：https://github.com/yourusername/ai-penetration-testing-system

---

**⚡ 用AI赋能安全测试，让渗透测试更智能、更高效！**
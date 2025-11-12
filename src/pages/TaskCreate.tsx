import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Target, 
  Cpu, 
  Settings, 
  Play, 
  ArrowLeft, 
  AlertCircle,
  Shield,
  Zap,
  Code,
  Globe,
  Database
} from 'lucide-react';

interface TaskFormData {
  name: string;
  target: string;
  target_type: 'ip' | 'domain' | 'url' | 'network';
  description: string;
  ai_model: string;
  strategy: 'comprehensive' | 'quick' | 'deep' | 'custom';
  tools: string[];
  options: {
    port_scan: boolean;
    web_scan: boolean;
    vulnerability_scan: boolean;
    exploit_generation: boolean;
    post_exploitation: boolean;
    custom_ports?: string;
    custom_wordlist?: string;
    rate_limit?: number;
    timeout?: number;
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduled_time?: string;
}

const AI_MODELS = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', status: 'active' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', status: 'active' },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', status: 'active' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', status: 'active' }
];

const SECURITY_TOOLS = [
  { id: 'nmap', name: 'Nmap', category: 'network', description: 'Network discovery and port scanning' },
  { id: 'sqlmap', name: 'SQLMap', category: 'web', description: 'Automated SQL injection testing' },
  { id: 'nikto', name: 'Nikto', category: 'web', description: 'Web server vulnerability scanner' },
  { id: 'dirb', name: 'Dirb', category: 'web', description: 'Web content discovery tool' },
  { id: 'gobuster', name: 'Gobuster', category: 'web', description: 'Directory and file brute-forcer' },
  { id: 'masscan', name: 'Masscan', category: 'network', description: 'High-speed port scanner' },
  { id: 'whatweb', name: 'WhatWeb', category: 'web', description: 'Web technology identifier' },
  { id: 'wpscan', name: 'WPScan', category: 'web', description: 'WordPress vulnerability scanner' }
];

const STRATEGIES = [
  { id: 'comprehensive', name: '综合测试', description: '全面渗透测试，包含所有阶段' },
  { id: 'quick', name: '快速检测', description: '快速识别常见漏洞' },
  { id: 'deep', name: '深度挖掘', description: '深度分析，适合重要目标' },
  { id: 'custom', name: '自定义', description: '手动配置所有参数' }
];

export default function TaskCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolStatus, setToolStatus] = useState<{
    status?: string;
    tools?: Record<string, { available: boolean; version?: string; error?: string }>;
  }>({});
  const didFetchToolStatusRef = useRef(false);

  const [formData, setFormData] = useState<TaskFormData>({
    name: '',
    target: '',
    target_type: 'domain',
    description: '',
    ai_model: 'gpt-4',
    strategy: 'comprehensive',
    tools: ['nmap', 'sqlmap', 'nikto'],
    options: {
      port_scan: true,
      web_scan: true,
      vulnerability_scan: true,
      exploit_generation: true,
      post_exploitation: false,
      rate_limit: 100,
      timeout: 300
    },
    priority: 'medium'
  });

  useEffect(() => {
    if (didFetchToolStatusRef.current) return;
    didFetchToolStatusRef.current = true;
    checkToolStatus();
  }, []);

  const checkToolStatus = async () => {
    try {
      const response = await fetch('/api/tools/status');
      if (!response.ok) {
        throw new Error(`工具状态获取失败: ${response.status}`);
      }
      const data = await response.json();
      setToolStatus(data.status);
    } catch (error) {
      console.error('Failed to check tool status:', error);
      setToolStatus({ status: 'unknown', tools: {} });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 验证目标格式
      if (!validateTarget(formData.target, formData.target_type)) {
        throw new Error('目标格式不正确');
      }

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('创建任务失败');
      }

      const result = await response.json();
      navigate(`/tasks/${result.jobId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : '创建任务失败');
    } finally {
      setLoading(false);
    }
  };

  const validateTarget = (target: string, type: string): boolean => {
    switch (type) {
      case 'ip':
        return /^\d+\.\d+\.\d+\.\d+(\/\d+)?$/.test(target);
      case 'domain':
        return /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(target);
      case 'url':
        return /^https?:\/\/.+/.test(target);
      case 'network':
        return /^\d+\.\d+\.\d+\.\d+\/\d+$/.test(target);
      default:
        return false;
    }
  };

  const toggleTool = (toolId: string) => {
    setFormData(prev => ({
      ...prev,
      tools: prev.tools.includes(toolId)
        ? prev.tools.filter(id => id !== toolId)
        : [...prev.tools, toolId]
    }));
  };

  const updateOption = (key: keyof TaskFormData['options'], value: any) => {
    setFormData(prev => ({
      ...prev,
      options: {
        ...prev.options,
        [key]: value
      }
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回仪表板
          </Button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            创建渗透测试任务
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            配置AI驱动的自动化渗透测试任务，系统将智能选择工具和策略
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">基本信息</TabsTrigger>
              <TabsTrigger value="ai">AI配置</TabsTrigger>
              <TabsTrigger value="tools">工具选择</TabsTrigger>
              <TabsTrigger value="options">高级选项</TabsTrigger>
            </TabsList>

            <TabsContent value="basic">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    基本信息配置
                  </CardTitle>
                  <CardDescription>
                    配置渗透测试目标和相关参数
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">任务名称 *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="例如：客户网站安全评估"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">优先级</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">低</SelectItem>
                          <SelectItem value="medium">中</SelectItem>
                          <SelectItem value="high">高</SelectItem>
                          <SelectItem value="urgent">紧急</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="target">测试目标 *</Label>
                      <Input
                        id="target"
                        value={formData.target}
                        onChange={(e) => setFormData(prev => ({ ...prev, target: e.target.value }))}
                        placeholder="example.com 或 192.168.1.1"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="target_type">目标类型</Label>
                      <Select
                        value={formData.target_type}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, target_type: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="domain">域名</SelectItem>
                          <SelectItem value="ip">IP地址</SelectItem>
                          <SelectItem value="url">URL地址</SelectItem>
                          <SelectItem value="network">网段</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">任务描述</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="描述测试目标、范围和特殊要求..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduled_time">计划执行时间（可选）</Label>
                    <Input
                      id="scheduled_time"
                      type="datetime-local"
                      value={formData.scheduled_time || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduled_time: e.target.value || undefined }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="w-5 h-5" />
                    AI模型配置
                  </CardTitle>
                  <CardDescription>
                    选择AI模型和分析策略
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="ai_model">AI模型</Label>
                    <Select
                      value={formData.ai_model}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, ai_model: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.map(model => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center gap-2">
                              <span>{model.name}</span>
                              <Badge variant={model.status === 'active' ? 'default' : 'secondary'}>
                                {model.provider}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="strategy">测试策略</Label>
                    <Select
                      value={formData.strategy}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, strategy: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STRATEGIES.map(strategy => (
                          <SelectItem key={strategy.id} value={strategy.id}>
                            <div>
                              <div className="font-medium">{strategy.name}</div>
                              <div className="text-sm text-slate-500">{strategy.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>自动生成POC</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={formData.options.exploit_generation}
                          onCheckedChange={(checked) => updateOption('exploit_generation', checked)}
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          启用漏洞利用代码生成
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>后渗透测试</Label>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={formData.options.post_exploitation}
                          onCheckedChange={(checked) => updateOption('post_exploitation', checked)}
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          启用后渗透测试
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tools">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    安全工具选择
                  </CardTitle>
                  <CardDescription>
                    选择要使用的安全测试工具
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {SECURITY_TOOLS.map(tool => (
                      <div
                        key={tool.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          formData.tools.includes(tool.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
                        }`}
                        onClick={() => toggleTool(tool.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              formData.tools.includes(tool.id) ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-100 dark:bg-slate-800'
                            }`}>
                              {tool.category === 'network' ? (
                                <Globe className="w-4 h-4" />
                              ) : (
                                <Code className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{tool.name}</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {tool.description}
                              </div>
                            </div>
                          </div>
                          <Badge variant={toolStatus.tools?.[tool.id]?.available ? 'default' : 'secondary'}>
                            {toolStatus.tools?.[tool.id]?.available ? '可用' : '未安装'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="options">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    高级选项配置
                  </CardTitle>
                  <CardDescription>
                    配置扫描参数和性能选项
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label>端口扫描</Label>
                      <Switch
                        checked={formData.options.port_scan}
                        onCheckedChange={(checked) => updateOption('port_scan', checked)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Web扫描</Label>
                      <Switch
                        checked={formData.options.web_scan}
                        onCheckedChange={(checked) => updateOption('web_scan', checked)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>漏洞扫描</Label>
                      <Switch
                        checked={formData.options.vulnerability_scan}
                        onCheckedChange={(checked) => updateOption('vulnerability_scan', checked)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="rate_limit">速率限制（请求/秒）</Label>
                      <Input
                        id="rate_limit"
                        type="number"
                        value={formData.options.rate_limit}
                        onChange={(e) => updateOption('rate_limit', parseInt(e.target.value))}
                        min="1"
                        max="1000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeout">超时时间（秒）</Label>
                      <Input
                        id="timeout"
                        type="number"
                        value={formData.options.timeout}
                        onChange={(e) => updateOption('timeout', parseInt(e.target.value))}
                        min="30"
                        max="3600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="custom_ports">自定义端口（可选）</Label>
                      <Input
                        id="custom_ports"
                        value={formData.options.custom_ports || ''}
                        onChange={(e) => updateOption('custom_ports', e.target.value)}
                        placeholder="例如：80,443,8080-8090"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom_wordlist">自定义字典（可选）</Label>
                      <Input
                        id="custom_wordlist"
                        value={formData.options.custom_wordlist || ''}
                        onChange={(e) => updateOption('custom_wordlist', e.target.value)}
                        placeholder="字典文件路径"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between items-center pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.name || !formData.target}
              className="min-w-[120px]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  创建中...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  创建任务
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

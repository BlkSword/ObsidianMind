import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Square, 
  Download, 
  RefreshCw,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Shield,
  FileText,
  Bug,
  Zap
} from 'lucide-react';

interface Task {
  id: string;
  name: string;
  target: string;
  target_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  ai_model: string;
  strategy: string;
  tools: string[];
  priority: string;
  description?: string;
  error?: string;
  results?: {
    vulnerabilities: any[];
    reports: any[];
    logs: any[];
    statistics: {
      total_scans: number;
      vulnerabilities_found: number;
      high_risk: number;
      medium_risk: number;
      low_risk: number;
    };
  };
  current_stage?: string;
  current_tool?: string;
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [logFilter, setLogFilter] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);

  useEffect(() => {
    fetchTask();
    
    if (autoRefresh && task?.status === 'running') {
      const interval = setInterval(fetchTask, 5000);
      setRefreshInterval(interval);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [id, autoRefresh]);

  const fetchTask = async () => {
    try {
      const response = await fetch(`/api/tasks/${id}`);
      if (!response.ok) {
        throw new Error('获取任务信息失败');
      }
      const data = await response.json();
      const t = data.task || {};
      const normalized: Task = {
        id: t.taskId || id || '',
        name: t.taskName || t.taskId || '未命名任务',
        target: t.target || t.targetUrl || '',
        target_type: t.target_type || '',
        status: t.status || 'pending',
        progress: t.progress || 0,
        created_at: t.created_at || t.startedAt || new Date().toISOString(),
        started_at: t.startedAt || undefined,
        completed_at: t.completedAt || undefined,
        ai_model: t.ai_model || t.aiModel || '',
        strategy: t.strategy || '',
        tools: t.tools || [],
        priority: t.priority || 'medium',
        description: t.description || '',
        results: {
          vulnerabilities: (t.results && t.results.vulnerabilities) ? t.results.vulnerabilities : (t.vulnerabilities || []),
          reports: (t.results && t.results.reports) ? t.results.reports : [],
          logs: (t.results && t.results.logs) ? t.results.logs : ((t.logs || []).map((m: any) => ({ timestamp: Date.now(), level: 'info', message: m }))),
          statistics: (t.results && t.results.statistics) ? t.results.statistics : undefined
        },
        current_stage: t.currentStage || t.current_stage || '',
        current_tool: t.current_tool || ''
      };
      setTask(normalized);
    } catch (error) {
      setError(error instanceof Error ? error.message : '获取任务信息失败');
    } finally {
      setLoading(false);
    }
  };

  const controlTask = async (action: 'pause' | 'resume' | 'stop') => {
    try {
      let response: Response;
      if (action === 'pause') {
        response = await fetch(`/api/tasks/${id}/pause`, { method: 'POST' });
      } else if (action === 'resume') {
        response = await fetch(`/api/tasks/${id}/resume`, { method: 'POST' });
      } else {
        response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      }
      if (!response.ok) {
        throw new Error('操作失败');
      }
      fetchTask();
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败');
    }
  };

  const downloadReport = async (format: 'html' | 'json' | 'pdf') => {
    try {
      const response = await fetch(`/api/tasks/${id}/report?format=${format}`);
      if (!response.ok) {
        throw new Error('下载报告失败');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pentest-report-${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError(error instanceof Error ? error.message : '下载报告失败');
    }
  };

  const exportLogs = () => {
    const logs = (task?.results?.logs || []).filter((l: any) => {
      if (onlyErrors && (l.level || '').toLowerCase() !== 'error') return false;
      if (logFilter && !(l.message || '').toLowerCase().includes(logFilter.toLowerCase())) return false;
      return true;
    });
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-${task?.id}-logs.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'running':
        return 'outline';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'running':
        return <Activity className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'cancelled':
        return <Square className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">加载任务信息...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">任务未找到</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">无法找到指定的任务</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回仪表板
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回仪表板
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? '自动刷新' : '手动刷新'}
              </Button>
              {task.status === 'completed' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadReport('html')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    HTML报告
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadReport('json')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    JSON数据
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {task.name}
              </h1>
              <p className="text-slate-600 dark:text-slate-400">{task.description}</p>
              <div className="mt-2 flex gap-2">
                <Badge variant="outline">任务ID: {task.id}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={getStatusBadgeVariant(task.status)} className="text-lg px-3 py-1">
                {getStatusIcon(task.status)}
                <span className="ml-2">
                  {task.status === 'pending' && '等待中'}
                  {task.status === 'running' && '运行中'}
                  {task.status === 'completed' && '已完成'}
                  {task.status === 'failed' && '失败'}
                  {task.status === 'cancelled' && '已取消'}
                </span>
              </Badge>
              <Badge className={`text-sm px-2 py-1 ${getPriorityColor(task.priority)}`}>
                {task.priority === 'urgent' && '紧急'}
                {task.priority === 'high' && '高'}
                {task.priority === 'medium' && '中'}
                {task.priority === 'low' && '低'}
              </Badge>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {task.status === 'failed' && task.error && (
          <Card className="mb-6 border-red-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                失败原因
              </CardTitle>
              <CardDescription>任务执行过程中发生错误，以下是原始错误信息与最近日志</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-red-700 bg-red-50 rounded p-3 mb-4">
                {task.error}
              </div>
              <div>
                <div className="text-sm text-slate-600 mb-2">最近日志</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(task.results?.logs || []).slice(-5).map((log: any, index: number) => (
                    <div key={index} className="text-sm font-mono p-2 bg-slate-50 dark:bg-slate-800 rounded">
                      <span className="text-slate-500">[{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]</span>
                      <span className="ml-2 text-slate-700">{log.message || String(log)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 控制面板 */}
        {task.status === 'running' && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">当前工具: {task.current_tool || '初始化中...'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-green-500" />
                    <span className="font-medium">当前阶段: {task.current_stage || '准备中...'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => controlTask('pause')}
                    disabled={task.status !== 'running'}
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    暂停
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => controlTask('stop')}
                    disabled={task.status !== 'running'}
                  >
                    <Square className="w-4 h-4 mr-2" />
                    停止
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 进度条 */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">任务进度</span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {task.progress}% 完成
                </span>
              </div>
              <Progress value={task.progress} className="h-2" />
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>创建时间: {task.created_at ? new Date(task.created_at).toLocaleString() : '-'}</span>
                {task.started_at && (
                  <span>开始时间: {new Date(task.started_at).toLocaleString()}</span>
                )}
                {task.completed_at && (
                  <span>完成时间: {new Date(task.completed_at).toLocaleString()}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 详细信息 */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="vulnerabilities">漏洞</TabsTrigger>
            <TabsTrigger value="logs">日志</TabsTrigger>
            <TabsTrigger value="reports">报告</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    任务信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">目标:</span>
                      <div className="font-medium">{task.target}</div>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">目标类型:</span>
                      <div className="font-medium">{task.target_type}</div>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">AI模型:</span>
                      <div className="font-medium">{task.ai_model}</div>
                    </div>
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">策略:</span>
                      <div className="font-medium">
                        {task.strategy === 'comprehensive' && '综合测试'}
                        {task.strategy === 'quick' && '快速检测'}
                        {task.strategy === 'deep' && '深度挖掘'}
                        {task.strategy === 'custom' && '自定义'}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">使用工具:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(task.tools || []).map(tool => (
                        <Badge key={tool} variant="outline">{tool}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    统计信息
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {task.results?.statistics ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {task.results.statistics.total_scans}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">总扫描数</div>
                        </div>
                        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-red-600">
                            {task.results.statistics.vulnerabilities_found}
                          </div>
                          <div className="text-sm text-red-600">发现漏洞</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600 dark:text-slate-400">高风险</span>
                          <Badge variant="destructive">{task.results.statistics.high_risk}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600 dark:text-slate-400">中风险</span>
                          <Badge variant="outline" className="border-orange-500 text-orange-600">
                            {task.results.statistics.medium_risk}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600 dark:text-slate-400">低风险</span>
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                            {task.results.statistics.low_risk}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-600 dark:text-slate-400 py-8">
                      <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>暂无统计信息</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="vulnerabilities">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bug className="w-5 h-5" />
                  漏洞详情
                </CardTitle>
              </CardHeader>
              <CardContent>
                {task.results?.vulnerabilities && task.results.vulnerabilities.length > 0 ? (
                  <div className="space-y-4">
                    {task.results.vulnerabilities.map((vuln: any, index: number) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{vuln.name}</h4>
                          <Badge 
                            variant={
                              vuln.severity === 'high' ? 'destructive' :
                              vuln.severity === 'medium' ? 'outline' :
                              'secondary'
                            }
                            className={
                              vuln.severity === 'medium' ? 'border-orange-500 text-orange-600' :
                              vuln.severity === 'low' ? 'border-yellow-500 text-yellow-600' :
                              ''
                            }
                          >
                            {vuln.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                          {vuln.description}
                        </p>
                        <div className="text-xs text-slate-500">
                          <span>工具: {vuln.tool}</span>
                          <span className="ml-4">位置: {vuln.location}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-600 dark:text-slate-400 py-8">
                    <Bug className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无漏洞信息</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  执行日志
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <Input placeholder="搜索日志关键词" value={logFilter} onChange={(e) => setLogFilter(e.target.value)} />
                  <Button variant="outline" onClick={() => setOnlyErrors(!onlyErrors)}>{onlyErrors ? '显示全部' : '只看错误'}</Button>
                  <Button variant="outline" onClick={exportLogs}><Download className="w-4 h-4 mr-2" />导出</Button>
                </div>
                {task.results?.logs && task.results.logs.length > 0 ? (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto">
                    {(task.results.logs || []).filter((l: any) => {
                      if (onlyErrors && (l.level || '').toLowerCase() !== 'error') return false;
                      if (logFilter && !(l.message || '').toLowerCase().includes(logFilter.toLowerCase())) return false;
                      return true;
                    }).map((log: any, index: number) => (
                      <div key={index} className="text-sm font-mono p-2 bg-slate-50 dark:bg-slate-800 rounded shadow">
                        <span className="text-slate-500">[{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]</span>
                        <span className={`ml-2 ${
                          (log.level || '').toLowerCase() === 'error' ? 'text-red-600' :
                          (log.level || '').toLowerCase() === 'warn' ? 'text-yellow-600' :
                          'text-slate-700'
                        }`}>
                          {log.message || String(log)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-600 dark:text-slate-400 py-8">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>暂无日志信息</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  测试报告
                </CardTitle>
              </CardHeader>
              <CardContent>
                {task.status === 'completed' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <Button
                        variant="outline"
                        onClick={() => downloadReport('html')}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下载HTML报告
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => downloadReport('json')}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下载JSON数据
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => downloadReport('pdf')}
                        className="w-full"
                        disabled
                      >
                        <Download className="w-4 h-4 mr-2" />
                        下载PDF报告
                      </Button>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      <p>• HTML报告：包含详细的漏洞信息和修复建议</p>
                      <p>• JSON数据：原始测试数据，便于进一步分析</p>
                      <p>• PDF报告：专业格式的测试报告（开发中）</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-600 dark:text-slate-400 py-8">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>任务完成后可下载报告</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Clock, Play, Pause, Square, FileText, Settings, Users, Activity, Plus } from 'lucide-react';

interface Task {
  jobId: string;
  taskId: string;
  name: string;
  target: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  currentStage: string;
  vulnerabilities: number;
  startedAt?: string;
  completedAt?: string;
}

interface SystemStats {
  totalTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
}

const API_BASE_URL = '/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalTasks: 0,
    runningTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalVulnerabilities: 0,
    criticalVulnerabilities: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchStats();
    
    // 设置自动刷新
    const interval = setInterval(() => {
      fetchTasks();
      fetchStats();
    }, 5000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tasks`);
      const data = await response.json();
      
      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (error) {
      console.error('获取任务列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/system/stats`);
      const data = await response.json();
      
      if (data.success) {
        const taskStats = data.stats.tasks;
        setStats({
          totalTasks: taskStats.waiting + taskStats.active + taskStats.completed + taskStats.failed,
          runningTasks: taskStats.active,
          completedTasks: taskStats.completed,
          failedTasks: taskStats.failed,
          totalVulnerabilities: tasks.reduce((sum, task) => sum + task.vulnerabilities, 0),
          criticalVulnerabilities: 0 // 这里需要从后端获取详细统计
        });
      }
    } catch (error) {
      console.error('获取系统统计失败:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
      running: { color: 'bg-blue-100 text-blue-800', icon: <Activity className="w-3 h-3" /> },
      paused: { color: 'bg-gray-100 text-gray-800', icon: <Pause className="w-3 h-3" /> },
      completed: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
      failed: { color: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-3 h-3" /> }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge className={`${config.color} border-0`}>
        {config.icon}
        <span className="ml-1">{status}</span>
      </Badge>
    );
  };

  const handleTaskAction = async (jobId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${jobId}/${action}`, {
        method: action === 'cancel' ? 'DELETE' : 'POST'
      });
      
      const data = await response.json();
      if (data.success) {
        fetchTasks(); // 刷新任务列表
      }
    } catch (error) {
      console.error(`任务${action}失败:`, error);
    }
  };

  const getTaskActions = (task: Task) => {
    switch (task.status) {
      case 'running':
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTaskAction(task.jobId, 'pause')}
              className="mr-2"
            >
              <Pause className="w-4 h-4 mr-1" />
              暂停
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTaskAction(task.jobId, 'cancel')}
              className="text-red-600 hover:text-red-700"
            >
              <Square className="w-4 h-4 mr-1" />
              取消
            </Button>
          </>
        );
      case 'paused':
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTaskAction(task.jobId, 'resume')}
            className="text-green-600 hover:text-green-700"
          >
            <Play className="w-4 h-4 mr-1" />
            恢复
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AI渗透测试控制台</h1>
            <p className="text-gray-600">基于LLM的智能渗透测试平台</p>
          </div>
          <Button onClick={() => navigate('/tasks/create')} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            创建新任务
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">总任务数</p>
                  <p className="text-2xl font-bold">{stats.totalTasks}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">运行中</p>
                  <p className="text-2xl font-bold">{stats.runningTasks}</p>
                </div>
                <Play className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">已完成</p>
                  <p className="text-2xl font-bold">{stats.completedTasks}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">失败</p>
                  <p className="text-2xl font-bold">{stats.failedTasks}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">总漏洞数</p>
                  <p className="text-2xl font-bold">{stats.totalVulnerabilities}</p>
                </div>
                <FileText className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-100 text-sm">严重漏洞</p>
                  <p className="text-2xl font-bold">{stats.criticalVulnerabilities}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-gray-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 快速操作 */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用功能快捷入口</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => navigate('/tasks/create')}>
                  <Play className="w-4 h-4 mr-2" />
                  新建任务
                </Button>
                <Button variant="outline" onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  系统配置
                </Button>
                <Button variant="outline" onClick={() => navigate('/users')}>
                  <Users className="w-4 h-4 mr-2" />
                  用户管理
                </Button>
                <Button variant="outline" onClick={() => navigate('/reports')}>
                  <FileText className="w-4 h-4 mr-2" />
                  查看报告
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 任务列表 */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>最近任务</CardTitle>
              <CardDescription>最近执行的渗透测试任务</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">加载中...</p>
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">暂无任务</p>
                  <Button className="mt-4" onClick={() => navigate('/tasks/create')}>
                    创建新任务
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {tasks.slice(0, 5).map((task) => (
                    <div key={task.jobId} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {getStatusBadge(task.status)}
                          <div>
                            <h3 className="font-semibold text-gray-900">{task.name}</h3>
                            <p className="text-sm text-gray-600">{task.target}</p>
                            <div className="mt-1 flex gap-2">
                              <Badge variant="outline">jobId: {task.jobId}</Badge>
                              <Badge variant="outline">taskId: {task.taskId}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getTaskActions(task)}
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>{task.currentStage}</span>
                          <span>{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} className="h-2" />
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center space-x-4">
                          <span>漏洞: {task.vulnerabilities}</span>
                          {task.startedAt && (
                            <span>开始时间: {new Date(task.startedAt).toLocaleString()}</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="link"
                          onClick={() => navigate(`/tasks/${task.jobId}`)}
                        >
                          查看详情
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 系统状态 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>AI模型状态</CardTitle>
              <CardDescription>当前可用的AI模型服务</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span>OpenAI GPT-4</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-0">在线</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                    <span>Anthropic Claude</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-0">在线</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                    <span>Google Gemini</span>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800 border-0">维护中</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>渗透测试工具</CardTitle>
              <CardDescription>集成工具状态</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                    <span>nmap</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-0">可用</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                    <span>sqlmap</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-0">可用</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                    <span>nikto</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-0">可用</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Zap, Brain, Target, ArrowRight, Activity } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 导航栏 */}
      <nav className="p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">AI渗透测试系统</h1>
          </div>
          <Button 
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            进入控制台
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* 标题区域 */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-6">
            AI驱动的
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              智能渗透测试
            </span>
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
            基于大语言模型的全自动渗透测试平台，集成多种安全工具，智能决策分析，
            自动生成POC/EXP验证代码，提供全面的安全评估报告
          </p>
          <div className="flex justify-center space-x-4">
            <Button 
              size="lg"
              onClick={() => navigate('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              <Activity className="w-5 h-5 mr-2" />
              开始测试
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              查看文档
            </Button>
          </div>
        </div>

        {/* 特性卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <Brain className="w-8 h-8 text-blue-400 mb-3" />
              <CardTitle className="text-white">AI智能分析</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-300">
                集成GPT-4、Claude、Gemini等多种AI模型，智能分析渗透测试结果
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <Zap className="w-8 h-8 text-purple-400 mb-3" />
              <CardTitle className="text-white">工具联动</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-300">
                集成nmap、sqlmap、nikto等多种安全工具，统一调度和结果分析
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <Target className="w-8 h-8 text-green-400 mb-3" />
              <CardTitle className="text-white">POC/EXP生成</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-300">
                自动生成漏洞验证代码，支持多种漏洞类型的POC/EXP开发
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <Shield className="w-8 h-8 text-red-400 mb-3" />
              <CardTitle className="text-white">安全评估</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-slate-300">
                生成专业的安全评估报告，提供详细的漏洞分析和修复建议
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* 系统状态 */}
        <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-8 backdrop-blur-sm">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">系统特性</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-slate-300">自动化渗透测试流程</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span className="text-slate-300">实时任务监控和进度跟踪</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-slate-300">多格式报告导出</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-slate-300">智能风险评估</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              <span className="text-slate-300">安全沙箱执行环境</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
              <span className="text-slate-300">可扩展插件架构</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
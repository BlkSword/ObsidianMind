import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Activity, Shield, Settings, RefreshCw } from 'lucide-react'

export default function SystemConfig() {
  const [health, setHealth] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [config, setConfig] = useState<{ allowActiveAttacks: boolean; origins: string[]; rateLimit: { windowMs: number; max: number }; apiKeys: { openai: string; anthropic: string; google: string } }>({ allowActiveAttacks: false, origins: [], rateLimit: { windowMs: 900000, max: 100 }, apiKeys: { openai: '', anthropic: '', google: '' } })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const h = await fetch('/api/health').then(r => r.json()).catch(() => null)
    const s = await fetch('/api/system/stats').then(r => r.json()).catch(() => null)
    const c = await fetch('/api/system/config').then(r => r.json()).catch(() => null)
    setHealth(h)
    setStats(s?.stats)
    setConfig(c?.config || { allowActiveAttacks: false, origins: [], rateLimit: { windowMs: 900000, max: 100 }, apiKeys: { openai: '', anthropic: '', google: '' } })
  }

  useEffect(() => { load() }, [])

  const saveConfig = async () => {
    setSaving(true)
    await fetch('/api/system/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6" />
            <h1 className="text-2xl font-bold">系统配置</h1>
          </div>
          <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />刷新</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />安全选项</CardTitle>
            <CardDescription>控制活跃扫描与工具执行</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">允许活跃攻击</div>
                <div className="text-sm text-slate-600">开启后将在渗透链中调用 nmap/nikto 等工具</div>
              </div>
              <Switch checked={config.allowActiveAttacks} onCheckedChange={(v) => setConfig({ allowActiveAttacks: v })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="origins">来源白名单</Label>
                <Input id="origins" value={config.origins.join(',')} onChange={(e) => setConfig({ ...config, origins: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} placeholder="http://localhost:5173" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rlWindow">速率窗口(ms)</Label>
                  <Input id="rlWindow" type="number" value={config.rateLimit.windowMs} onChange={(e) => setConfig({ ...config, rateLimit: { ...config.rateLimit, windowMs: parseInt(e.target.value || '0') } })} />
                </div>
                <div>
                  <Label htmlFor="rlMax">速率上限</Label>
                  <Input id="rlMax" type="number" value={config.rateLimit.max} onChange={(e) => setConfig({ ...config, rateLimit: { ...config.rateLimit, max: parseInt(e.target.value || '0') } })} />
                </div>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="openai">OpenAI Key</Label>
                <Input id="openai" value={config.apiKeys.openai} onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, openai: e.target.value } })} />
              </div>
              <div>
                <Label htmlFor="anthropic">Anthropic Key</Label>
                <Input id="anthropic" value={config.apiKeys.anthropic} onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, anthropic: e.target.value } })} />
              </div>
              <div>
                <Label htmlFor="google">Google Key</Label>
                <Input id="google" value={config.apiKeys.google} onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, google: e.target.value } })} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={saving}>{saving ? '保存中...' : '保存配置'}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" />系统状态</CardTitle>
            <CardDescription>后端服务健康与运行统计</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-slate-600">健康状态</div>
                <Badge variant={health?.status === 'healthy' ? 'default' : 'destructive'}>{health?.status || 'unknown'}</Badge>
              </div>
              <div>
                <div className="text-sm text-slate-600">运行时间</div>
                <div className="font-medium">{Math.floor((stats?.system?.uptime || 0))}s</div>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-slate-600">等待</div>
                <div className="font-medium">{stats?.tasks?.waiting || 0}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">运行中</div>
                <div className="font-medium">{stats?.tasks?.active || 0}</div>
              </div>
              <div>
                <div className="text-sm text-slate-600">失败</div>
                <div className="font-medium">{stats?.tasks?.failed || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

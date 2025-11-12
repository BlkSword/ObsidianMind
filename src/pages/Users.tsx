import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, RefreshCw } from 'lucide-react'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', role: 'tester' })

  const load = async () => {
    setLoading(true)
    const data = await fetch('/api/users').then(r => r.json()).catch(() => ({ users: [] }))
    setUsers(data.users || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6" />
            <h1 className="text-2xl font-bold">用户管理</h1>
          </div>
          <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />刷新</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>用户列表</CardTitle>
            <CardDescription>当前系统中的用户</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="name">名称</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="email">邮箱</Label>
                <Input id="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="role">角色</Label>
                <Input id="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>
              <div className="col-span-3 flex justify-end">
                <Button onClick={async () => {
                  await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
                  setForm({ name: '', email: '', role: 'tester' })
                  load()
                }}>新增用户</Button>
              </div>
            </div>
            {loading ? (
              <div className="py-8 text-center">加载中...</div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center">暂无用户</div>
            ) : (
              <div className="space-y-3">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-sm text-slate-600">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{u.role}</Badge>
                      <Badge variant={u.status === 'active' ? 'default' : 'secondary'}>{u.status}</Badge>
                      <Button size="sm" variant="outline" onClick={async () => { await fetch(`/api/users/${u.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: u.status === 'active' ? 'inactive' : 'active' }) }); load() }}>{u.status === 'active' ? '禁用' : '启用'}</Button>
                      <Button size="sm" variant="destructive" onClick={async () => { await fetch(`/api/users/${u.id}`, { method: 'DELETE' }); load() }}>删除</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

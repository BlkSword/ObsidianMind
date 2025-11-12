import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, RefreshCw, Download } from 'lucide-react'

export default function Reports() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const data = await fetch('/api/reports').then(r => r.json()).catch(() => ({ reports: [] }))
    setReports(data.reports || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const download = async (reportId: string) => {
    const detail = await fetch(`/api/reports/${reportId}`).then(r => r.json()).catch(() => null)
    const filePath = detail?.report?.filePath
    if (!filePath) return
    const a = document.createElement('a')
    a.href = filePath
    a.download = `report-${reportId}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6" />
            <h1 className="text-2xl font-bold">报告中心</h1>
          </div>
          <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />刷新</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>报告列表</CardTitle>
            <CardDescription>已生成的渗透测试报告</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center">加载中...</div>
            ) : reports.length === 0 ? (
              <div className="py-8 text-center">暂无报告</div>
            ) : (
              <div className="space-y-3">
                {reports.map((r: any) => (
                  <div key={r.id || r.reportId} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <div className="font-medium">{r.taskName || r.name || '未命名报告'}</div>
                      <div className="text-sm text-slate-600">{r.target}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{r.format || 'html'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => download(r.id || r.reportId)}><Download className="w-4 h-4 mr-2" />下载</Button>
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


import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'

export type TaskRow = {
  id: string
  name: string
  target: string
  aiModel: string
  priority: number
  scheduledAt?: number
  createdAt: number
}

export type ExecutionRow = {
  jobId: string
  taskId: string
  status: string
  progress: number
  currentStage: string
  startedAt?: number
  completedAt?: number
  error?: string
}

export type LogRow = {
  id: string
  jobId: string
  message: string
  ts: number
}

export class SqliteDB {
  private filePath: string
  private dbPromise: Promise<any>

  constructor(filePath: string) {
    this.filePath = filePath
    this.dbPromise = this.load()
  }

  private async load() {
    const SQL = await initSqlJs({ locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file) })
    let db
    if (fs.existsSync(this.filePath)) {
      const buf = fs.readFileSync(this.filePath)
      db = new SQL.Database(buf)
    } else {
      db = new SQL.Database()
      db.run(
        `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY,name TEXT NOT NULL,target TEXT NOT NULL,aiModel TEXT NOT NULL,priority INTEGER NOT NULL,scheduledAt INTEGER,createdAt INTEGER NOT NULL);
         CREATE TABLE IF NOT EXISTS executions (jobId TEXT PRIMARY KEY,taskId TEXT NOT NULL,status TEXT NOT NULL,progress INTEGER NOT NULL,currentStage TEXT NOT NULL,startedAt INTEGER,completedAt INTEGER,error TEXT);
         CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY,jobId TEXT NOT NULL,message TEXT NOT NULL,ts INTEGER NOT NULL);
         CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,role TEXT NOT NULL,status TEXT NOT NULL,createdAt INTEGER NOT NULL);
         CREATE INDEX IF NOT EXISTS idx_logs_job ON logs(jobId);
         CREATE INDEX IF NOT EXISTS idx_exec_task ON executions(taskId);`
      )
      this.save(db)
    }
    return db
  }

  private save(db: any) {
    const data = db.export()
    fs.writeFileSync(this.filePath, Buffer.from(data))
  }

  async upsertTask(row: TaskRow) {
    const db = await this.dbPromise
    const stmt = db.prepare(`INSERT OR REPLACE INTO tasks (id,name,target,aiModel,priority,scheduledAt,createdAt) VALUES (?,?,?,?,?,?,?)`)
    stmt.run([row.id, row.name, row.target, row.aiModel, row.priority, row.scheduledAt || null, row.createdAt])
    stmt.free()
    this.save(db)
  }

  async upsertExecution(row: ExecutionRow) {
    const db = await this.dbPromise
    const stmt = db.prepare(`INSERT OR REPLACE INTO executions (jobId,taskId,status,progress,currentStage,startedAt,completedAt,error) VALUES (?,?,?,?,?,?,?,?)`)
    stmt.run([row.jobId, row.taskId, row.status, row.progress, row.currentStage, row.startedAt || null, row.completedAt || null, row.error || null])
    stmt.free()
    this.save(db)
  }

  async appendLog(row: LogRow) {
    const db = await this.dbPromise
    const stmt = db.prepare(`INSERT INTO logs (id,jobId,message,ts) VALUES (?,?,?,?)`)
    stmt.run([row.id, row.jobId, row.message, row.ts])
    stmt.free()
    this.save(db)
  }

  async getExecutions(): Promise<ExecutionRow[]> {
    const db = await this.dbPromise
    const res = db.exec(`SELECT * FROM executions`)
    if (!res.length) return []
    const { columns, values } = res[0]
    return values.map((v: any[]) => Object.fromEntries(v.map((val, i) => [columns[i], val]))) as ExecutionRow[]
  }

  async getExecution(jobId: string): Promise<ExecutionRow | undefined> {
    const db = await this.dbPromise
    const res = db.exec(`SELECT * FROM executions WHERE jobId='${jobId}' LIMIT 1`)
    if (!res.length) return undefined
    const { columns, values } = res[0]
    const v = values[0]
    return Object.fromEntries(v.map((val: any, i: number) => [columns[i], val])) as ExecutionRow
  }

  async getTask(taskId: string): Promise<TaskRow | undefined> {
    const db = await this.dbPromise
    const res = db.exec(`SELECT * FROM tasks WHERE id='${taskId}' LIMIT 1`)
    if (!res.length) return undefined
    const { columns, values } = res[0]
    const v = values[0]
    return Object.fromEntries(v.map((val: any, i: number) => [columns[i], val])) as TaskRow
  }

  async getTasks(): Promise<TaskRow[]> {
    const db = await this.dbPromise
    const res = db.exec(`SELECT * FROM tasks ORDER BY createdAt DESC`)
    if (!res.length) return []
    const { columns, values } = res[0]
    return values.map((v: any[]) => Object.fromEntries(v.map((val, i) => [columns[i], val]))) as TaskRow[]
  }

  async getLogs(jobId: string): Promise<LogRow[]> {
    const db = await this.dbPromise
    const res = db.exec(`SELECT * FROM logs WHERE jobId='${jobId}' ORDER BY ts ASC`)
    if (!res.length) return []
    const { columns, values } = res[0]
    return values.map((v: any[]) => Object.fromEntries(v.map((val, i) => [columns[i], val]))) as LogRow[]
  }

  async upsertUser(row: { id: string; name: string; email: string; role: string; status: string; createdAt: number }) {
    const db = await this.dbPromise
    const stmt = db.prepare(`INSERT OR REPLACE INTO users (id,name,email,role,status,createdAt) VALUES (?,?,?,?,?,?)`)
    stmt.run([row.id, row.name, row.email, row.role, row.status, row.createdAt])
    stmt.free()
    this.save(db)
  }

  async getUsers(): Promise<any[]> {
    const db = await this.dbPromise
    const res = db.exec(`SELECT * FROM users ORDER BY createdAt DESC`)
    if (!res.length) return []
    const { columns, values } = res[0]
    return values.map((v: any[]) => Object.fromEntries(v.map((val, i) => [columns[i], val])))
  }

  async updateUserStatus(id: string, status: string) {
    const db = await this.dbPromise
    db.run(`UPDATE users SET status='${status}' WHERE id='${id}'`)
    this.save(db)
  }

  async deleteUser(id: string) {
    const db = await this.dbPromise
    db.run(`DELETE FROM users WHERE id='${id}'`)
    this.save(db)
  }
}

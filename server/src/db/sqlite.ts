import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/plasma_etching.db');

class SQLiteDatabase {
  private db: Database | null = null;

  async init() {
    const SQL = await initSqlJs();
    
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
    this.persist();
    
    setInterval(() => this.persist(), 30000);
    
    return this;
  }

  private createTables() {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        nonuniform_count INTEGER DEFAULT 0,
        task_count INTEGER DEFAULT 0,
        completed_count INTEGER DEFAULT 0,
        pause_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        name TEXT NOT NULL,
        mask_file TEXT,
        mask_data TEXT,
        status TEXT DEFAULT 'pending',
        progress REAL DEFAULT 0,
        parameters TEXT NOT NULL,
        result TEXT,
        realtime_metrics TEXT,
        adjust_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (batch_id) REFERENCES batches(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS warnings (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        threshold REAL NOT NULL,
        actual_value REAL NOT NULL,
        acknowledged INTEGER DEFAULT 0,
        acknowledged_by TEXT,
        ack_comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        level TEXT NOT NULL,
        approver TEXT,
        status TEXT DEFAULT 'pending',
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        decided_at DATETIME,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS adjustments (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        before_params TEXT NOT NULL,
        after_params TEXT NOT NULL,
        reason TEXT NOT NULL,
        adjusted_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS recommendations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parameters TEXT NOT NULL,
        score REAL NOT NULL,
        predicted_angle REAL NOT NULL,
        predicted_selectivity REAL NOT NULL,
        predicted_uniformity REAL NOT NULL,
        usage_count INTEGER DEFAULT 0,
        scenarios TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        id TEXT PRIMARY KEY,
        date TEXT UNIQUE NOT NULL,
        completion_rate REAL DEFAULT 0,
        rate_deviation REAL DEFAULT 0,
        optimization_count INTEGER DEFAULT 0,
        total_tasks INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        warning_count INTEGER DEFAULT 0,
        approval_count INTEGER DEFAULT 0,
        process_capability TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS mask_models (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        layers TEXT NOT NULL,
        bounding_box TEXT NOT NULL,
        features_count INTEGER DEFAULT 0,
        three_d_model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_batch_id ON tasks(batch_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_warnings_task_id ON warnings(task_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_approvals_task_id ON approvals(task_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_adjustments_task_id ON adjustments(task_id)`);
  }

  private persist() {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
      console.error('Failed to persist database:', e);
    }
  }

  run(sql: string, params: any[] = []) {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    stmt.run(params);
    stmt.free();
    this.persist();
  }

  get<T = any>(sql: string, params: any[] = []): T | undefined {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    const result = stmt.getAsObject(params) as T;
    stmt.free();
    return result;
  }

  all<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  count(sql: string, params: any[] = []): number {
    const result = this.get<{ count: number }>(sql, params);
    return result?.count || 0;
  }

  close() {
    if (this.db) {
      this.persist();
      this.db.close();
      this.db = null;
    }
  }
}

export const db = new SQLiteDatabase();

import Database from 'better-sqlite3'
import path from 'path'

export interface KnowledgeEntry {
  id: number
  content: string
  source: string
  created_at: string
}

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (_db) return _db
  const dbPath = path.join(process.cwd(), 'knowledge.db')
  _db = new Database(dbPath)
  _db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      content   TEXT    NOT NULL,
      source    TEXT    NOT NULL DEFAULT 'user',
      created_at TEXT   NOT NULL DEFAULT (datetime('now'))
    )
  `)
  return _db
}

export function getAllKnowledge(): KnowledgeEntry[] {
  return getDb()
    .prepare('SELECT * FROM knowledge ORDER BY created_at DESC')
    .all() as KnowledgeEntry[]
}

export function addKnowledge(content: string, source = 'user'): KnowledgeEntry {
  const stmt = getDb().prepare(
    'INSERT INTO knowledge (content, source) VALUES (?, ?) RETURNING *'
  )
  return stmt.get(content, source) as KnowledgeEntry
}

export function deleteKnowledge(id: number): void {
  getDb().prepare('DELETE FROM knowledge WHERE id = ?').run(id)
}

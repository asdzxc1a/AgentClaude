/**
 * Database management for the Data Processing Agent
 * Handles SQLite operations with WAL mode for concurrent access
 */

import { Database } from "bun:sqlite";
import type { HookEvent, DatabaseEvent, FilterOptions, EventsQuery, Theme } from "./types";

export class ObservabilityDatabase {
  private db: Database;
  private dbPath: string;

  constructor(dbPath: string = "events.db") {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    
    // Enable WAL mode for concurrent access
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec("PRAGMA cache_size = 1000;");
    this.db.exec("PRAGMA temp_store = memory;");
    
    this.initializeTables();
  }

  private initializeTables(): void {
    // Events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_app TEXT NOT NULL,
        session_id TEXT NOT NULL,
        hook_event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        chat TEXT,
        summary TEXT,
        timestamp TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_source_app ON events(source_app);
      CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(hook_event_type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    `);

    // Themes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS themes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        colors TEXT NOT NULL,
        author_id TEXT,
        is_public BOOLEAN DEFAULT 1,
        download_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Theme shares table (for future sharing functionality)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS theme_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
        shared_by TEXT,
        shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        share_token TEXT UNIQUE
      )
    `);

    // Theme ratings table (for future rating functionality)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS theme_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
        user_id TEXT,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(theme_id, user_id)
      )
    `);

    // Check for missing columns (backward compatibility)
    this.ensureColumnsExist();

    console.log("✓ Database initialized with all tables and indexes");
  }

  private ensureColumnsExist(): void {
    try {
      // Check if chat column exists
      const result = this.db.query("PRAGMA table_info(events)").all();
      const columns = result.map((row: any) => row.name);
      
      if (!columns.includes('chat')) {
        this.db.exec("ALTER TABLE events ADD COLUMN chat TEXT");
        console.log("✓ Added 'chat' column to events table");
      }
      
      if (!columns.includes('summary')) {
        this.db.exec("ALTER TABLE events ADD COLUMN summary TEXT");
        console.log("✓ Added 'summary' column to events table");
      }
    } catch (error) {
      console.warn("Warning: Could not verify/add missing columns:", error);
    }
  }

  // Event operations
  public insertEvent(event: HookEvent): DatabaseEvent {
    const query = this.db.prepare(`
      INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const payloadJson = JSON.stringify(event.payload);
    const chatJson = event.chat ? JSON.stringify(event.chat) : null;

    const result = query.run(
      event.source_app,
      event.session_id,
      event.hook_event_type,
      payloadJson,
      chatJson,
      event.summary || null,
      event.timestamp
    );

    // Retrieve the inserted event
    const insertedEvent = this.getEventById(result.lastInsertRowid as number);
    if (!insertedEvent) {
      throw new Error("Failed to retrieve inserted event");
    }

    return insertedEvent;
  }

  public getEventById(id: number): DatabaseEvent | null {
    const query = this.db.prepare("SELECT * FROM events WHERE id = ?");
    const row = query.get(id) as any;
    
    if (!row) return null;

    return this.formatEventRow(row);
  }

  public getRecentEvents(limit: number = 100): DatabaseEvent[] {
    const query = this.db.prepare(`
      SELECT * FROM events 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    
    const rows = query.all(limit) as any[];
    return rows.map(row => this.formatEventRow(row));
  }

  public getEvents(queryParams: EventsQuery): DatabaseEvent[] {
    let sql = "SELECT * FROM events WHERE 1=1";
    const params: any[] = [];

    if (queryParams.source_app) {
      sql += " AND source_app = ?";
      params.push(queryParams.source_app);
    }

    if (queryParams.session_id) {
      sql += " AND session_id = ?";
      params.push(queryParams.session_id);
    }

    if (queryParams.event_type) {
      sql += " AND hook_event_type = ?";
      params.push(queryParams.event_type);
    }

    if (queryParams.start_time) {
      sql += " AND timestamp >= ?";
      params.push(queryParams.start_time);
    }

    if (queryParams.end_time) {
      sql += " AND timestamp <= ?";
      params.push(queryParams.end_time);
    }

    if (queryParams.search) {
      sql += " AND (payload LIKE ? OR summary LIKE ?)";
      const searchTerm = `%${queryParams.search}%`;
      params.push(searchTerm, searchTerm);
    }

    sql += " ORDER BY created_at DESC";

    if (queryParams.limit) {
      sql += " LIMIT ?";
      params.push(queryParams.limit);
    }

    if (queryParams.offset) {
      sql += " OFFSET ?";
      params.push(queryParams.offset);
    }

    const query = this.db.prepare(sql);
    const rows = query.all(...params) as any[];
    
    return rows.map(row => this.formatEventRow(row));
  }

  public getFilterOptions(): FilterOptions {
    const sourceAppsQuery = this.db.prepare("SELECT DISTINCT source_app FROM events ORDER BY source_app");
    const sessionIdsQuery = this.db.prepare(`
      SELECT DISTINCT session_id FROM events 
      WHERE created_at >= datetime('now', '-7 days') 
      ORDER BY session_id
    `);
    const eventTypesQuery = this.db.prepare("SELECT DISTINCT hook_event_type FROM events ORDER BY hook_event_type");

    const sourceApps = sourceAppsQuery.all().map((row: any) => row.source_app);
    const sessionIds = sessionIdsQuery.all().map((row: any) => row.session_id);
    const eventTypes = eventTypesQuery.all().map((row: any) => row.hook_event_type);

    return {
      source_apps: sourceApps,
      session_ids: sessionIds,
      event_types: eventTypes
    };
  }

  public getEventCount(): number {
    const query = this.db.prepare("SELECT COUNT(*) as count FROM events");
    const result = query.get() as any;
    return result.count;
  }

  public clearOldEvents(daysOld: number = 30): number {
    const query = this.db.prepare(`
      DELETE FROM events 
      WHERE created_at < datetime('now', '-${daysOld} days')
    `);
    
    const result = query.run();
    return result.changes;
  }

  // Theme operations
  public insertTheme(theme: Omit<Theme, 'id' | 'created_at' | 'updated_at'>): Theme {
    const query = this.db.prepare(`
      INSERT INTO themes (name, description, colors, author_id, is_public)
      VALUES (?, ?, ?, ?, ?)
    `);

    const colorsJson = JSON.stringify(theme.colors);
    
    const result = query.run(
      theme.name,
      theme.description || null,
      colorsJson,
      theme.author_id || null,
      theme.is_public !== false
    );

    const insertedTheme = this.getThemeById(result.lastInsertRowid as number);
    if (!insertedTheme) {
      throw new Error("Failed to retrieve inserted theme");
    }

    return insertedTheme;
  }

  public getThemeById(id: number): Theme | null {
    const query = this.db.prepare("SELECT * FROM themes WHERE id = ?");
    const row = query.get(id) as any;
    
    if (!row) return null;

    return this.formatThemeRow(row);
  }

  public getThemes(): Theme[] {
    const query = this.db.prepare("SELECT * FROM themes ORDER BY created_at DESC");
    const rows = query.all() as any[];
    
    return rows.map(row => this.formatThemeRow(row));
  }

  public updateTheme(id: number, updates: Partial<Theme>): boolean {
    const fields = [];
    const values = [];

    if (updates.name) {
      fields.push("name = ?");
      values.push(updates.name);
    }

    if (updates.description !== undefined) {
      fields.push("description = ?");
      values.push(updates.description);
    }

    if (updates.colors) {
      fields.push("colors = ?");
      values.push(JSON.stringify(updates.colors));
    }

    if (updates.is_public !== undefined) {
      fields.push("is_public = ?");
      values.push(updates.is_public);
    }

    if (fields.length === 0) return false;

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const query = this.db.prepare(`
      UPDATE themes SET ${fields.join(", ")} WHERE id = ?
    `);

    const result = query.run(...values);
    return result.changes > 0;
  }

  public deleteTheme(id: number): boolean {
    const query = this.db.prepare("DELETE FROM themes WHERE id = ?");
    const result = query.run(id);
    return result.changes > 0;
  }

  // Helper methods
  private formatEventRow(row: any): DatabaseEvent {
    return {
      id: row.id,
      source_app: row.source_app,
      session_id: row.session_id,
      hook_event_type: row.hook_event_type,
      payload: JSON.parse(row.payload),
      chat: row.chat ? JSON.parse(row.chat) : undefined,
      summary: row.summary || undefined,
      timestamp: row.timestamp,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private formatThemeRow(row: any): Theme {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      colors: JSON.parse(row.colors),
      author_id: row.author_id,
      is_public: Boolean(row.is_public),
      download_count: row.download_count || 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // Database maintenance
  public vacuum(): void {
    this.db.exec("VACUUM;");
    console.log("✓ Database vacuumed");
  }

  public getStats(): any {
    const totalEvents = this.getEventCount();
    const recentEvents = this.db.prepare(`
      SELECT COUNT(*) as count FROM events 
      WHERE created_at >= datetime('now', '-24 hours')
    `).get() as any;

    const eventsByType = this.db.prepare(`
      SELECT hook_event_type, COUNT(*) as count 
      FROM events 
      GROUP BY hook_event_type 
      ORDER BY count DESC
    `).all();

    const eventsByApp = this.db.prepare(`
      SELECT source_app, COUNT(*) as count 
      FROM events 
      GROUP BY source_app 
      ORDER BY count DESC
    `).all();

    return {
      total_events: totalEvents,
      events_last_24h: recentEvents.count,
      events_by_type: eventsByType,
      events_by_app: eventsByApp,
      database_path: this.dbPath
    };
  }

  public close(): void {
    this.db.close();
  }
}
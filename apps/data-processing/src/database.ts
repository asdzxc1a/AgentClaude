/**
 * Database management for the Data Processing Agent
 * Handles SQLite operations with WAL mode for concurrent access
 */

import sqlite3 from "sqlite3";
import { promisify } from "util";
import type { HookEvent, DatabaseEvent, FilterOptions, EventsQuery, Theme } from "./types";

export class ObservabilityDatabase {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath: string = "events.db") {
    this.dbPath = dbPath;
    this.db = new sqlite3.Database(dbPath);
    
    // Enable WAL mode for concurrent access
    this.db.serialize(() => {
      this.db.run("PRAGMA journal_mode = WAL;");
      this.db.run("PRAGMA synchronous = NORMAL;");
      this.db.run("PRAGMA cache_size = 1000;");
      this.db.run("PRAGMA temp_store = memory;");
    });
    
    this.initializeTables();
  }

  private async initializeTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Events table
        this.db.run(`
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
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_source_app ON events(source_app)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(hook_event_type)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)`);

        // Themes table
        this.db.run(`
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
        this.db.run(`
          CREATE TABLE IF NOT EXISTS theme_shares (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
            shared_by TEXT,
            shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            share_token TEXT UNIQUE
          )
        `);

        // Theme ratings table (for future rating functionality)
        this.db.run(`
          CREATE TABLE IF NOT EXISTS theme_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            theme_id INTEGER REFERENCES themes(id) ON DELETE CASCADE,
            user_id TEXT,
            rating INTEGER CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(theme_id, user_id)
          )
        `, (err) => {
          if (err) {
            console.error("Error creating tables:", err);
            reject(err);
          } else {
            console.log("✓ Database initialized with all tables and indexes");
            resolve();
          }
        });
      });
    });
  }

  // Event operations
  public insertEvent(event: HookEvent): Promise<DatabaseEvent> {
    return new Promise((resolve, reject) => {
      const payloadJson = JSON.stringify(event.payload);
      const chatJson = event.chat ? JSON.stringify(event.chat) : null;
      const db = this.db;
      const formatEventRow = this.formatEventRow.bind(this);

      db.run(
        `INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [event.source_app, event.session_id, event.hook_event_type, payloadJson, chatJson, event.summary || null, event.timestamp],
        function(err: Error | null) {
          if (err) {
            reject(err);
          } else {
            // Retrieve the inserted event using lastID from the run context
            const insertId = (this as any).lastID;
            db.get("SELECT * FROM events WHERE id = ?", [insertId], (selectErr: Error | null, row: any) => {
              if (selectErr) {
                reject(selectErr);
              } else if (!row) {
                reject(new Error("Failed to retrieve inserted event"));
              } else {
                resolve(formatEventRow(row));
              }
            });
          }
        }
      );
    });
  }

  public getEventById(id: number): Promise<DatabaseEvent | null> {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM events WHERE id = ?", [id], (err: Error | null, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve(this.formatEventRow(row));
        }
      });
    });
  }

  public getRecentEvents(limit: number = 100): Promise<DatabaseEvent[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM events ORDER BY created_at DESC LIMIT ?",
        [limit],
        (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => this.formatEventRow(row)));
          }
        }
      );
    });
  }

  public getEvents(queryParams: EventsQuery): Promise<DatabaseEvent[]> {
    return new Promise((resolve, reject) => {
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

      this.db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => this.formatEventRow(row)));
        }
      });
    });
  }

  public getFilterOptions(): Promise<FilterOptions> {
    return new Promise((resolve, reject) => {
      const promises = [
        new Promise<string[]>((res, rej) => {
          this.db.all("SELECT DISTINCT source_app FROM events ORDER BY source_app", [], (err, rows: any[]) => {
            if (err) rej(err);
            else res(rows.map(row => row.source_app));
          });
        }),
        new Promise<string[]>((res, rej) => {
          this.db.all(
            "SELECT DISTINCT session_id FROM events WHERE created_at >= datetime('now', '-7 days') ORDER BY session_id",
            [],
            (err, rows: any[]) => {
              if (err) rej(err);
              else res(rows.map(row => row.session_id));
            }
          );
        }),
        new Promise<string[]>((res, rej) => {
          this.db.all("SELECT DISTINCT hook_event_type FROM events ORDER BY hook_event_type", [], (err, rows: any[]) => {
            if (err) rej(err);
            else res(rows.map(row => row.hook_event_type));
          });
        })
      ];

      Promise.all(promises)
        .then(([source_apps, session_ids, event_types]) => {
          resolve({
            source_apps,
            session_ids,
            event_types: event_types as any[]
          });
        })
        .catch(reject);
    });
  }

  public getEventCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT COUNT(*) as count FROM events", [], (err: Error | null, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }

  public clearOldEvents(daysOld: number = 30): Promise<number> {
    return new Promise((resolve, reject) => {
      const db = this.db;
      db.run(
        `DELETE FROM events WHERE created_at < datetime('now', '-${daysOld} days')`,
        [],
        function(err: Error | null) {
          if (err) {
            reject(err);
          } else {
            resolve((this as any).changes);
          }
        }
      );
    });
  }

  // Theme operations
  public insertTheme(theme: Omit<Theme, 'id' | 'created_at' | 'updated_at'>): Promise<Theme> {
    return new Promise((resolve, reject) => {
      const colorsJson = JSON.stringify(theme.colors);
      const db = this.db;
      const formatThemeRow = this.formatThemeRow.bind(this);
      
      db.run(
        `INSERT INTO themes (name, description, colors, author_id, is_public)
         VALUES (?, ?, ?, ?, ?)`,
        [theme.name, theme.description || null, colorsJson, theme.author_id || null, theme.is_public !== false],
        function(err: Error | null) {
          if (err) {
            reject(err);
          } else {
            const insertId = (this as any).lastID;
            db.get("SELECT * FROM themes WHERE id = ?", [insertId], (selectErr: Error | null, row: any) => {
              if (selectErr) {
                reject(selectErr);
              } else if (!row) {
                reject(new Error("Failed to retrieve inserted theme"));
              } else {
                resolve(formatThemeRow(row));
              }
            });
          }
        }
      );
    });
  }

  public getThemeById(id: number): Promise<Theme | null> {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT * FROM themes WHERE id = ?", [id], (err: Error | null, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve(this.formatThemeRow(row));
        }
      });
    });
  }

  public getThemes(): Promise<Theme[]> {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM themes ORDER BY created_at DESC", [], (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => this.formatThemeRow(row)));
        }
      });
    });
  }

  public updateTheme(id: number, updates: Partial<Theme>): Promise<boolean> {
    return new Promise((resolve, reject) => {
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

      if (fields.length === 0) {
        resolve(false);
        return;
      }

      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(id);

      const sql = `UPDATE themes SET ${fields.join(", ")} WHERE id = ?`;

      this.db.run(sql, values, function(err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  public deleteTheme(id: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.run("DELETE FROM themes WHERE id = ?", [id], function(err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
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
  public vacuum(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run("VACUUM;", [], (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          console.log("✓ Database vacuumed");
          resolve();
        }
      });
    });
  }

  public getStats(): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const totalEvents = await this.getEventCount();
        
        const recentEvents = await new Promise<number>((res, rej) => {
          this.db.get(
            "SELECT COUNT(*) as count FROM events WHERE created_at >= datetime('now', '-24 hours')",
            [],
            (err: Error | null, row: any) => {
              if (err) rej(err);
              else res(row.count);
            }
          );
        });

        const eventsByType = await new Promise<any[]>((res, rej) => {
          this.db.all(
            "SELECT hook_event_type, COUNT(*) as count FROM events GROUP BY hook_event_type ORDER BY count DESC",
            [],
            (err: Error | null, rows: any[]) => {
              if (err) rej(err);
              else res(rows);
            }
          );
        });

        const eventsByApp = await new Promise<any[]>((res, rej) => {
          this.db.all(
            "SELECT source_app, COUNT(*) as count FROM events GROUP BY source_app ORDER BY count DESC",
            [],
            (err: Error | null, rows: any[]) => {
              if (err) rej(err);
              else res(rows);
            }
          );
        });

        resolve({
          total_events: totalEvents,
          events_last_24h: recentEvents,
          events_by_type: eventsByType,
          events_by_app: eventsByApp,
          database_path: this.dbPath
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public close(): void {
    this.db.close();
  }
}
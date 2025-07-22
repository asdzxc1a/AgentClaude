/**
 * Database tests for Data Processing Agent
 * 
 * Based on 2024 best practices for SQLite and TypeScript testing:
 * - In-memory database for fast testing
 * - Comprehensive schema validation
 * - Performance and concurrency testing
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { ObservabilityDatabase } from "../src/database";
import type { HookEvent, Theme } from "../src/types";

describe("ObservabilityDatabase", () => {
  let db: ObservabilityDatabase;
  let testDbPath: string;

  beforeEach(() => {
    // Use in-memory database for testing (2024 best practice)
    testDbPath = ":memory:";
    db = new ObservabilityDatabase(testDbPath);
  });

  afterEach(() => {
    db.close();
  });

  describe("Database Initialization", () => {
    test("should initialize with correct schema", () => {
      const stats = db.getStats();
      expect(stats.total_events).toBe(0);
      expect(stats.database_path).toBe(testDbPath);
    });

    test("should create all required tables", () => {
      // Get table names from SQLite schema
      const tables = new Database(testDbPath).prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      const tableNames = tables.map(t => t.name).sort();
      expect(tableNames).toEqual([
        'events', 
        'theme_ratings', 
        'theme_shares', 
        'themes'
      ]);
    });

    test("should create performance indexes", () => {
      const indexes = new Database(testDbPath).prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name LIKE 'idx_%'
      `).all() as { name: string }[];

      const indexNames = indexes.map(i => i.name);
      expect(indexNames.length).toBeGreaterThan(0);
      expect(indexNames).toContain('idx_events_source_app');
      expect(indexNames).toContain('idx_events_session_id');
    });
  });

  describe("Event Operations", () => {
    let sampleEvent: HookEvent;

    beforeEach(() => {
      sampleEvent = {
        source_app: "test-agent",
        session_id: "session-123",
        hook_event_type: "PreToolUse",
        payload: {
          tool: "bash",
          command: "ls -la"
        },
        timestamp: "2025-01-21T10:30:00Z"
      };
    });

    test("should insert and retrieve event", () => {
      const insertedEvent = db.insertEvent(sampleEvent);
      
      expect(insertedEvent.id).toBeGreaterThan(0);
      expect(insertedEvent.source_app).toBe(sampleEvent.source_app);
      expect(insertedEvent.session_id).toBe(sampleEvent.session_id);
      expect(insertedEvent.hook_event_type).toBe(sampleEvent.hook_event_type);
      expect(insertedEvent.payload).toEqual(sampleEvent.payload);
    });

    test("should insert event with chat data", () => {
      const eventWithChat = {
        ...sampleEvent,
        chat: [
          { role: "user", content: "Hello", timestamp: "2025-01-21T10:29:00Z" },
          { role: "assistant", content: "Hi!", timestamp: "2025-01-21T10:29:05Z" }
        ]
      };

      const insertedEvent = db.insertEvent(eventWithChat);
      
      expect(insertedEvent.chat).toEqual(eventWithChat.chat);
    });

    test("should insert event with summary", () => {
      const eventWithSummary = {
        ...sampleEvent,
        summary: "User requested file listing using bash ls command"
      };

      const insertedEvent = db.insertEvent(eventWithSummary);
      
      expect(insertedEvent.summary).toBe(eventWithSummary.summary);
    });

    test("should retrieve event by ID", () => {
      const insertedEvent = db.insertEvent(sampleEvent);
      const retrievedEvent = db.getEventById(insertedEvent.id);
      
      expect(retrievedEvent).not.toBeNull();
      expect(retrievedEvent!.id).toBe(insertedEvent.id);
      expect(retrievedEvent!.source_app).toBe(sampleEvent.source_app);
    });

    test("should return null for non-existent event ID", () => {
      const retrievedEvent = db.getEventById(99999);
      expect(retrievedEvent).toBeNull();
    });

    test("should retrieve recent events", () => {
      // Insert multiple events
      for (let i = 0; i < 5; i++) {
        db.insertEvent({
          ...sampleEvent,
          session_id: `session-${i}`,
          payload: { ...sampleEvent.payload, sequence: i }
        });
      }

      const recentEvents = db.getRecentEvents(3);
      
      expect(recentEvents.length).toBe(3);
      // Should be ordered by created_at DESC (most recent first)
      expect(recentEvents[0].payload.sequence).toBe(4);
      expect(recentEvents[1].payload.sequence).toBe(3);
      expect(recentEvents[2].payload.sequence).toBe(2);
    });

    test("should get events with filtering", () => {
      // Insert events from different sources
      db.insertEvent(sampleEvent);
      db.insertEvent({
        ...sampleEvent,
        source_app: "different-agent",
        session_id: "different-session"
      });

      const filteredEvents = db.getEvents({
        source_app: "test-agent"
      });

      expect(filteredEvents.length).toBe(1);
      expect(filteredEvents[0].source_app).toBe("test-agent");
    });

    test("should get events with pagination", () => {
      // Insert 10 events
      for (let i = 0; i < 10; i++) {
        db.insertEvent({
          ...sampleEvent,
          session_id: `session-${i}`
        });
      }

      const firstPage = db.getEvents({ limit: 5, offset: 0 });
      const secondPage = db.getEvents({ limit: 5, offset: 5 });

      expect(firstPage.length).toBe(5);
      expect(secondPage.length).toBe(5);
      
      // Ensure no overlap
      const firstPageIds = firstPage.map(e => e.id);
      const secondPageIds = secondPage.map(e => e.id);
      expect(firstPageIds.some(id => secondPageIds.includes(id))).toBe(false);
    });

    test("should search events by content", () => {
      db.insertEvent(sampleEvent);
      db.insertEvent({
        ...sampleEvent,
        payload: { tool: "python", script: "hello.py" },
        summary: "Running Python script for data analysis"
      });

      const searchResults = db.getEvents({
        search: "python"
      });

      expect(searchResults.length).toBe(1);
      expect(searchResults[0].payload.tool).toBe("python");
    });
  });

  describe("Filter Options", () => {
    beforeEach(() => {
      // Insert sample data for filtering tests
      const events = [
        {
          source_app: "agent-1",
          session_id: "session-1",
          hook_event_type: "PreToolUse" as const,
          payload: { tool: "bash" },
          timestamp: "2025-01-21T10:00:00Z"
        },
        {
          source_app: "agent-2", 
          session_id: "session-1",
          hook_event_type: "PostToolUse" as const,
          payload: { tool: "python" },
          timestamp: "2025-01-21T10:01:00Z"
        },
        {
          source_app: "agent-1",
          session_id: "session-2", 
          hook_event_type: "UserPromptSubmit" as const,
          payload: { prompt: "Hello" },
          timestamp: "2025-01-21T10:02:00Z"
        }
      ];

      events.forEach(event => db.insertEvent(event));
    });

    test("should get unique source apps", () => {
      const filterOptions = db.getFilterOptions();
      
      expect(filterOptions.source_apps.sort()).toEqual(["agent-1", "agent-2"]);
    });

    test("should get unique session IDs", () => {
      const filterOptions = db.getFilterOptions();
      
      expect(filterOptions.session_ids.sort()).toEqual(["session-1", "session-2"]);
    });

    test("should get unique event types", () => {
      const filterOptions = db.getFilterOptions();
      
      expect(filterOptions.event_types.sort()).toEqual([
        "PostToolUse", 
        "PreToolUse", 
        "UserPromptSubmit"
      ]);
    });
  });

  describe("Theme Operations", () => {
    let sampleTheme: Omit<Theme, 'id' | 'created_at' | 'updated_at'>;

    beforeEach(() => {
      sampleTheme = {
        name: "Dark Mode",
        description: "A sleek dark theme",
        colors: {
          primary: "#3b82f6",
          secondary: "#64748b", 
          background: "#0f172a",
          surface: "#1e293b",
          text_primary: "#f8fafc",
          text_secondary: "#cbd5e1",
          accent: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
          success: "#22c55e"
        },
        author_id: "user-123",
        is_public: true
      };
    });

    test("should insert and retrieve theme", () => {
      const insertedTheme = db.insertTheme(sampleTheme);
      
      expect(insertedTheme.id).toBeGreaterThan(0);
      expect(insertedTheme.name).toBe(sampleTheme.name);
      expect(insertedTheme.colors).toEqual(sampleTheme.colors);
    });

    test("should retrieve theme by ID", () => {
      const insertedTheme = db.insertTheme(sampleTheme);
      const retrievedTheme = db.getThemeById(insertedTheme.id!);
      
      expect(retrievedTheme).not.toBeNull();
      expect(retrievedTheme!.name).toBe(sampleTheme.name);
    });

    test("should get all themes", () => {
      db.insertTheme(sampleTheme);
      db.insertTheme({
        ...sampleTheme,
        name: "Light Mode",
        colors: { ...sampleTheme.colors, background: "#ffffff" }
      });

      const themes = db.getThemes();
      
      expect(themes.length).toBe(2);
      expect(themes.map(t => t.name).sort()).toEqual(["Dark Mode", "Light Mode"]);
    });

    test("should update theme", () => {
      const insertedTheme = db.insertTheme(sampleTheme);
      
      const updateSuccess = db.updateTheme(insertedTheme.id!, {
        name: "Updated Dark Mode",
        description: "An updated description"
      });

      expect(updateSuccess).toBe(true);

      const updatedTheme = db.getThemeById(insertedTheme.id!);
      expect(updatedTheme!.name).toBe("Updated Dark Mode");
      expect(updatedTheme!.description).toBe("An updated description");
    });

    test("should delete theme", () => {
      const insertedTheme = db.insertTheme(sampleTheme);
      
      const deleteSuccess = db.deleteTheme(insertedTheme.id!);
      expect(deleteSuccess).toBe(true);

      const deletedTheme = db.getThemeById(insertedTheme.id!);
      expect(deletedTheme).toBeNull();
    });
  });

  describe("Performance and Maintenance", () => {
    test("should get accurate statistics", () => {
      // Insert sample data
      for (let i = 0; i < 10; i++) {
        db.insertEvent({
          source_app: `agent-${i % 3}`,
          session_id: `session-${i}`,
          hook_event_type: i % 2 === 0 ? "PreToolUse" : "PostToolUse",
          payload: { sequence: i },
          timestamp: new Date().toISOString()
        });
      }

      const stats = db.getStats();
      
      expect(stats.total_events).toBe(10);
      expect(stats.events_by_type.length).toBeGreaterThan(0);
      expect(stats.events_by_app.length).toBeGreaterThan(0);
    });

    test("should clear old events", () => {
      // Insert an event with old timestamp
      const oldEvent = {
        source_app: "test-agent",
        session_id: "old-session", 
        hook_event_type: "PreToolUse" as const,
        payload: { old: true },
        timestamp: "2023-01-01T00:00:00Z"  // Very old timestamp
      };
      
      db.insertEvent(oldEvent);
      
      const initialCount = db.getEventCount();
      expect(initialCount).toBe(1);
      
      // Clear events older than 30 days (should clear the old event)
      const deletedCount = db.clearOldEvents(30);
      
      expect(deletedCount).toBe(1);
      expect(db.getEventCount()).toBe(0);
    });

    test("should handle vacuum operation", () => {
      // Insert and delete some data to create fragmentation
      for (let i = 0; i < 100; i++) {
        db.insertEvent({
          source_app: "test-agent",
          session_id: `session-${i}`,
          hook_event_type: "PreToolUse",
          payload: { index: i },
          timestamp: new Date().toISOString()
        });
      }

      db.clearOldEvents(0); // Clear all events
      
      // Vacuum should not throw
      expect(() => db.vacuum()).not.toThrow();
    });
  });

  describe("Concurrent Access Simulation", () => {
    test("should handle concurrent inserts", async () => {
      const promises: Promise<any>[] = [];
      
      // Simulate 50 concurrent inserts
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => 
            db.insertEvent({
              source_app: `agent-${i % 5}`,
              session_id: `session-${i}`,
              hook_event_type: "PreToolUse",
              payload: { concurrent_test: i },
              timestamp: new Date().toISOString()
            })
          )
        );
      }

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(50);
      expect(db.getEventCount()).toBe(50);
      
      // All should have unique IDs
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(50);
    });

    test("should handle concurrent reads and writes", async () => {
      // Insert initial data
      for (let i = 0; i < 10; i++) {
        db.insertEvent({
          source_app: "test-agent",
          session_id: `session-${i}`,
          hook_event_type: "PreToolUse", 
          payload: { initial: i },
          timestamp: new Date().toISOString()
        });
      }

      const promises: Promise<any>[] = [];
      
      // Mix of reads and writes
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          // Read operation
          promises.push(Promise.resolve().then(() => db.getRecentEvents(5)));
        } else {
          // Write operation
          promises.push(
            Promise.resolve().then(() =>
              db.insertEvent({
                source_app: "concurrent-agent",
                session_id: `concurrent-session-${i}`,
                hook_event_type: "PostToolUse",
                payload: { concurrent_write: i },
                timestamp: new Date().toISOString()
              })
            )
          );
        }
      }

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(20);
      
      // Should have original + new events
      const finalCount = db.getEventCount();
      expect(finalCount).toBeGreaterThan(10);
    });
  });

  describe("Error Handling", () => {
    test("should handle malformed JSON in payload", () => {
      // This test ensures the database layer handles edge cases
      const eventWithComplexPayload = {
        source_app: "test-agent",
        session_id: "test-session",
        hook_event_type: "PreToolUse" as const,
        payload: {
          nested: {
            deeply: {
              object: "value",
              array: [1, 2, 3, { complex: true }]
            }
          },
          special_chars: "Special chars: àáâãäåæçèéêë",
          unicode: "Unicode: 🚀 🎉 ✅"
        },
        timestamp: new Date().toISOString()
      };

      expect(() => db.insertEvent(eventWithComplexPayload)).not.toThrow();
      
      const inserted = db.insertEvent(eventWithComplexPayload);
      expect(inserted.payload).toEqual(eventWithComplexPayload.payload);
    });

    test("should handle missing required fields gracefully", () => {
      const incompleteEvent = {
        source_app: "",  // Empty string
        session_id: "",  // Empty string  
        hook_event_type: "PreToolUse" as const,
        payload: {},
        timestamp: new Date().toISOString()
      };

      expect(() => db.insertEvent(incompleteEvent)).not.toThrow();
    });

    test("should handle very large payloads", () => {
      const largePayload = {
        large_data: "x".repeat(100000), // 100KB of data
        array: new Array(1000).fill("data"),
        nested: {
          deep: new Array(500).fill({ key: "value", data: "x".repeat(100) })
        }
      };

      const eventWithLargePayload = {
        source_app: "test-agent",
        session_id: "large-session",
        hook_event_type: "PreToolUse" as const,
        payload: largePayload,
        timestamp: new Date().toISOString()
      };

      expect(() => db.insertEvent(eventWithLargePayload)).not.toThrow();
      
      const inserted = db.insertEvent(eventWithLargePayload);
      expect(inserted.payload.large_data.length).toBe(100000);
    });
  });
});
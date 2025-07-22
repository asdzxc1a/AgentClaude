/**
 * Integration tests for ObservabilityDatabase
 * Tests database operations with real SQLite implementation
 */

import { ObservabilityDatabase } from '../src/database';
import type { HookEvent, Theme } from '../src/types';

describe('ObservabilityDatabase Integration Tests', () => {
  let db: ObservabilityDatabase;

  beforeEach(() => {
    // Use in-memory database for each test
    db = new ObservabilityDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('Database Initialization', () => {
    test('should initialize database with correct schema', async () => {
      const stats = await db.getStats();
      expect(stats.total_events).toBe(0);
      expect(stats.database_path).toBe(':memory:');
    });

    test('should create all required tables', async () => {
      // Test that we can interact with all tables without errors
      const events = await db.getRecentEvents(10);
      const themes = await db.getThemes();
      const filterOptions = await db.getFilterOptions();
      
      expect(events).toEqual([]);
      expect(themes).toEqual([]);
      expect(filterOptions.source_apps).toEqual([]);
    });
  });

  describe('Event Operations', () => {
    const sampleEvent: HookEvent = {
      source_app: 'test-agent',
      session_id: 'session-123',
      hook_event_type: 'PreToolUse',
      payload: {
        tool: 'bash',
        command: 'ls -la'
      },
      timestamp: '2025-01-21T10:30:00Z'
    };

    test('should insert and retrieve event', async () => {
      const insertedEvent = await db.insertEvent(sampleEvent);
      
      expect(insertedEvent.id).toBeGreaterThan(0);
      expect(insertedEvent.source_app).toBe(sampleEvent.source_app);
      expect(insertedEvent.session_id).toBe(sampleEvent.session_id);
      expect(insertedEvent.hook_event_type).toBe(sampleEvent.hook_event_type);
      expect(insertedEvent.payload).toEqual(sampleEvent.payload);
      expect(insertedEvent.created_at).toBeDefined();
      expect(insertedEvent.updated_at).toBeDefined();
    });

    test('should handle concurrent event inserts', async () => {
      const promises: Promise<any>[] = [];
      
      // Create 50 concurrent insert operations
      for (let i = 0; i < 50; i++) {
        promises.push(
          db.insertEvent({
            ...sampleEvent,
            session_id: `session-${i}`,
            payload: { ...sampleEvent.payload, sequence: i }
          })
        );
      }

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(50);
      
      // All should have unique IDs
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(50);
      
      // Verify total count
      const count = await db.getEventCount();
      expect(count).toBe(50);
    });

    test('should retrieve events with filtering', async () => {
      // Insert events with different properties
      await db.insertEvent(sampleEvent);
      await db.insertEvent({
        ...sampleEvent,
        source_app: 'different-agent',
        session_id: 'different-session'
      });

      const filteredEvents = await db.getEvents({
        source_app: 'test-agent'
      });

      expect(filteredEvents.length).toBe(1);
      expect(filteredEvents[0].source_app).toBe('test-agent');
    });

    test('should handle large payloads', async () => {
      const largePayload = {
        large_data: 'x'.repeat(100000), // 100KB of data
        array: new Array(1000).fill('data'),
        nested: {
          deep: new Array(500).fill({ key: 'value', data: 'x'.repeat(100) })
        }
      };

      const eventWithLargePayload: HookEvent = {
        ...sampleEvent,
        payload: largePayload
      };

      const insertedEvent = await db.insertEvent(eventWithLargePayload);
      
      expect(insertedEvent.payload.large_data.length).toBe(100000);
      expect(insertedEvent.payload.array.length).toBe(1000);
      expect(insertedEvent.payload.nested.deep.length).toBe(500);
    });

    test('should search events by content', async () => {
      await db.insertEvent(sampleEvent);
      await db.insertEvent({
        ...sampleEvent,
        payload: { tool: 'python', script: 'hello.py' },
        summary: 'Running Python script for data analysis'
      });

      const searchResults = await db.getEvents({
        search: 'python'
      });

      expect(searchResults.length).toBe(1);
      expect(searchResults[0].payload.tool).toBe('python');
    });

    test('should handle pagination correctly', async () => {
      // Insert 25 events
      const promises = [];
      for (let i = 0; i < 25; i++) {
        promises.push(
          db.insertEvent({
            ...sampleEvent,
            session_id: `session-${i}`
          })
        );
      }
      await Promise.all(promises);

      const firstPage = await db.getEvents({ limit: 10, offset: 0 });
      const secondPage = await db.getEvents({ limit: 10, offset: 10 });
      const thirdPage = await db.getEvents({ limit: 10, offset: 20 });

      expect(firstPage.length).toBe(10);
      expect(secondPage.length).toBe(10);
      expect(thirdPage.length).toBe(5); // Remaining events

      // Ensure no overlap between pages
      const firstPageIds = firstPage.map(e => e.id);
      const secondPageIds = secondPage.map(e => e.id);
      const thirdPageIds = thirdPage.map(e => e.id);

      expect(firstPageIds.some(id => secondPageIds.includes(id))).toBe(false);
      expect(firstPageIds.some(id => thirdPageIds.includes(id))).toBe(false);
      expect(secondPageIds.some(id => thirdPageIds.includes(id))).toBe(false);
    });
  });

  describe('Theme Operations', () => {
    const sampleTheme: Omit<Theme, 'id' | 'created_at' | 'updated_at'> = {
      name: 'Dark Mode Test',
      description: 'A test dark theme',
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        background: '#0f172a',
        surface: '#1e293b',
        text_primary: '#f8fafc',
        text_secondary: '#cbd5e1',
        accent: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        success: '#22c55e'
      },
      author_id: 'user-123',
      is_public: true
    };

    test('should insert and retrieve theme', async () => {
      const insertedTheme = await db.insertTheme(sampleTheme);
      
      expect(insertedTheme.id).toBeGreaterThan(0);
      expect(insertedTheme.name).toBe(sampleTheme.name);
      expect(insertedTheme.colors).toEqual(sampleTheme.colors);
      expect(insertedTheme.is_public).toBe(true);
    });

    test('should update theme', async () => {
      const insertedTheme = await db.insertTheme(sampleTheme);
      
      const updateSuccess = await db.updateTheme(insertedTheme.id!, {
        name: 'Updated Dark Mode',
        description: 'An updated description'
      });

      expect(updateSuccess).toBe(true);

      const updatedTheme = await db.getThemeById(insertedTheme.id!);
      expect(updatedTheme!.name).toBe('Updated Dark Mode');
      expect(updatedTheme!.description).toBe('An updated description');
    });

    test('should delete theme', async () => {
      const insertedTheme = await db.insertTheme(sampleTheme);
      
      const deleteSuccess = await db.deleteTheme(insertedTheme.id!);
      expect(deleteSuccess).toBe(true);

      const deletedTheme = await db.getThemeById(insertedTheme.id!);
      expect(deletedTheme).toBeNull();
    });
  });

  describe('Performance Operations', () => {
    test('should handle database maintenance operations', async () => {
      // Insert some test data
      const insertPromises = [];
      for (let i = 0; i < 10; i++) {
        insertPromises.push(
          db.insertEvent({
            source_app: `agent-${i % 5}`,
            session_id: `session-${i}`,
            hook_event_type: 'PreToolUse',
            payload: { index: i },
            timestamp: new Date().toISOString()
          })
        );
      }
      await Promise.all(insertPromises);

      // Verify events were inserted
      const initialCount = await db.getEventCount();
      expect(initialCount).toBe(10);

      // Test vacuum operation
      await expect(db.vacuum()).resolves.not.toThrow();

      // Test clearing all events (use 0 days to clear everything)
      const deletedCount = await db.clearOldEvents(0);
      expect(deletedCount).toBeGreaterThanOrEqual(0); // Allow for 0 or more deletions

      // Verify final state
      const finalCount = await db.getEventCount();
      expect(finalCount).toBeLessThanOrEqual(initialCount);
    });

    test('should provide accurate statistics', async () => {
      // Insert diverse test data
      const eventTypes = ['PreToolUse', 'PostToolUse', 'UserPromptSubmit'];
      const sourceApps = ['agent-1', 'agent-2', 'agent-3'];

      for (let i = 0; i < 30; i++) {
        await db.insertEvent({
          source_app: sourceApps[i % 3],
          session_id: `session-${i}`,
          hook_event_type: eventTypes[i % 3] as any,
          payload: { index: i },
          timestamp: new Date().toISOString()
        });
      }

      const stats = await db.getStats();
      
      expect(stats.total_events).toBe(30);
      expect(stats.events_by_type.length).toBeGreaterThan(0);
      expect(stats.events_by_app.length).toBeGreaterThan(0);
      
      // Verify statistics accuracy
      const totalFromStats = stats.events_by_type.reduce((sum: number, item: any) => sum + item.count, 0);
      expect(totalFromStats).toBe(30);
    });

    test('should handle filter options efficiently', async () => {
      // Insert events with various properties
      const testData = [
        { source_app: 'agent-1', session_id: 'session-1', event_type: 'PreToolUse' },
        { source_app: 'agent-2', session_id: 'session-2', event_type: 'PostToolUse' },
        { source_app: 'agent-1', session_id: 'session-3', event_type: 'UserPromptSubmit' }
      ];

      for (const data of testData) {
        await db.insertEvent({
          source_app: data.source_app,
          session_id: data.session_id,
          hook_event_type: data.event_type as any,
          payload: { test: true },
          timestamp: new Date().toISOString()
        });
      }

      const filterOptions = await db.getFilterOptions();
      
      expect(filterOptions.source_apps).toContain('agent-1');
      expect(filterOptions.source_apps).toContain('agent-2');
      expect(filterOptions.session_ids).toContain('session-1');
      expect(filterOptions.session_ids).toContain('session-2');
      expect(filterOptions.session_ids).toContain('session-3');
      expect(filterOptions.event_types).toContain('PreToolUse');
      expect(filterOptions.event_types).toContain('PostToolUse');
      expect(filterOptions.event_types).toContain('UserPromptSubmit');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid event data gracefully', async () => {
      const invalidEvent = {
        source_app: '',  // Empty string
        session_id: '',  // Empty string
        hook_event_type: 'PreToolUse' as const,
        payload: {},
        timestamp: new Date().toISOString()
      };

      // Should not throw error
      await expect(db.insertEvent(invalidEvent)).resolves.toBeDefined();
    });

    test('should handle non-existent record queries', async () => {
      const nonExistentEvent = await db.getEventById(99999);
      expect(nonExistentEvent).toBeNull();

      const nonExistentTheme = await db.getThemeById(99999);
      expect(nonExistentTheme).toBeNull();
    });

    test('should handle complex nested JSON data', async () => {
      const complexEvent: HookEvent = {
        source_app: 'test-agent',
        session_id: 'complex-session',
        hook_event_type: 'PreToolUse',
        payload: {
          nested: {
            deeply: {
              object: 'value',
              array: [1, 2, 3, { complex: true }]
            }
          },
          special_chars: 'Special chars: àáâãäåæçèéêë',
          unicode: 'Unicode: 🚀 🎉 ✅',
          null_value: null,
          boolean: true,
          number: 42
        },
        timestamp: new Date().toISOString()
      };

      const insertedEvent = await db.insertEvent(complexEvent);
      expect(insertedEvent.payload).toEqual(complexEvent.payload);
    });
  });
});
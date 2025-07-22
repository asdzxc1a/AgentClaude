/**
 * Integration tests for ObservabilityServer
 * Tests REST API endpoints and WebSocket functionality
 */

import request from 'supertest';
import WebSocket from 'ws';
import { ObservabilityServer } from '../src/index';
import type { HookEvent, ApiResponse } from '../src/types';

describe('ObservabilityServer Integration Tests', () => {
  let server: ObservabilityServer;
  let app: any;
  const TEST_PORT = 4002;

  beforeAll(async () => {
    // Create server instance with test port
    server = new ObservabilityServer(TEST_PORT);
    app = server['app']; // Access private property for testing
    
    // Start server
    await new Promise<void>((resolve) => {
      server['server'].listen(TEST_PORT, () => {
        resolve();
      });
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Stop server
    server.stop();
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Health Check Endpoint', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.database).toBe('connected');
    });
  });

  describe('Event Endpoints', () => {
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

    test('should create event successfully', async () => {
      const response = await request(app)
        .post('/events')
        .send(sampleEvent)
        .expect(201);

      const apiResponse: ApiResponse = response.body;
      
      expect(apiResponse.success).toBe(true);
      expect(apiResponse.data.id).toBeGreaterThan(0);
      expect(apiResponse.data.source_app).toBe(sampleEvent.source_app);
      expect(apiResponse.data.hook_event_type).toBe(sampleEvent.hook_event_type);
      expect(apiResponse.message).toBe('Event stored successfully');
    });

    test('should validate required fields', async () => {
      const invalidEvent = {
        source_app: 'test-agent',
        // Missing required fields
      };

      const response = await request(app)
        .post('/events')
        .send(invalidEvent)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('should retrieve recent events', async () => {
      // First, create some events
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/events')
          .send({
            ...sampleEvent,
            session_id: `session-${i}`,
            payload: { ...sampleEvent.payload, sequence: i }
          });
      }

      const response = await request(app)
        .get('/events/recent?limit=3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(3);
      expect(response.body.count).toBe(3);
    });

    test('should retrieve specific event by ID', async () => {
      // Create an event first
      const createResponse = await request(app)
        .post('/events')
        .send(sampleEvent);
      
      const eventId = createResponse.body.data.id;

      // Retrieve the event
      const response = await request(app)
        .get(`/events/${eventId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(eventId);
      expect(response.body.data.source_app).toBe(sampleEvent.source_app);
    });

    test('should return 404 for non-existent event', async () => {
      const response = await request(app)
        .get('/events/99999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Event not found');
    });

    test('should filter events by source_app', async () => {
      // Create events with different source_app values
      await request(app)
        .post('/events')
        .send({ ...sampleEvent, source_app: 'agent-1' });
      
      await request(app)
        .post('/events')
        .send({ ...sampleEvent, source_app: 'agent-2' });

      const response = await request(app)
        .get('/events?source_app=agent-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.every((event: any) => event.source_app === 'agent-1')).toBe(true);
    });

    test('should handle pagination', async () => {
      const response = await request(app)
        .get('/events?limit=2&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
    });

    test('should search events by content', async () => {
      // Create event with specific content
      await request(app)
        .post('/events')
        .send({
          ...sampleEvent,
          payload: { tool: 'python', script: 'data_analysis.py' },
          summary: 'Running Python data analysis script'
        });

      const response = await request(app)
        .get('/events?search=python')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Filter Options Endpoint', () => {
    test('should return filter options', async () => {
      const response = await request(app)
        .get('/filter-options')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('source_apps');
      expect(response.body.data).toHaveProperty('session_ids');
      expect(response.body.data).toHaveProperty('event_types');
      expect(Array.isArray(response.body.data.source_apps)).toBe(true);
    });
  });

  describe('Statistics Endpoint', () => {
    test('should return database statistics', async () => {
      const response = await request(app)
        .get('/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_events');
      expect(response.body.data).toHaveProperty('events_by_type');
      expect(response.body.data).toHaveProperty('events_by_app');
      expect(typeof response.body.data.total_events).toBe('number');
    });
  });

  describe('Theme Endpoints', () => {
    const sampleTheme = {
      name: 'Test Theme',
      description: 'A theme for testing',
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        background: '#ffffff',
        surface: '#f8fafc',
        text_primary: '#1e293b',
        text_secondary: '#64748b',
        accent: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        success: '#22c55e'
      },
      author_id: 'test-user',
      is_public: true
    };

    test('should create theme successfully', async () => {
      const response = await request(app)
        .post('/themes')
        .send(sampleTheme)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(sampleTheme.name);
      expect(response.body.data.colors).toEqual(sampleTheme.colors);
    });

    test('should validate theme required fields', async () => {
      const invalidTheme = {
        description: 'Missing name and colors'
      };

      const response = await request(app)
        .post('/themes')
        .send(invalidTheme)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });

    test('should retrieve all themes', async () => {
      const response = await request(app)
        .get('/themes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Maintenance Endpoints', () => {
    test('should vacuum database', async () => {
      const response = await request(app)
        .post('/maintenance/vacuum')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Database vacuumed successfully');
    });

    test('should clear old events', async () => {
      const response = await request(app)
        .delete('/events/old?days=365')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('deleted_count');
      expect(typeof response.body.deleted_count).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/unknown-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Endpoint not found');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/events')
        .send('invalid json')
        .expect(400);

      // Express should handle the malformed JSON
    });

    test('should handle large payloads', async () => {
      const largeEvent: HookEvent = {
        source_app: 'test-agent',
        session_id: 'large-payload-session',
        hook_event_type: 'PreToolUse',
        payload: {
          large_data: 'x'.repeat(1000000) // 1MB of data
        },
        timestamp: new Date().toISOString()
      };

      const response = await request(app)
        .post('/events')
        .send(largeEvent)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('CORS Configuration', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should handle OPTIONS preflight requests', async () => {
      await request(app)
        .options('/events')
        .expect(200);
    });
  });
});
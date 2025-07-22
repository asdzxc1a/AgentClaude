/**
 * Data Processing Agent - Main Server
 * 
 * Express server with WebSocket support for real-time event broadcasting
 * Provides REST API for event ingestion and retrieval
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { ObservabilityDatabase } from './database';
import type { HookEvent, WebSocketMessage, ApiResponse } from './types';

class ObservabilityServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private db: ObservabilityDatabase;
  private port: number;

  constructor(port: number = 4000) {
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    this.db = new ObservabilityDatabase();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    // Enable CORS for all origins in development
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Parse JSON payloads
    this.app.use(express.json({ limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    });

    // Event endpoints
    this.app.post('/events', async (req, res) => {
      try {
        const event: HookEvent = req.body;
        
        // Validate required fields
        if (!event.source_app || !event.session_id || !event.hook_event_type || !event.payload) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: source_app, session_id, hook_event_type, payload'
          });
        }

        // Add timestamp if not provided
        if (!event.timestamp) {
          event.timestamp = new Date().toISOString();
        }

        const insertedEvent = await this.db.insertEvent(event);
        
        // Broadcast to WebSocket clients
        this.broadcastEvent({
          type: 'event',
          data: insertedEvent,
          timestamp: new Date().toISOString()
        });

        const response: ApiResponse = {
          success: true,
          data: insertedEvent,
          message: 'Event stored successfully'
        };

        res.status(201).json(response);
      } catch (error: any) {
        console.error('Error storing event:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to store event',
          message: error.message
        });
      }
    });

    this.app.get('/events/recent', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const events = await this.db.getRecentEvents(limit);
        
        res.json({
          success: true,
          data: events,
          count: events.length
        });
      } catch (error: any) {
        console.error('Error retrieving recent events:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve events',
          message: error.message
        });
      }
    });

    this.app.get('/events', async (req, res) => {
      try {
        const queryParams = {
          limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
          offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
          source_app: req.query.source_app as string,
          session_id: req.query.session_id as string,
          event_type: req.query.event_type as any,
          start_time: req.query.start_time as string,
          end_time: req.query.end_time as string,
          search: req.query.search as string
        };

        const events = await this.db.getEvents(queryParams);
        
        res.json({
          success: true,
          data: events,
          count: events.length
        });
      } catch (error: any) {
        console.error('Error retrieving events:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve events',
          message: error.message
        });
      }
    });

    this.app.get('/events/:id', async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const event = await this.db.getEventById(id);
        
        if (!event) {
          return res.status(404).json({
            success: false,
            error: 'Event not found'
          });
        }

        res.json({
          success: true,
          data: event
        });
      } catch (error: any) {
        console.error('Error retrieving event:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve event',
          message: error.message
        });
      }
    });

    // Filter options endpoint
    this.app.get('/filter-options', async (req, res) => {
      try {
        const options = await this.db.getFilterOptions();
        res.json({
          success: true,
          data: options
        });
      } catch (error: any) {
        console.error('Error retrieving filter options:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve filter options',
          message: error.message
        });
      }
    });

    // Statistics endpoint
    this.app.get('/stats', async (req, res) => {
      try {
        const stats = await this.db.getStats();
        res.json({
          success: true,
          data: stats
        });
      } catch (error: any) {
        console.error('Error retrieving stats:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve stats',
          message: error.message
        });
      }
    });

    // Theme endpoints
    this.app.get('/themes', async (req, res) => {
      try {
        const themes = await this.db.getThemes();
        res.json({
          success: true,
          data: themes
        });
      } catch (error: any) {
        console.error('Error retrieving themes:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve themes',
          message: error.message
        });
      }
    });

    this.app.post('/themes', async (req, res) => {
      try {
        const theme = req.body;
        
        if (!theme.name || !theme.colors) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: name, colors'
          });
        }

        const insertedTheme = await this.db.insertTheme(theme);
        
        res.status(201).json({
          success: true,
          data: insertedTheme
        });
      } catch (error: any) {
        console.error('Error storing theme:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to store theme',
          message: error.message
        });
      }
    });

    // Database maintenance endpoints
    this.app.post('/maintenance/vacuum', async (req, res) => {
      try {
        await this.db.vacuum();
        res.json({
          success: true,
          message: 'Database vacuumed successfully'
        });
      } catch (error: any) {
        console.error('Error vacuuming database:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to vacuum database',
          message: error.message
        });
      }
    });

    this.app.delete('/events/old', async (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const deletedCount = await this.db.clearOldEvents(days);
        
        res.json({
          success: true,
          message: `Deleted ${deletedCount} old events`,
          deleted_count: deletedCount
        });
      } catch (error: any) {
        console.error('Error clearing old events:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to clear old events',
          message: error.message
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
      });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws, req) => {
      console.log(`WebSocket client connected from ${req.socket.remoteAddress}`);

      // Send initial data
      this.sendInitialData(ws);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('Received WebSocket message:', message);
          
          // Handle client messages (filters, requests, etc.)
          this.handleWebSocketMessage(ws, message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid JSON message' }
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  private async sendInitialData(ws: any): Promise<void> {
    try {
      const recentEvents = await this.db.getRecentEvents(50);
      const stats = await this.db.getStats();
      
      ws.send(JSON.stringify({
        type: 'initial',
        data: {
          events: recentEvents,
          stats: stats
        },
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }

  private async handleWebSocketMessage(ws: any, message: any): Promise<void> {
    switch (message.type) {
      case 'filter':
        try {
          const events = await this.db.getEvents(message.data);
          ws.send(JSON.stringify({
            type: 'filter',
            data: events,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Failed to filter events' }
          }));
        }
        break;
      
      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` }
        }));
    }
  }

  private broadcastEvent(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    this.wss.clients.forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(messageStr);
      }
    });
  }

  public start(): void {
    this.server.listen(this.port, () => {
      console.log(`🚀 Data Processing Agent running on port ${this.port}`);
      console.log(`📊 REST API available at http://localhost:${this.port}`);
      console.log(`🔌 WebSocket streaming at ws://localhost:${this.port}`);
      console.log(`📈 Health check: http://localhost:${this.port}/health`);
    });
  }

  public stop(): void {
    this.server.close();
    this.db.close();
  }
}

// Start the server
if (require.main === module) {
  const server = new ObservabilityServer();
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
}

export { ObservabilityServer };
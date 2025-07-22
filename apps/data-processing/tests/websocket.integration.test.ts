/**
 * Integration tests for WebSocket functionality
 * Tests real-time event broadcasting and client communication
 */

import WebSocket from 'ws';
import request from 'supertest';
import { ObservabilityServer } from '../src/index';
import type { HookEvent, WebSocketMessage } from '../src/types';

describe('WebSocket Integration Tests', () => {
  let server: ObservabilityServer;
  let app: any;
  const TEST_PORT = 4003;
  const WS_URL = `ws://localhost:${TEST_PORT}`;

  beforeAll(async () => {
    // Create and start server
    server = new ObservabilityServer(TEST_PORT);
    app = server['app'];
    
    await new Promise<void>((resolve) => {
      server['server'].listen(TEST_PORT, () => {
        resolve();
      });
    });
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    server.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('WebSocket Connection', () => {
    test('should establish WebSocket connection', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    test('should receive initial data on connection', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Initial data timeout'));
        }, 5000);

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'initial') {
              expect(message.data).toHaveProperty('events');
              expect(message.data).toHaveProperty('stats');
              expect(message.timestamp).toBeDefined();
              expect(Array.isArray(message.data.events)).toBe(true);
              
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('Real-time Event Broadcasting', () => {
    test('should broadcast new events to connected clients', async () => {
      const sampleEvent: HookEvent = {
        source_app: 'test-agent',
        session_id: 'websocket-test',
        hook_event_type: 'PreToolUse',
        payload: {
          tool: 'bash',
          command: 'echo "WebSocket test"'
        },
        timestamp: new Date().toISOString()
      };

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        let initialMessageReceived = false;
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Event broadcast timeout'));
        }, 10000);

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'initial' && !initialMessageReceived) {
              initialMessageReceived = true;
              
              // Send a new event via HTTP API after receiving initial data
              setTimeout(async () => {
                try {
                  await request(app)
                    .post('/events')
                    .send(sampleEvent);
                } catch (error) {
                  clearTimeout(timeout);
                  ws.close();
                  reject(error);
                }
              }, 100);
              
            } else if (message.type === 'event') {
              // Verify the broadcasted event
              expect(message.data.source_app).toBe(sampleEvent.source_app);
              expect(message.data.session_id).toBe(sampleEvent.session_id);
              expect(message.data.hook_event_type).toBe(sampleEvent.hook_event_type);
              expect(message.data.payload).toEqual(sampleEvent.payload);
              expect(message.timestamp).toBeDefined();
              
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    test('should broadcast to multiple clients simultaneously', async () => {
      const clientCount = 3;
      const clients: WebSocket[] = [];
      const receivedMessages: WebSocketMessage[][] = Array(clientCount).fill(null).map(() => []);
      
      // Create multiple WebSocket connections
      const connectionPromises = Array(clientCount).fill(null).map((_, index) => {
        return new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(WS_URL);
          clients[index] = ws;
          
          const timeout = setTimeout(() => {
            reject(new Error(`Client ${index} connection timeout`));
          }, 5000);

          ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });

          ws.on('message', (data) => {
            const message: WebSocketMessage = JSON.parse(data.toString());
            receivedMessages[index].push(message);
          });

          ws.on('error', reject);
        });
      });

      try {
        // Wait for all connections to be established
        await Promise.all(connectionPromises);
        
        // Wait for initial messages
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Send an event
        const testEvent: HookEvent = {
          source_app: 'multi-client-test',
          session_id: 'session-broadcast',
          hook_event_type: 'PostToolUse',
          payload: { result: 'multi-client broadcast test' },
          timestamp: new Date().toISOString()
        };

        await request(app)
          .post('/events')
          .send(testEvent);

        // Wait for broadcast to reach all clients
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify all clients received the event
        for (let i = 0; i < clientCount; i++) {
          const eventMessages = receivedMessages[i].filter(msg => msg.type === 'event');
          expect(eventMessages.length).toBeGreaterThan(0);
          
          const lastEventMessage = eventMessages[eventMessages.length - 1];
          expect(lastEventMessage.data.source_app).toBe(testEvent.source_app);
        }

      } finally {
        // Clean up connections
        clients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
      }
    });
  });

  describe('WebSocket Message Handling', () => {
    test('should handle filter requests from clients', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        let initialReceived = false;
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Filter request timeout'));
        }, 10000);

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'initial' && !initialReceived) {
              initialReceived = true;
              
              // Send a filter request
              ws.send(JSON.stringify({
                type: 'filter',
                data: {
                  source_app: 'test-agent',
                  limit: 10
                }
              }));
              
            } else if (message.type === 'filter') {
              // Verify filter response
              expect(Array.isArray(message.data)).toBe(true);
              expect(message.timestamp).toBeDefined();
              
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    test('should handle invalid message format', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        let initialReceived = false;
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Invalid message handling timeout'));
        }, 10000);

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'initial' && !initialReceived) {
              initialReceived = true;
              
              // Send invalid JSON
              ws.send('invalid json message');
              
            } else if (message.type === 'error') {
              // Verify error handling
              expect(message.data.message).toContain('Invalid JSON');
              
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    test('should handle unknown message types', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        let initialReceived = false;
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Unknown message type timeout'));
        }, 10000);

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'initial' && !initialReceived) {
              initialReceived = true;
              
              // Send unknown message type
              ws.send(JSON.stringify({
                type: 'unknown_type',
                data: { test: true }
              }));
              
            } else if (message.type === 'error') {
              // Verify error handling for unknown type
              expect(message.data.message).toContain('Unknown message type');
              
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });
  });

  describe('WebSocket Performance', () => {
    test('should handle high-frequency event broadcasting', async () => {
      const eventCount = 50;
      const events: HookEvent[] = [];
      
      // Create test events
      for (let i = 0; i < eventCount; i++) {
        events.push({
          source_app: `performance-test-${i % 5}`,
          session_id: `session-${i}`,
          hook_event_type: 'PreToolUse',
          payload: { sequence: i, timestamp: Date.now() },
          timestamp: new Date().toISOString()
        });
      }

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        const receivedEvents: any[] = [];
        let initialReceived = false;
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error(`Performance test timeout. Received ${receivedEvents.length}/${eventCount} events`));
        }, 15000);

        ws.on('message', (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            
            if (message.type === 'initial' && !initialReceived) {
              initialReceived = true;
              
              // Send all events rapidly
              Promise.all(events.map(event => 
                request(app).post('/events').send(event)
              )).catch(reject);
              
            } else if (message.type === 'event') {
              receivedEvents.push(message.data);
              
              // Check if we received all events
              if (receivedEvents.length >= eventCount) {
                // Verify we received unique events
                const uniqueSequences = new Set(receivedEvents.map(e => e.payload.sequence));
                expect(uniqueSequences.size).toBe(eventCount);
                
                clearTimeout(timeout);
                ws.close();
                resolve();
              }
            }
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    });

    test('should handle client disconnections gracefully', async () => {
      const clients: WebSocket[] = [];
      
      try {
        // Create multiple connections
        for (let i = 0; i < 3; i++) {
          const ws = new WebSocket(WS_URL);
          clients.push(ws);
          
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
            
            ws.on('open', () => {
              clearTimeout(timeout);
              resolve();
            });
            
            ws.on('error', reject);
          });
        }

        // Close some connections abruptly
        clients[0].terminate(); // Abrupt termination
        clients[1].close(1000, 'Normal closure'); // Graceful closure
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Send an event - should only reach remaining client
        const testEvent: HookEvent = {
          source_app: 'disconnection-test',
          session_id: 'session-disconnect',
          hook_event_type: 'PreToolUse',
          payload: { test: 'disconnection handling' },
          timestamp: new Date().toISOString()
        };

        await request(app)
          .post('/events')
          .send(testEvent);

        // Verify remaining client receives the event
        const remainingClient = clients[2];
        let eventReceived = false;
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (eventReceived) {
              resolve();
            } else {
              reject(new Error('Event not received by remaining client'));
            }
          }, 3000);

          remainingClient.on('message', (data) => {
            const message: WebSocketMessage = JSON.parse(data.toString());
            if (message.type === 'event' && message.data.source_app === testEvent.source_app) {
              eventReceived = true;
              clearTimeout(timeout);
              resolve();
            }
          });
        });

      } finally {
        // Clean up any remaining connections
        clients.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        });
      }
    });
  });
});
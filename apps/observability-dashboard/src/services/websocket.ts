import type { WebSocketMessage } from '@/types'

interface WebSocketEventHandlers {
  onOpen?: () => void
  onMessage?: (message: WebSocketMessage) => void
  onClose?: (event: CloseEvent) => void
  onError?: (error: Event) => void
  onReconnecting?: (attempt: number) => void
  onReconnected?: () => void
  onConnectionHealthChange?: (isHealthy: boolean) => void
}

interface QueuedMessage {
  message: WebSocketMessage
  timestamp: number
  retryCount: number
}

interface SubscriptionInfo {
  eventType: string
  subscribed: boolean
  lastActivity: number
}

class WebSocketService {
  private connection: WebSocket | null = null
  private url: string = ''
  private handlers: WebSocketEventHandlers = {}
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private baseReconnectDelay = 1000
  private maxReconnectDelay = 30000
  private reconnectBackoffMultiplier = 1.5
  private isManualClose = false
  private heartbeatInterval: number | null = null
  private lastPongTime = 0
  private heartbeatTimeout = 30000
  private heartbeatInterval_ms = 15000
  
  // Message queuing for offline buffering
  private messageQueue: QueuedMessage[] = []
  private maxQueueSize = 100
  private maxRetryCount = 3
  private queueProcessingInterval: number | null = null
  
  // Subscription management
  private subscriptions: Map<string, SubscriptionInfo> = new Map()
  private subscriptionCleanupInterval: number | null = null
  private subscriptionTimeout = 300000 // 5 minutes
  
  // Connection health monitoring
  private connectionHealthy = false
  private healthCheckInterval: number | null = null
  private consecutiveFailures = 0
  private maxConsecutiveFailures = 3

  connect(url: string, handlers: WebSocketEventHandlers): WebSocket {
    this.url = url
    this.handlers = handlers
    this.isManualClose = false

    // Notify about reconnection attempt
    if (this.reconnectAttempts > 0 && handlers.onReconnecting) {
      handlers.onReconnecting(this.reconnectAttempts)
    }

    try {
      this.connection = new WebSocket(url)
      this.setupEventListeners()
      this.startConnectionHealthMonitoring()
      return this.connection
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      this.consecutiveFailures++
      this.updateConnectionHealth(false)
      
      if (handlers.onError) {
        handlers.onError(new Event('error'))
      }
      
      // Schedule reconnection on connection failure
      if (!this.isManualClose) {
        this.scheduleReconnect()
      }
      
      throw error
    }
  }

  private setupEventListeners(): void {
    if (!this.connection) return

    this.connection.onopen = (event) => {
      console.log('WebSocket connection opened')
      const wasReconnecting = this.reconnectAttempts > 0
      
      this.reconnectAttempts = 0
      this.consecutiveFailures = 0
      this.updateConnectionHealth(true)
      this.startHeartbeat()
      this.startQueueProcessing()
      this.startSubscriptionCleanup()
      
      // Resubscribe to active subscriptions
      this.resubscribeAll()
      
      // Process queued messages
      this.processMessageQueue()
      
      if (wasReconnecting && this.handlers.onReconnected) {
        this.handlers.onReconnected()
      }
      
      if (this.handlers.onOpen) {
        this.handlers.onOpen()
      }
    }

    this.connection.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        
        // Handle pong messages for heartbeat
        if (message.type === 'pong') {
          this.lastPongTime = Date.now()
          return
        }

        console.log('WebSocket message received:', message.type)
        
        if (this.handlers.onMessage) {
          this.handlers.onMessage(message)
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    this.connection.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason)
      this.stopHeartbeat()
      this.stopQueueProcessing()
      this.stopSubscriptionCleanup()
      this.stopConnectionHealthMonitoring()
      this.updateConnectionHealth(false)
      
      if (this.handlers.onClose) {
        this.handlers.onClose(event)
      }

      // Attempt to reconnect unless it was a manual close
      if (!this.isManualClose && this.shouldReconnect(event.code)) {
        this.scheduleReconnect()
      }
    }

    this.connection.onerror = (error) => {
      console.error('WebSocket error:', error)
      
      if (this.handlers.onError) {
        this.handlers.onError(error)
      }
    }
  }

  private shouldReconnect(closeCode: number): boolean {
    // Don't reconnect for these close codes
    const noReconnectCodes = [1000, 1001, 1005, 4000, 4001, 4002, 4003]
    return !noReconnectCodes.includes(closeCode) && 
           this.reconnectAttempts < this.maxReconnectAttempts
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000)

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(() => {
      if (!this.isManualClose) {
        this.connect(this.url, this.handlers)
      }
    }, delay)
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.lastPongTime = Date.now()

    this.heartbeatInterval = window.setInterval(() => {
      if (this.connection?.readyState === WebSocket.OPEN) {
        // Send ping
        this.send({
          type: 'ping',
          data: null,
          timestamp: new Date().toISOString()
        })

        // Check if we received a pong recently
        const timeSinceLastPong = Date.now() - this.lastPongTime
        if (timeSinceLastPong > 30000) { // 30 seconds timeout
          console.warn('WebSocket heartbeat timeout, closing connection')
          this.connection.close(4000, 'Heartbeat timeout')
        }
      }
    }, 15000) // Send ping every 15 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  send(message: WebSocketMessage): boolean {
    if (this.connection?.readyState === WebSocket.OPEN) {
      try {
        this.connection.send(JSON.stringify(message))
        return true
      } catch (error) {
        console.error('Failed to send WebSocket message:', error)
        return false
      }
    } else {
      console.warn('WebSocket is not connected, cannot send message')
      return false
    }
  }

  close(code = 1000, reason = 'Manual close'): void {
    this.isManualClose = true
    this.stopHeartbeat()
    
    if (this.connection) {
      this.connection.close(code, reason)
      this.connection = null
    }
  }

  getReadyState(): number {
    return this.connection?.readyState ?? WebSocket.CLOSED
  }

  getUrl(): string {
    return this.url
  }

  isConnected(): boolean {
    return this.connection?.readyState === WebSocket.OPEN
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts
  }

  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0
    this.reconnectDelay = 1000
  }

  // Subscribe to specific event types
  subscribe(eventType: string): void {
    this.send({
      type: 'subscribe',
      data: { eventType },
      timestamp: new Date().toISOString()
    })
  }

  // Unsubscribe from specific event types
  unsubscribe(eventType: string): void {
    this.send({
      type: 'unsubscribe',
      data: { eventType },
      timestamp: new Date().toISOString()
    })
  }

  // Request recent events
  requestRecentEvents(limit = 50): void {
    this.send({
      type: 'request_recent_events',
      data: { limit },
      timestamp: new Date().toISOString()
    })
  }

  // Request statistics
  requestStats(): void {
    this.send({
      type: 'request_stats',
      data: null,
      timestamp: new Date().toISOString()
    })
  }
}

// Export singleton instance
export const websocketService = new WebSocketService()
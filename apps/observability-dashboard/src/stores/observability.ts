import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import type { 
  DatabaseEvent, 
  HookEventType, 
  FilterOptions, 
  AgentInfo, 
  EventStats, 
  DashboardMetrics,
  ConnectionState,
  WebSocketMessage,
  ApiResponse
} from '@/types'
import { apiService } from '@/services/api'
import { websocketService } from '@/services/websocket'

export const useObservabilityStore = defineStore('observability', () => {
  // State
  const events = ref<DatabaseEvent[]>([])
  const agents = ref<AgentInfo[]>([])
  const stats = ref<EventStats | null>(null)
  const metrics = ref<DashboardMetrics | null>(null)
  const connectionState = ref<ConnectionState>('disconnected')
  const filters = reactive<FilterOptions>({
    limit: 100,
    offset: 0
  })
  
  // Real-time state
  const wsConnection = ref<WebSocket | null>(null)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectDelay = ref(1000)

  // Computed
  const isConnected = computed(() => connectionState.value === 'connected')
  const isConnecting = computed(() => connectionState.value === 'connecting')
  
  const eventsByType = computed(() => {
    const grouped = events.value.reduce((acc, event) => {
      const type = event.hook_event_type
      if (!acc[type]) acc[type] = []
      acc[type].push(event)
      return acc
    }, {} as Record<HookEventType, DatabaseEvent[]>)
    return grouped
  })

  const eventsByAgent = computed(() => {
    const grouped = events.value.reduce((acc, event) => {
      const agent = event.source_app
      if (!acc[agent]) acc[agent] = []
      acc[agent].push(event)
      return acc
    }, {} as Record<string, DatabaseEvent[]>)
    return grouped
  })

  const recentEvents = computed(() => {
    return events.value
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20)
  })

  // Actions
  const fetchEvents = async (filterOptions?: FilterOptions) => {
    try {
      const response = await apiService.getEvents({ ...filters, ...filterOptions })
      if (response.success && response.data) {
        events.value = response.data
      }
      return response
    } catch (error) {
      console.error('Failed to fetch events:', error)
      throw error
    }
  }

  const fetchRecentEvents = async (limit = 100) => {
    try {
      const response = await apiService.getRecentEvents(limit)
      if (response.success && response.data) {
        events.value = response.data
      }
      return response
    } catch (error) {
      console.error('Failed to fetch recent events:', error)
      throw error
    }
  }

  const fetchStats = async () => {
    try {
      const response = await apiService.getStats()
      if (response.success && response.data) {
        stats.value = response.data
        updateAgentsFromStats(response.data)
      }
      return response
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      throw error
    }
  }

  const updateAgentsFromStats = (statsData: EventStats) => {
    const agentMap = new Map<string, AgentInfo>()
    
    // Update existing agents or create new ones
    statsData.events_by_app.forEach(appStats => {
      const existingAgent = agents.value.find(a => a.id === appStats.source_app)
      const agentEvents = events.value.filter(e => e.source_app === appStats.source_app)
      const lastEvent = agentEvents.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0]

      const agentInfo: AgentInfo = {
        id: appStats.source_app,
        name: formatAgentName(appStats.source_app),
        type: getAgentType(appStats.source_app),
        tech_stack: getAgentTechStack(appStats.source_app),
        status: getAgentStatus(lastEvent),
        last_seen: lastEvent?.timestamp || new Date().toISOString(),
        session_count: getUniqueSessionCount(appStats.source_app),
        event_count: appStats.count,
        avg_response_time: calculateAvgResponseTime(appStats.source_app)
      }

      agentMap.set(appStats.source_app, agentInfo)
    })

    agents.value = Array.from(agentMap.values())
  }

  const addEvent = (event: DatabaseEvent) => {
    events.value.unshift(event)
    // Keep only the latest 1000 events in memory
    if (events.value.length > 1000) {
      events.value = events.value.slice(0, 1000)
    }
  }

  const updateFilters = (newFilters: Partial<FilterOptions>) => {
    Object.assign(filters, newFilters)
    fetchEvents()
  }

  const clearFilters = () => {
    Object.assign(filters, {
      limit: 100,
      offset: 0,
      source_app: undefined,
      session_id: undefined,
      event_type: undefined,
      start_time: undefined,
      end_time: undefined,
      search: undefined
    })
    fetchEvents()
  }

  // WebSocket connection management
  const connect = () => {
    if (connectionState.value === 'connected' || connectionState.value === 'connecting') {
      return
    }

    connectionState.value = 'connecting'
    
    try {
      const wsUrl = import.meta.env.VITE_WS_URL
      wsConnection.value = websocketService.connect(wsUrl, {
        onOpen: handleWsOpen,
        onMessage: handleWsMessage,
        onClose: handleWsClose,
        onError: handleWsError
      })
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error)
      connectionState.value = 'error'
    }
  }

  const disconnect = () => {
    if (wsConnection.value) {
      wsConnection.value.close()
      wsConnection.value = null
    }
    connectionState.value = 'disconnected'
    reconnectAttempts.value = 0
  }

  const handleWsOpen = () => {
    connectionState.value = 'connected'
    reconnectAttempts.value = 0
    reconnectDelay.value = 1000
    console.log('WebSocket connected')
  }

  const handleWsMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'event':
        addEvent(message.data)
        break
      case 'stats':
        stats.value = message.data
        updateAgentsFromStats(message.data)
        break
      case 'connection':
        console.log('Connection status:', message.data)
        break
      default:
        console.log('Unknown WebSocket message type:', message.type)
    }
  }

  const handleWsClose = () => {
    connectionState.value = 'disconnected'
    console.log('WebSocket disconnected')
    
    // Attempt to reconnect
    if (reconnectAttempts.value < maxReconnectAttempts) {
      setTimeout(() => {
        reconnectAttempts.value++
        reconnectDelay.value = Math.min(reconnectDelay.value * 2, 30000)
        connect()
      }, reconnectDelay.value)
    }
  }

  const handleWsError = (error: Event) => {
    console.error('WebSocket error:', error)
    connectionState.value = 'error'
  }

  // Helper functions
  const formatAgentName = (sourceApp: string): string => {
    const nameMap: Record<string, string> = {
      'web-dev-agent': 'Web Development Agent',
      'data-science-agent': 'Data Science Agent',
      'devops-agent': 'DevOps Agent'
    }
    return nameMap[sourceApp] || sourceApp
  }

  const getAgentType = (sourceApp: string) => {
    if (sourceApp.includes('web')) return 'web_application'
    if (sourceApp.includes('data')) return 'data_analysis'
    if (sourceApp.includes('devops')) return 'infrastructure'
    return 'web_application'
  }

  const getAgentTechStack = (sourceApp: string): string[] => {
    const stackMap: Record<string, string[]> = {
      'web-dev-agent': ['React', 'Node.js', 'PostgreSQL'],
      'data-science-agent': ['Python', 'Jupyter', 'Pandas', 'Scikit-learn'],
      'devops-agent': ['Docker', 'Kubernetes', 'Terraform', 'Ansible']
    }
    return stackMap[sourceApp] || []
  }

  const getAgentStatus = (lastEvent?: DatabaseEvent) => {
    if (!lastEvent) return 'disconnected'
    
    const timeDiff = Date.now() - new Date(lastEvent.timestamp).getTime()
    const fiveMinutes = 5 * 60 * 1000
    const oneMinute = 60 * 1000
    
    if (timeDiff < oneMinute) return 'active'
    if (timeDiff < fiveMinutes) return 'idle'
    return 'disconnected'
  }

  const getUniqueSessionCount = (sourceApp: string): number => {
    const agentEvents = events.value.filter(e => e.source_app === sourceApp)
    const uniqueSessions = new Set(agentEvents.map(e => e.session_id))
    return uniqueSessions.size
  }

  const calculateAvgResponseTime = (sourceApp: string): number => {
    const agentEvents = events.value.filter(e => 
      e.source_app === sourceApp && 
      e.hook_event_type === 'PostToolUse' &&
      e.payload.duration_ms
    )
    
    if (agentEvents.length === 0) return 0
    
    const totalTime = agentEvents.reduce((sum, event) => 
      sum + (event.payload.duration_ms || 0), 0
    )
    
    return Math.round(totalTime / agentEvents.length)
  }

  // Initialize
  const initialize = async () => {
    try {
      await Promise.all([
        fetchRecentEvents(),
        fetchStats()
      ])
      connect()
    } catch (error) {
      console.error('Failed to initialize observability store:', error)
    }
  }

  return {
    // State
    events,
    agents,
    stats,
    metrics,
    connectionState,
    filters,
    
    // Computed
    isConnected,
    isConnecting,
    eventsByType,
    eventsByAgent,
    recentEvents,
    
    // Actions
    fetchEvents,
    fetchRecentEvents,
    fetchStats,
    addEvent,
    updateFilters,
    clearFilters,
    connect,
    disconnect,
    initialize
  }
})
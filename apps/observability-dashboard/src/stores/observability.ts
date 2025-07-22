import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DatabaseEvent, AgentInfo, EventStats } from '@/types'

export const useObservabilityStore = defineStore('observability', () => {
  // State
  const events = ref<DatabaseEvent[]>([])
  const agents = ref<AgentInfo[]>([])
  const stats = ref<EventStats | null>(null)
  const isConnected = ref(false)
  const isLoading = ref(false)

  // Mock data for development
  const mockEvents: DatabaseEvent[] = [
    {
      id: 1,
      source_app: 'web-dev-agent',
      session_id: 'session-001',
      hook_event_type: 'PreToolUse',
      payload: {
        tool: 'bash',
        command: 'npm test',
        validation_status: 'approved'
      },
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      source_app: 'data-science-agent',
      session_id: 'session-002',
      hook_event_type: 'PostToolUse',
      payload: {
        tool: 'python',
        script: 'analyze_data.py',
        result: 'success',
        duration_ms: 1250
      },
      timestamp: new Date(Date.now() - 60000).toISOString(),
      created_at: new Date(Date.now() - 60000).toISOString(),
      updated_at: new Date(Date.now() - 60000).toISOString()
    }
  ]

  const mockAgents: AgentInfo[] = [
    {
      id: 'web-dev-agent',
      name: 'Web Development Agent',
      type: 'web_application',
      tech_stack: ['React', 'Node.js', 'PostgreSQL'],
      status: 'active',
      last_seen: new Date().toISOString(),
      session_count: 3,
      event_count: 45,
      avg_response_time: 120
    },
    {
      id: 'data-science-agent',
      name: 'Data Science Agent',
      type: 'data_analysis',
      tech_stack: ['Python', 'Jupyter', 'Pandas'],
      status: 'active',
      last_seen: new Date(Date.now() - 30000).toISOString(),
      session_count: 2,
      event_count: 32,
      avg_response_time: 85
    }
  ]

  // Computed
  const recentEvents = computed(() => {
    return events.value.slice(0, 20)
  })

  const activeAgentsCount = computed(() => {
    return agents.value.filter(agent => agent.status === 'active').length
  })

  // Actions
  const initialize = async () => {
    isLoading.value = true
    try {
      // Use mock data for now
      events.value = mockEvents
      agents.value = mockAgents
      isConnected.value = true
      
      stats.value = {
        total_events: mockEvents.length,
        events_last_24h: mockEvents.length,
        events_by_type: [
          { hook_event_type: 'PreToolUse', count: 1 },
          { hook_event_type: 'PostToolUse', count: 1 }
        ],
        events_by_app: [
          { source_app: 'web-dev-agent', count: 1 },
          { source_app: 'data-science-agent', count: 1 }
        ],
        database_path: 'mock'
      }
    } catch (error) {
      console.error('Failed to initialize:', error)
    } finally {
      isLoading.value = false
    }
  }

  const fetchEvents = async () => {
    // Mock implementation
    return { success: true, data: mockEvents }
  }

  const fetchStats = async () => {
    // Mock implementation
    return { success: true, data: stats.value }
  }

  const connect = () => {
    isConnected.value = true
  }

  const disconnect = () => {
    isConnected.value = false
  }

  return {
    // State
    events,
    agents,
    stats,
    isConnected,
    isLoading,
    
    // Computed
    recentEvents,
    activeAgentsCount,
    
    // Actions
    initialize,
    fetchEvents,
    fetchStats,
    connect,
    disconnect
  }
})
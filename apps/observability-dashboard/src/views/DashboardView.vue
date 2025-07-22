<template>
  <div class="dashboard-view">
    <!-- Dashboard Header -->
    <div class="dashboard-header">
      <div class="header-info">
        <h2 class="dashboard-title">
          <i class="fas fa-chart-line"></i>
          Real-Time Dashboard
        </h2>
        <p class="dashboard-subtitle">
          Multi-Agent Observability System Overview
        </p>
      </div>
      
      <div class="header-actions">
        <Button
          icon="fas fa-sync-alt"
          label="Refresh"
          outlined
          @click="refreshData"
          :loading="isLoading"
        />
      </div>
    </div>

    <!-- Key Metrics Cards -->
    <div class="metrics-grid">
      <Card class="metric-card">
        <template #content>
          <div class="metric-content">
            <div class="metric-icon">
              <i class="fas fa-robot"></i>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ activeAgentsCount }}</div>
              <div class="metric-title">Active Agents</div>
            </div>
          </div>
        </template>
      </Card>

      <Card class="metric-card">
        <template #content>
          <div class="metric-content">
            <div class="metric-icon">
              <i class="fas fa-calendar-day"></i>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ events.length }}</div>
              <div class="metric-title">Events Today</div>
            </div>
          </div>
        </template>
      </Card>

      <Card class="metric-card">
        <template #content>
          <div class="metric-content">
            <div class="metric-icon">
              <i class="fas fa-stopwatch"></i>
            </div>
            <div class="metric-info">
              <div class="metric-value">{{ avgResponseTime }}ms</div>
              <div class="metric-title">Avg Response</div>
            </div>
          </div>
        </template>
      </Card>

      <Card class="metric-card">
        <template #content>
          <div class="metric-content">
            <div class="metric-icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="metric-info">
              <div class="metric-value">98%</div>
              <div class="metric-title">Success Rate</div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Main Content Grid -->
    <div class="dashboard-grid">
      <!-- Agents Status Panel -->
      <Card class="agents-panel">
        <template #header>
          <div class="card-header">
            <h3>
              <i class="fas fa-robot"></i>
              Agent Status
            </h3>
            <Badge 
              :value="`${agents.length} Active`" 
              severity="success" 
            />
          </div>
        </template>
        
        <template #content>
          <div class="agents-list">
            <div 
              v-for="agent in agents" 
              :key="agent.id"
              class="agent-item"
            >
              <div class="agent-info">
                <div class="agent-name">{{ agent.name }}</div>
                <div class="agent-type">{{ formatAgentType(agent.type) }}</div>
              </div>
              <Badge 
                :value="agent.status" 
                :severity="getStatusSeverity(agent.status)"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Real-Time Events -->
      <Card class="events-panel">
        <template #header>
          <div class="card-header">
            <h3>
              <i class="fas fa-stream"></i>
              Live Events
            </h3>
            <Badge 
              :value="isConnected ? 'Connected' : 'Disconnected'" 
              :severity="isConnected ? 'success' : 'danger'" 
            />
          </div>
        </template>
        
        <template #content>
          <div class="events-list">
            <div 
              v-for="event in recentEvents" 
              :key="event.id"
              class="event-item"
            >
              <div class="event-header">
                <div class="event-type">
                  <i :class="getEventIcon(event.hook_event_type)"></i>
                  <span>{{ event.hook_event_type }}</span>
                </div>
                <div class="event-time">
                  {{ formatTime(event.timestamp) }}
                </div>
              </div>
              
              <div class="event-content">
                <Chip :label="event.source_app" size="small" />
                <div class="event-summary">
                  {{ getEventSummary(event) }}
                </div>
              </div>
            </div>
            
            <div v-if="events.length === 0" class="empty-state">
              <i class="fas fa-stream"></i>
              <p>No events yet</p>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useObservabilityStore } from '@/stores/observability'
import { formatDistanceToNow } from 'date-fns'

const store = useObservabilityStore()
const { agents, events, recentEvents, isConnected, isLoading, activeAgentsCount } = storeToRefs(store)

const avgResponseTime = computed(() => {
  if (agents.value.length === 0) return 0
  const total = agents.value.reduce((sum, agent) => sum + agent.avg_response_time, 0)
  return Math.round(total / agents.value.length)
})

const refreshData = async () => {
  await store.initialize()
}

const formatAgentType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'web_application': 'Web Development',
    'data_analysis': 'Data Science',
    'infrastructure': 'DevOps'
  }
  return typeMap[type] || type
}

const getStatusSeverity = (status: string) => {
  switch (status) {
    case 'active': return 'success'
    case 'idle': return 'warning'
    case 'disconnected': return 'danger'
    default: return 'info'
  }
}

const getEventIcon = (eventType: string): string => {
  const iconMap: Record<string, string> = {
    'PreToolUse': 'fas fa-play-circle',
    'PostToolUse': 'fas fa-check-circle',
    'UserPromptSubmit': 'fas fa-comment',
    'Notification': 'fas fa-bell',
    'Stop': 'fas fa-stop-circle',
    'SubagentStop': 'fas fa-pause-circle'
  }
  return iconMap[eventType] || 'fas fa-circle'
}

const getEventSummary = (event: any): string => {
  const payload = event.payload
  
  if (payload.command) {
    return `Command: ${payload.command}`
  }
  
  if (payload.tool) {
    return `Tool: ${payload.tool}`
  }
  
  return 'Event details available'
}

const formatTime = (timestamp: string): string => {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  } catch {
    return 'Unknown time'
  }
}

onMounted(async () => {
  await store.initialize()
})
</script>

<style lang="scss" scoped>
.dashboard-view {
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  
  .header-info {
    .dashboard-title {
      font-size: 2rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      color: var(--text-color);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      
      i {
        color: var(--primary-color);
      }
    }
    
    .dashboard-subtitle {
      color: var(--text-color-secondary);
      font-size: 1.1rem;
      margin: 0;
    }
  }
  
  .header-actions {
    display: flex;
    gap: 1rem;
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.metric-card {
  .metric-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    
    .metric-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      display: flex;
      align-items: center;
      justify-content: center;
      
      i {
        font-size: 1.5rem;
        color: white;
      }
    }
    
    .metric-info {
      flex: 1;
      
      .metric-value {
        font-size: 2rem;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 0.25rem;
        color: var(--text-color);
      }
      
      .metric-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-color-secondary);
        text-transform: uppercase;
        letter-spacing: 0.025em;
      }
    }
  }
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--surface-border);
  
  h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    
    i {
      color: var(--primary-color);
    }
  }
}

.agents-list {
  padding: 1rem;
  
  .agent-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    margin-bottom: 0.5rem;
    
    .agent-info {
      .agent-name {
        font-weight: 600;
        color: var(--text-color);
        margin-bottom: 0.25rem;
      }
      
      .agent-type {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
      }
    }
  }
}

.events-list {
  padding: 1rem;
  max-height: 400px;
  overflow-y: auto;
  
  .event-item {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.5rem;
    
    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      
      .event-type {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        
        i {
          color: var(--primary-color);
        }
      }
      
      .event-time {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
      }
    }
    
    .event-content {
      display: flex;
      align-items: center;
      gap: 1rem;
      
      .event-summary {
        flex: 1;
        font-size: 0.875rem;
        color: var(--text-color-secondary);
      }
    }
  }
  
  .empty-state {
    text-align: center;
    padding: 2rem;
    color: var(--text-color-secondary);
    
    i {
      font-size: 2rem;
      margin-bottom: 1rem;
    }
  }
}

@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
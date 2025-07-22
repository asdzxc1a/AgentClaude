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
        <Button
          icon="fas fa-download"
          label="Export"
          outlined
          @click="exportData"
        />
      </div>
    </div>

    <!-- Key Metrics Cards -->
    <div class="metrics-grid">
      <MetricCard
        title="Active Agents"
        :value="activeAgentsCount"
        icon="fas fa-robot"
        trend="stable"
        color="blue"
      />
      <MetricCard
        title="Events Today"
        :value="eventsTodayCount"
        icon="fas fa-calendar-day"
        trend="up"
        color="green"
      />
      <MetricCard
        title="Avg Response Time"
        :value="`${avgResponseTime}ms`"
        icon="fas fa-stopwatch"
        trend="down"
        color="orange"
      />
      <MetricCard
        title="Success Rate"
        :value="`${successRate}%`"
        icon="fas fa-check-circle"
        trend="up"
        color="green"
      />
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
        
        <AgentStatusGrid :agents="agents" />
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
        
        <RealtimeEventList :events="recentEvents" />
      </Card>

      <!-- Event Type Distribution Chart -->
      <Card class="chart-panel">
        <template #header>
          <div class="card-header">
            <h3>
              <i class="fas fa-chart-pie"></i>
              Event Distribution
            </h3>
          </div>
        </template>
        
        <EventTypeChart :data="eventTypeData" />
      </Card>

      <!-- Activity Timeline -->
      <Card class="timeline-panel">
        <template #header>
          <div class="card-header">
            <h3>
              <i class="fas fa-clock"></i>
              Activity Timeline
            </h3>
            <div class="timeline-controls">
              <Button
                label="Last Hour"
                size="small"
                outlined
                :class="{ 'p-button-outlined': timeRange !== '1h' }"
                @click="setTimeRange('1h')"
              />
              <Button
                label="Last Day"
                size="small"
                outlined
                :class="{ 'p-button-outlined': timeRange !== '24h' }"
                @click="setTimeRange('24h')"
              />
            </div>
          </div>
        </template>
        
        <ActivityTimelineChart :data="timelineData" :timeRange="timeRange" />
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useObservabilityStore } from '@/stores/observability'
import { useToast } from 'primevue/usetoast'

// Components
import MetricCard from '@/components/MetricCard.vue'
import AgentStatusGrid from '@/components/AgentStatusGrid.vue'
import RealtimeEventList from '@/components/RealtimeEventList.vue'
import EventTypeChart from '@/components/charts/EventTypeChart.vue'
import ActivityTimelineChart from '@/components/charts/ActivityTimelineChart.vue'

const store = useObservabilityStore()
const toast = useToast()

const { agents, recentEvents, stats, isConnected } = storeToRefs(store)

// Local state
const isLoading = ref(false)
const timeRange = ref('1h')
const refreshInterval = ref<number | null>(null)

// Computed metrics
const activeAgentsCount = computed(() => {
  return agents.value.filter(agent => agent.status === 'active').length
})

const eventsTodayCount = computed(() => {
  if (!stats.value) return 0
  return stats.value.events_last_24h
})

const avgResponseTime = computed(() => {
  const totalTime = agents.value.reduce((sum, agent) => sum + agent.avg_response_time, 0)
  return agents.value.length > 0 ? Math.round(totalTime / agents.value.length) : 0
})

const successRate = computed(() => {
  const successEvents = recentEvents.value.filter(event => 
    event.hook_event_type === 'PostToolUse' && 
    (event.payload.result === 'success' || event.payload.exit_code === 0)
  ).length
  
  const totalEvents = recentEvents.value.filter(event => 
    event.hook_event_type === 'PostToolUse'
  ).length
  
  return totalEvents > 0 ? Math.round((successEvents / totalEvents) * 100) : 100
})

const eventTypeData = computed(() => {
  if (!stats.value) return []
  
  return stats.value.events_by_type.map(item => ({
    label: item.hook_event_type,
    value: item.count,
    color: getEventTypeColor(item.hook_event_type)
  }))
})

const timelineData = computed(() => {
  const now = new Date()
  const timeRangeHours = timeRange.value === '1h' ? 1 : 24
  const startTime = new Date(now.getTime() - (timeRangeHours * 60 * 60 * 1000))
  
  return recentEvents.value
    .filter(event => new Date(event.timestamp) >= startTime)
    .map(event => ({
      timestamp: event.timestamp,
      source_app: event.source_app,
      event_type: event.hook_event_type,
      value: 1
    }))
})

// Methods
const refreshData = async () => {
  isLoading.value = true
  try {
    await Promise.all([
      store.fetchRecentEvents(),
      store.fetchStats()
    ])
    
    toast.add({
      severity: 'success',
      summary: 'Data Refreshed',
      detail: 'Dashboard data has been updated',
      life: 3000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Refresh Failed',
      detail: error instanceof Error ? error.message : 'Failed to refresh data',
      life: 5000
    })
  } finally {
    isLoading.value = false
  }
}

const exportData = () => {
  const data = {
    timestamp: new Date().toISOString(),
    agents: agents.value,
    recent_events: recentEvents.value.slice(0, 50),
    stats: stats.value
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { 
    type: 'application/json' 
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `observability-dashboard-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  toast.add({
    severity: 'success',
    summary: 'Export Complete',
    detail: 'Dashboard data has been exported',
    life: 3000
  })
}

const setTimeRange = (range: string) => {
  timeRange.value = range
}

const getEventTypeColor = (eventType: string): string => {
  const colorMap: Record<string, string> = {
    'PreToolUse': '#3b82f6',
    'PostToolUse': '#10b981',
    'UserPromptSubmit': '#f59e0b',
    'Notification': '#8b5cf6',
    'Stop': '#ef4444',
    'SubagentStop': '#f97316'
  }
  return colorMap[eventType] || '#6b7280'
}

const startAutoRefresh = () => {
  refreshInterval.value = window.setInterval(async () => {
    if (isConnected.value) {
      await store.fetchStats()
    }
  }, 30000) // Refresh every 30 seconds
}

const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

// Lifecycle
onMounted(async () => {
  await store.initialize()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
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

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 1.5rem;
  
  .agents-panel {
    grid-column: 1;
    grid-row: 1;
  }
  
  .events-panel {
    grid-column: 2;
    grid-row: 1;
  }
  
  .chart-panel {
    grid-column: 1;
    grid-row: 2;
  }
  
  .timeline-panel {
    grid-column: 2;
    grid-row: 2;
  }
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
  
  .timeline-controls {
    display: flex;
    gap: 0.5rem;
  }
}

// Responsive design
@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    
    .agents-panel,
    .events-panel,
    .chart-panel,
    .timeline-panel {
      grid-column: 1;
      grid-row: auto;
    }
  }
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    gap: 1rem;
    
    .header-actions {
      align-self: stretch;
      justify-content: stretch;
      
      :deep(.p-button) {
        flex: 1;
      }
    }
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
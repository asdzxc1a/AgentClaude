<template>
  <div class="analytics-view">
    <!-- Analytics Header -->
    <div class="analytics-header">
      <div class="header-info">
        <h2 class="analytics-title">
          <i class="fas fa-chart-pie"></i>
          Analytics & Insights
        </h2>
        <p class="analytics-subtitle">
          Deep dive into agent performance and system metrics
        </p>
      </div>
      
      <div class="header-actions">
        <Button
          icon="fas fa-calendar-alt"
          label="Time Range"
          outlined
          @click="showTimeRangeDialog = true"
        />
        <Button
          icon="fas fa-download"
          label="Export Report"
          outlined
          @click="exportReport"
        />
      </div>
    </div>

    <!-- Key Performance Indicators -->
    <div class="kpi-grid">
      <Card class="kpi-card">
        <template #content>
          <div class="kpi-content">
            <div class="kpi-icon">
              <i class="fas fa-tachometer-alt"></i>
            </div>
            <div class="kpi-info">
              <div class="kpi-value">{{ systemHealth }}%</div>
              <div class="kpi-label">System Health</div>
            </div>
            <div class="kpi-trend">
              <i class="fas fa-arrow-up" style="color: #10b981;"></i>
            </div>
          </div>
        </template>
      </Card>
      
      <Card class="kpi-card">
        <template #content>
          <div class="kpi-content">
            <div class="kpi-icon">
              <i class="fas fa-bolt"></i>
            </div>
            <div class="kpi-info">
              <div class="kpi-value">{{ eventsPerMinute }}</div>
              <div class="kpi-label">Events/Min</div>
            </div>
            <div class="kpi-trend">
              <i class="fas fa-minus" style="color: #6b7280;"></i>
            </div>
          </div>
        </template>
      </Card>
      
      <Card class="kpi-card">
        <template #content>
          <div class="kpi-content">
            <div class="kpi-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="kpi-info">
              <div class="kpi-value">{{ errorRate }}%</div>
              <div class="kpi-label">Error Rate</div>
            </div>
            <div class="kpi-trend">
              <i class="fas fa-arrow-down" style="color: #10b981;"></i>
            </div>
          </div>
        </template>
      </Card>
      
      <Card class="kpi-card">
        <template #content>
          <div class="kpi-content">
            <div class="kpi-icon">
              <i class="fas fa-clock"></i>
            </div>
            <div class="kpi-info">
              <div class="kpi-value">{{ uptime }}h</div>
              <div class="kpi-label">Uptime</div>
            </div>
            <div class="kpi-trend">
              <i class="fas fa-arrow-up" style="color: #10b981;"></i>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Analytics Charts Grid -->
    <div class="analytics-grid">
      <!-- Event Volume Over Time -->
      <Card class="chart-card">
        <template #header>
          <div class="chart-header">
            <h3>
              <i class="fas fa-chart-area"></i>
              Event Volume Over Time
            </h3>
            <div class="chart-controls">
              <Button
                v-for="period in timePeriods"
                :key="period.value"
                :label="period.label"
                size="small"
                :outlined="selectedPeriod !== period.value"
                @click="selectedPeriod = period.value"
              />
            </div>
          </div>
        </template>
        
        <template #content>
          <div class="chart-container">
            <canvas ref="volumeChart" width="600" height="300"></canvas>
          </div>
        </template>
      </Card>

      <!-- Agent Performance Comparison -->
      <Card class="chart-card">
        <template #header>
          <div class="chart-header">
            <h3>
              <i class="fas fa-chart-bar"></i>
              Agent Performance
            </h3>
          </div>
        </template>
        
        <template #content>
          <div class="chart-container">
            <canvas ref="performanceChart" width="400" height="300"></canvas>
          </div>
        </template>
      </Card>

      <!-- Event Type Distribution -->
      <Card class="chart-card">
        <template #header>
          <div class="chart-header">
            <h3>
              <i class="fas fa-chart-pie"></i>
              Event Distribution
            </h3>
          </div>
        </template>
        
        <template #content>
          <div class="chart-container">
            <EventTypeChart :data="eventTypeData" />
          </div>
        </template>
      </Card>

      <!-- Security Events -->
      <Card class="chart-card">
        <template #header>
          <div class="chart-header">
            <h3>
              <i class="fas fa-shield-alt"></i>
              Security Events
            </h3>
          </div>
        </template>
        
        <template #content>
          <div class="security-events">
            <div class="security-summary">
              <div class="security-metric">
                <div class="metric-value">{{ blockedCommands }}</div>
                <div class="metric-label">Blocked Commands</div>
              </div>
              <div class="security-metric">
                <div class="metric-value">{{ securityViolations }}</div>
                <div class="metric-label">Security Violations</div>
              </div>
              <div class="security-metric">
                <div class="metric-value">{{ suspiciousActivity }}</div>
                <div class="metric-label">Suspicious Activity</div>
              </div>
            </div>
            
            <div class="recent-security-events">
              <h4>Recent Security Events</h4>
              <div class="security-event-list">
                <div
                  v-for="event in recentSecurityEvents"
                  :key="event.id"
                  class="security-event-item"
                >
                  <div class="event-severity">
                    <Badge 
                      :value="event.severity" 
                      :severity="event.severity === 'high' ? 'danger' : 'warning'"
                    />
                  </div>
                  <div class="event-details">
                    <div class="event-title">{{ event.title }}</div>
                    <div class="event-description">{{ event.description }}</div>
                  </div>
                  <div class="event-time">
                    {{ formatTime(event.timestamp) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Top Commands -->
      <Card class="chart-card">
        <template #header>
          <div class="chart-header">
            <h3>
              <i class="fas fa-terminal"></i>
              Top Commands
            </h3>
          </div>
        </template>
        
        <template #content>
          <div class="top-commands">
            <DataTable
              :value="topCommands"
              responsiveLayout="scroll"
              :paginator="false"
            >
              <Column field="command" header="Command" style="width: 40%">
                <template #body="{ data }">
                  <code class="command-text">{{ data.command }}</code>
                </template>
              </Column>
              <Column field="count" header="Count" style="width: 20%">
                <template #body="{ data }">
                  <Badge :value="data.count" severity="info" />
                </template>
              </Column>
              <Column field="success_rate" header="Success Rate" style="width: 25%">
                <template #body="{ data }">
                  <ProgressBar 
                    :value="data.success_rate" 
                    :showValue="true"
                    :class="getSuccessRateClass(data.success_rate)"
                  />
                </template>
              </Column>
              <Column field="avg_duration" header="Avg Duration" style="width: 15%">
                <template #body="{ data }">
                  <span class="duration-text">{{ data.avg_duration }}ms</span>
                </template>
              </Column>
            </DataTable>
          </div>
        </template>
      </Card>

      <!-- System Resources -->
      <Card class="chart-card">
        <template #header>
          <div class="chart-header">
            <h3>
              <i class="fas fa-server"></i>
              System Resources
            </h3>
          </div>
        </template>
        
        <template #content>
          <div class="system-resources">
            <div class="resource-item">
              <div class="resource-label">Database Size</div>
              <div class="resource-value">{{ databaseSize }} MB</div>
              <ProgressBar :value="databaseUsagePercent" :showValue="false" />
            </div>
            
            <div class="resource-item">
              <div class="resource-label">Memory Usage</div>
              <div class="resource-value">{{ memoryUsage }} MB</div>
              <ProgressBar :value="memoryUsagePercent" :showValue="false" />
            </div>
            
            <div class="resource-item">
              <div class="resource-label">Active Connections</div>
              <div class="resource-value">{{ activeConnections }}</div>
              <ProgressBar :value="connectionUsagePercent" :showValue="false" />
            </div>
            
            <div class="resource-item">
              <div class="resource-label">Event Queue</div>
              <div class="resource-value">{{ eventQueueSize }}</div>
              <ProgressBar :value="queueUsagePercent" :showValue="false" />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Time Range Dialog -->
    <Dialog
      v-model:visible="showTimeRangeDialog"
      header="Select Time Range"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <div class="time-range-selector">
        <div class="preset-ranges">
          <Button
            v-for="preset in timePresets"
            :key="preset.value"
            :label="preset.label"
            outlined
            @click="selectTimePreset(preset.value)"
            class="preset-button"
          />
        </div>
        
        <Divider />
        
        <div class="custom-range">
          <h4>Custom Range</h4>
          <Calendar
            v-model="customDateRange"
            selectionMode="range"
            :manualInput="false"
            showTime
          />
        </div>
        
        <div class="dialog-actions">
          <Button
            label="Cancel"
            outlined
            @click="showTimeRangeDialog = false"
          />
          <Button
            label="Apply"
            @click="applyTimeRange"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useObservabilityStore } from '@/stores/observability'
import { useToast } from 'primevue/usetoast'
import { format } from 'date-fns'
import EventTypeChart from '@/components/charts/EventTypeChart.vue'

const store = useObservabilityStore()
const toast = useToast()

const { events, agents, stats } = storeToRefs(store)

// Local state
const showTimeRangeDialog = ref(false)
const selectedPeriod = ref('24h')
const customDateRange = ref<Date[]>([])
const volumeChart = ref<HTMLCanvasElement>()
const performanceChart = ref<HTMLCanvasElement>()

// Chart contexts
let volumeCtx: CanvasRenderingContext2D | null = null
let performanceCtx: CanvasRenderingContext2D | null = null

const timePeriods = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' }
]

const timePresets = [
  { label: 'Last Hour', value: '1h' },
  { label: 'Last 6 Hours', value: '6h' },
  { label: 'Last 24 Hours', value: '24h' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' }
]

// Computed KPIs
const systemHealth = computed(() => {
  const activeAgents = agents.value.filter(a => a.status === 'active').length
  const totalAgents = agents.value.length
  const healthScore = totalAgents > 0 ? (activeAgents / totalAgents) * 100 : 100
  return Math.round(healthScore)
})

const eventsPerMinute = computed(() => {
  const recentEvents = events.value.filter(event => {
    const eventTime = new Date(event.timestamp)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
    return eventTime > oneMinuteAgo
  })
  return recentEvents.length
})

const errorRate = computed(() => {
  const errorEvents = events.value.filter(event => 
    event.payload.error || event.payload.validation_status === 'blocked'
  ).length
  const totalEvents = events.value.length
  return totalEvents > 0 ? Math.round((errorEvents / totalEvents) * 100) : 0
})

const uptime = computed(() => {
  // Mock uptime calculation - in real implementation this would come from server
  return 72.5
})

const eventTypeData = computed(() => {
  if (!stats.value) return []
  
  return stats.value.events_by_type.map(item => ({
    label: item.hook_event_type,
    value: item.count,
    color: getEventTypeColor(item.hook_event_type)
  }))
})

const blockedCommands = computed(() => {
  return events.value.filter(event => 
    event.payload.validation_status === 'blocked'
  ).length
})

const securityViolations = computed(() => {
  return events.value.filter(event => 
    event.payload.security_violation || event.payload.dangerous_patterns
  ).length
})

const suspiciousActivity = computed(() => {
  return events.value.filter(event => 
    event.payload.warnings && event.payload.warnings.length > 0
  ).length
})

const recentSecurityEvents = computed(() => {
  return [
    {
      id: 1,
      severity: 'high',
      title: 'Dangerous Command Blocked',
      description: 'rm -rf / command was blocked by security validation',
      timestamp: new Date().toISOString()
    },
    {
      id: 2,
      severity: 'medium',
      title: 'Sudo Command Warning',
      description: 'sudo apt update triggered security warning',
      timestamp: new Date(Date.now() - 300000).toISOString()
    }
  ]
})

const topCommands = computed(() => {
  const commandCounts = new Map<string, { count: number; successes: number; durations: number[] }>()
  
  events.value.forEach(event => {
    if (event.payload.command) {
      const cmd = event.payload.command
      const existing = commandCounts.get(cmd) || { count: 0, successes: 0, durations: [] }
      
      existing.count++
      if (!event.payload.error && event.payload.exit_code !== 1) {
        existing.successes++
      }
      if (event.payload.duration_ms) {
        existing.durations.push(event.payload.duration_ms)
      }
      
      commandCounts.set(cmd, existing)
    }
  })
  
  return Array.from(commandCounts.entries())
    .map(([command, data]) => ({
      command: command.length > 30 ? command.substring(0, 30) + '...' : command,
      count: data.count,
      success_rate: Math.round((data.successes / data.count) * 100),
      avg_duration: data.durations.length > 0 
        ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length)
        : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
})

// System resources (mock data - would come from server in real implementation)
const databaseSize = computed(() => 45.2)
const databaseUsagePercent = computed(() => 65)
const memoryUsage = computed(() => 128.5)
const memoryUsagePercent = computed(() => 42)
const activeConnections = computed(() => agents.value.length)
const connectionUsagePercent = computed(() => (activeConnections.value / 20) * 100)
const eventQueueSize = computed(() => 12)
const queueUsagePercent = computed(() => (eventQueueSize.value / 100) * 100)

// Methods
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

const getSuccessRateClass = (rate: number): string => {
  if (rate >= 90) return 'success-rate-high'
  if (rate >= 70) return 'success-rate-medium'
  return 'success-rate-low'
}

const formatTime = (timestamp: string): string => {
  try {
    return format(new Date(timestamp), 'HH:mm')
  } catch {
    return 'Invalid'
  }
}

const selectTimePreset = (preset: string) => {
  selectedPeriod.value = preset
  showTimeRangeDialog.value = false
}

const applyTimeRange = () => {
  if (customDateRange.value.length === 2) {
    // Apply custom date range
    toast.add({
      severity: 'success',
      summary: 'Time Range Applied',
      detail: 'Custom time range has been applied to analytics',
      life: 3000
    })
  }
  showTimeRangeDialog.value = false
}

const exportReport = () => {
  const reportData = {
    timestamp: new Date().toISOString(),
    time_period: selectedPeriod.value,
    kpis: {
      system_health: systemHealth.value,
      events_per_minute: eventsPerMinute.value,
      error_rate: errorRate.value,
      uptime: uptime.value
    },
    agents: agents.value,
    top_commands: topCommands.value,
    security_summary: {
      blocked_commands: blockedCommands.value,
      security_violations: securityViolations.value,
      suspicious_activity: suspiciousActivity.value
    }
  }
  
  const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
    type: 'application/json' 
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  toast.add({
    severity: 'success',
    summary: 'Report Exported',
    detail: 'Analytics report has been downloaded',
    life: 3000
  })
}

const drawVolumeChart = () => {
  if (!volumeCtx || !events.value.length) return
  
  const canvas = volumeChart.value!
  const width = canvas.width
  const height = canvas.height
  
  // Clear canvas
  volumeCtx.clearRect(0, 0, width, height)
  
  // Simple line chart implementation
  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  
  // Group events by hour
  const hourlyData = new Map<string, number>()
  events.value.forEach(event => {
    const hour = new Date(event.timestamp).toISOString().substring(0, 13)
    hourlyData.set(hour, (hourlyData.get(hour) || 0) + 1)
  })
  
  const dataPoints = Array.from(hourlyData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-24) // Last 24 hours
  
  if (dataPoints.length < 2) return
  
  const maxValue = Math.max(...dataPoints.map(([, value]) => value))
  
  // Draw grid
  volumeCtx.strokeStyle = 'rgba(156, 163, 175, 0.2)'
  volumeCtx.lineWidth = 1
  
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i
    volumeCtx.beginPath()
    volumeCtx.moveTo(padding, y)
    volumeCtx.lineTo(padding + chartWidth, y)
    volumeCtx.stroke()
  }
  
  // Draw line
  volumeCtx.strokeStyle = '#3b82f6'
  volumeCtx.lineWidth = 2
  volumeCtx.beginPath()
  
  dataPoints.forEach(([hour, value], index) => {
    const x = padding + (index / (dataPoints.length - 1)) * chartWidth
    const y = padding + chartHeight - (value / maxValue) * chartHeight
    
    if (index === 0) {
      volumeCtx.moveTo(x, y)
    } else {
      volumeCtx.lineTo(x, y)
    }
  })
  
  volumeCtx.stroke()
  
  // Draw points
  volumeCtx.fillStyle = '#3b82f6'
  dataPoints.forEach(([hour, value], index) => {
    const x = padding + (index / (dataPoints.length - 1)) * chartWidth
    const y = padding + chartHeight - (value / maxValue) * chartHeight
    
    volumeCtx.beginPath()
    volumeCtx.arc(x, y, 3, 0, 2 * Math.PI)
    volumeCtx.fill()
  })
}

const drawPerformanceChart = () => {
  if (!performanceCtx || !agents.value.length) return
  
  const canvas = performanceChart.value!
  const width = canvas.width
  const height = canvas.height
  
  // Clear canvas
  performanceCtx.clearRect(0, 0, width, height)
  
  // Bar chart implementation
  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  
  const maxResponseTime = Math.max(...agents.value.map(a => a.avg_response_time))
  const barWidth = chartWidth / agents.value.length - 10
  
  agents.value.forEach((agent, index) => {
    const barHeight = (agent.avg_response_time / maxResponseTime) * chartHeight
    const x = padding + index * (barWidth + 10)
    const y = padding + chartHeight - barHeight
    
    // Draw bar
    performanceCtx.fillStyle = '#10b981'
    performanceCtx.fillRect(x, y, barWidth, barHeight)
    
    // Draw label
    performanceCtx.fillStyle = '#374151'
    performanceCtx.font = '12px Inter'
    performanceCtx.textAlign = 'center'
    performanceCtx.fillText(
      agent.name.substring(0, 8),
      x + barWidth / 2,
      padding + chartHeight + 20
    )
  })
}

// Lifecycle
onMounted(async () => {
  await store.initialize()
  
  if (volumeChart.value) {
    volumeCtx = volumeChart.value.getContext('2d')
  }
  
  if (performanceChart.value) {
    performanceCtx = performanceChart.value.getContext('2d')
  }
  
  drawVolumeChart()
  drawPerformanceChart()
})

watch(() => events.value.length, () => {
  drawVolumeChart()
  drawPerformanceChart()
})
</script>

<style lang="scss" scoped>
.analytics-view {
  max-width: 1400px;
  margin: 0 auto;
}

.analytics-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  
  .header-info {
    .analytics-title {
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
    
    .analytics-subtitle {
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

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.kpi-card {
  .kpi-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    
    .kpi-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, var(--primary-color), var(--primary-600));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      
      i {
        color: white;
        font-size: 1.5rem;
      }
    }
    
    .kpi-info {
      flex: 1;
      
      .kpi-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-color);
        line-height: 1;
      }
      
      .kpi-label {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
        text-transform: uppercase;
        letter-spacing: 0.025em;
      }
    }
    
    .kpi-trend {
      font-size: 1.25rem;
    }
  }
}

.analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  .chart-header {
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
    
    .chart-controls {
      display: flex;
      gap: 0.5rem;
    }
  }
  
  .chart-container {
    padding: 1rem;
    
    canvas {
      width: 100%;
      height: auto;
    }
  }
}

.security-events {
  padding: 1rem;
  
  .security-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
    
    .security-metric {
      text-align: center;
      padding: 1rem;
      background: var(--surface-border);
      border-radius: 8px;
      
      .metric-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--error-color);
        line-height: 1;
      }
      
      .metric-label {
        font-size: 0.875rem;
        color: var(--text-color-secondary);
        margin-top: 0.5rem;
      }
    }
  }
  
  .recent-security-events {
    h4 {
      margin: 0 0 1rem 0;
      color: var(--text-color);
    }
    
    .security-event-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      
      .security-event-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem;
        background: var(--surface-border);
        border-radius: 8px;
        
        .event-details {
          flex: 1;
          
          .event-title {
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 0.25rem;
          }
          
          .event-description {
            font-size: 0.875rem;
            color: var(--text-color-secondary);
          }
        }
        
        .event-time {
          font-size: 0.875rem;
          color: var(--text-color-secondary);
        }
      }
    }
  }
}

.top-commands {
  padding: 1rem;
  
  .command-text {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
    background: var(--surface-border);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
  
  .duration-text {
    font-weight: 500;
    color: var(--text-color);
  }
}

.system-resources {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  
  .resource-item {
    .resource-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      
      font-weight: 500;
      color: var(--text-color);
    }
    
    .resource-value {
      font-weight: 600;
      color: var(--text-color-secondary);
    }
  }
}

.time-range-selector {
  .preset-ranges {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
    
    .preset-button {
      width: 100%;
    }
  }
  
  .custom-range {
    h4 {
      margin: 0 0 1rem 0;
      color: var(--text-color);
    }
  }
  
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 2rem;
  }
}

:deep(.success-rate-high .p-progressbar-value) {
  background: #10b981;
}

:deep(.success-rate-medium .p-progressbar-value) {
  background: #f59e0b;
}

:deep(.success-rate-low .p-progressbar-value) {
  background: #ef4444;
}

@media (max-width: 768px) {
  .analytics-header {
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
  
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .analytics-grid {
    grid-template-columns: 1fr;
  }
  
  .security-events .security-summary {
    grid-template-columns: 1fr;
  }
  
  .time-range-selector .preset-ranges {
    grid-template-columns: 1fr;
  }
}
</style>
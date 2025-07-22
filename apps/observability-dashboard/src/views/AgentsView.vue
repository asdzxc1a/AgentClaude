<template>
  <div class="agents-view">
    <!-- Agents Header -->
    <div class="agents-header">
      <div class="header-info">
        <h2 class="agents-title">
          <i class="fas fa-robot"></i>
          Agent Management
        </h2>
        <p class="agents-subtitle">
          Monitor and manage all connected Claude Code agents
        </p>
      </div>
      
      <div class="header-actions">
        <Button
          icon="fas fa-sync-alt"
          label="Refresh"
          outlined
          @click="refreshAgents"
          :loading="isLoading"
        />
        <Button
          icon="fas fa-plus"
          label="Add Agent"
          @click="showAddAgentDialog = true"
        />
      </div>
    </div>

    <!-- Agent Statistics -->
    <div class="agent-stats">
      <MetricCard
        title="Total Agents"
        :value="agents.length"
        icon="fas fa-robot"
        color="blue"
      />
      <MetricCard
        title="Active Agents"
        :value="activeAgentsCount"
        icon="fas fa-play-circle"
        color="green"
        :trend="agentTrend"
      />
      <MetricCard
        title="Avg Response Time"
        :value="`${avgResponseTime}ms`"
        icon="fas fa-stopwatch"
        color="orange"
      />
      <MetricCard
        title="Total Events"
        :value="totalEventsCount"
        icon="fas fa-chart-line"
        color="purple"
      />
    </div>

    <!-- Agent Grid -->
    <div class="agents-grid">
      <Card
        v-for="agent in agents"
        :key="agent.id"
        class="agent-card"
        :class="`agent-card--${agent.status}`"
      >
        <template #header>
          <div class="agent-card-header">
            <div class="agent-info">
              <h3 class="agent-name">{{ agent.name }}</h3>
              <Badge 
                :value="agent.status" 
                :severity="getStatusSeverity(agent.status)"
                class="status-badge"
              />
            </div>
            <div class="agent-actions">
              <Button
                icon="fas fa-eye"
                size="small"
                outlined
                @click="viewAgentDetails(agent)"
                v-tooltip.bottom="'View Details'"
              />
              <Button
                icon="fas fa-chart-line"
                size="small"
                outlined
                @click="viewAgentMetrics(agent)"
                v-tooltip.bottom="'View Metrics'"
              />
            </div>
          </div>
        </template>
        
        <template #content>
          <div class="agent-details">
            <div class="agent-type">
              <i :class="getAgentTypeIcon(agent.type)"></i>
              <span>{{ formatAgentType(agent.type) }}</span>
            </div>
            
            <div class="agent-metrics">
              <div class="metric">
                <span class="metric-label">Events</span>
                <span class="metric-value">{{ agent.event_count }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Sessions</span>
                <span class="metric-value">{{ agent.session_count }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Response Time</span>
                <span class="metric-value">{{ agent.avg_response_time }}ms</span>
              </div>
            </div>
            
            <div class="tech-stack">
              <h4>Tech Stack</h4>
              <div class="tech-chips">
                <Chip 
                  v-for="tech in agent.tech_stack.slice(0, 4)" 
                  :key="tech"
                  :label="tech"
                  class="tech-chip"
                />
                <Chip 
                  v-if="agent.tech_stack.length > 4"
                  :label="`+${agent.tech_stack.length - 4}`"
                  class="tech-chip tech-chip--more"
                />
              </div>
            </div>
            
            <div class="agent-footer">
              <span class="last-seen">
                Last seen: {{ formatLastSeen(agent.last_seen) }}
              </span>
            </div>
          </div>
        </template>
      </Card>
      
      <!-- Empty state -->
      <div v-if="agents.length === 0" class="empty-state">
        <i class="fas fa-robot empty-icon"></i>
        <h3 class="empty-title">No Agents Connected</h3>
        <p class="empty-description">
          Start Claude Code agents with observability hooks to see them here.
        </p>
        <Button
          label="View Setup Guide"
          icon="fas fa-book"
          @click="showSetupGuide = true"
        />
      </div>
    </div>

    <!-- Agent Details Dialog -->
    <Dialog
      v-model:visible="showAgentDialog"
      :header="`Agent Details - ${selectedAgent?.name}`"
      :modal="true"
      :style="{ width: '90vw', maxWidth: '1000px' }"
      :maximizable="true"
    >
      <div v-if="selectedAgent" class="agent-details-dialog">
        <div class="agent-overview">
          <div class="overview-grid">
            <div class="overview-item">
              <label>Agent ID</label>
              <code>{{ selectedAgent.id }}</code>
            </div>
            <div class="overview-item">
              <label>Type</label>
              <span>{{ formatAgentType(selectedAgent.type) }}</span>
            </div>
            <div class="overview-item">
              <label>Status</label>
              <Badge 
                :value="selectedAgent.status" 
                :severity="getStatusSeverity(selectedAgent.status)"
              />
            </div>
            <div class="overview-item">
              <label>Health Score</label>
              <ProgressBar 
                :value="selectedAgent.health_score || 85" 
                :showValue="true"
                class="health-bar"
              />
            </div>
          </div>
        </div>
        
        <Divider />
        
        <div class="agent-performance">
          <h4>Performance Metrics</h4>
          <div class="performance-grid">
            <div class="performance-metric">
              <div class="metric-icon">
                <i class="fas fa-chart-line"></i>
              </div>
              <div class="metric-info">
                <div class="metric-value">{{ selectedAgent.event_count }}</div>
                <div class="metric-label">Total Events</div>
              </div>
            </div>
            <div class="performance-metric">
              <div class="metric-icon">
                <i class="fas fa-clock"></i>
              </div>
              <div class="metric-info">
                <div class="metric-value">{{ selectedAgent.avg_response_time }}ms</div>
                <div class="metric-label">Avg Response</div>
              </div>
            </div>
            <div class="performance-metric">
              <div class="metric-icon">
                <i class="fas fa-layer-group"></i>
              </div>
              <div class="metric-info">
                <div class="metric-value">{{ selectedAgent.session_count }}</div>
                <div class="metric-label">Sessions</div>
              </div>
            </div>
          </div>
        </div>
        
        <Divider />
        
        <div class="agent-recent-events">
          <h4>Recent Events</h4>
          <DataTable
            :value="getAgentEvents(selectedAgent.id)"
            :paginator="true"
            :rows="10"
            responsiveLayout="scroll"
          >
            <Column field="timestamp" header="Time" style="width: 150px">
              <template #body="{ data }">
                {{ formatTime(data.timestamp) }}
              </template>
            </Column>
            <Column field="hook_event_type" header="Type" style="width: 120px">
              <template #body="{ data }">
                <Badge :value="data.hook_event_type" severity="info" />
              </template>
            </Column>
            <Column header="Summary">
              <template #body="{ data }">
                {{ getEventSummary(data) }}
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </Dialog>

    <!-- Setup Guide Dialog -->
    <Dialog
      v-model:visible="showSetupGuide"
      header="Agent Setup Guide"
      :modal="true"
      :style="{ width: '80vw', maxWidth: '800px' }"
    >
      <div class="setup-guide">
        <div class="setup-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4>Install Event Capture Agent</h4>
            <pre><code>cd apps/event-capture
python setup.py --target-dir /path/to/claude/project</code></pre>
          </div>
        </div>
        
        <div class="setup-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4>Start Data Processing Server</h4>
            <pre><code>cd apps/data-processing
npm run dev</code></pre>
          </div>
        </div>
        
        <div class="setup-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4>Launch Claude Code Agent</h4>
            <pre><code>cd /path/to/claude/project
claude --resume</code></pre>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useObservabilityStore } from '@/stores/observability'
import { useToast } from 'primevue/usetoast'
import { formatDistanceToNow, format } from 'date-fns'
import type { AgentInfo, DatabaseEvent } from '@/types'
import MetricCard from '@/components/MetricCard.vue'

const store = useObservabilityStore()
const toast = useToast()

const { agents, events } = storeToRefs(store)

// Local state
const isLoading = ref(false)
const showAgentDialog = ref(false)
const showAddAgentDialog = ref(false)
const showSetupGuide = ref(false)
const selectedAgent = ref<AgentInfo | null>(null)

// Computed
const activeAgentsCount = computed(() => {
  return agents.value.filter(agent => agent.status === 'active').length
})

const avgResponseTime = computed(() => {
  if (agents.value.length === 0) return 0
  const total = agents.value.reduce((sum, agent) => sum + agent.avg_response_time, 0)
  return Math.round(total / agents.value.length)
})

const totalEventsCount = computed(() => {
  return agents.value.reduce((sum, agent) => sum + agent.event_count, 0)
})

const agentTrend = computed(() => {
  // Simple trend calculation based on recent activity
  const recentlyActive = agents.value.filter(agent => {
    const lastSeen = new Date(agent.last_seen)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    return lastSeen > fiveMinutesAgo
  }).length
  
  return recentlyActive > agents.value.length / 2 ? 'up' : 'stable'
})

// Methods
const refreshAgents = async () => {
  isLoading.value = true
  try {
    await store.fetchStats()
    toast.add({
      severity: 'success',
      summary: 'Agents Refreshed',
      detail: 'Agent data has been updated',
      life: 3000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Refresh Failed',
      detail: error instanceof Error ? error.message : 'Failed to refresh agents',
      life: 5000
    })
  } finally {
    isLoading.value = false
  }
}

const viewAgentDetails = (agent: AgentInfo) => {
  selectedAgent.value = agent
  showAgentDialog.value = true
}

const viewAgentMetrics = (agent: AgentInfo) => {
  // Navigate to analytics view with agent filter
  // This would be implemented with router navigation
  toast.add({
    severity: 'info',
    summary: 'Feature Coming Soon',
    detail: 'Agent-specific metrics view will be available soon',
    life: 3000
  })
}

const getStatusSeverity = (status: string) => {
  switch (status) {
    case 'active':
      return 'success'
    case 'idle':
      return 'warning'
    case 'disconnected':
      return 'danger'
    default:
      return 'info'
  }
}

const getAgentTypeIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    'web_application': 'fas fa-globe',
    'data_analysis': 'fas fa-chart-bar',
    'infrastructure': 'fas fa-server'
  }
  return iconMap[type] || 'fas fa-cog'
}

const formatAgentType = (type: string): string => {
  const typeMap: Record<string, string> = {
    'web_application': 'Web Development',
    'data_analysis': 'Data Science',
    'infrastructure': 'DevOps'
  }
  return typeMap[type] || type
}

const formatLastSeen = (timestamp: string): string => {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  } catch (error) {
    return 'Unknown'
  }
}

const formatTime = (timestamp: string): string => {
  try {
    return format(new Date(timestamp), 'HH:mm:ss')
  } catch {
    return 'Invalid'
  }
}

const getAgentEvents = (agentId: string): DatabaseEvent[] => {
  return events.value
    .filter(event => event.source_app === agentId)
    .slice(0, 20)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

const getEventSummary = (event: DatabaseEvent): string => {
  const payload = event.payload
  
  if (payload.command) {
    return `Command: ${payload.command.substring(0, 50)}${payload.command.length > 50 ? '...' : ''}`
  }
  
  if (payload.prompt) {
    return `Prompt: ${payload.prompt.substring(0, 50)}${payload.prompt.length > 50 ? '...' : ''}`
  }
  
  if (payload.tool) {
    return `Tool: ${payload.tool}`
  }
  
  return 'Event details available'
}

// Lifecycle
onMounted(async () => {
  await store.initialize()
})
</script>

<style lang="scss" scoped>
.agents-view {
  max-width: 1400px;
  margin: 0 auto;
}

.agents-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  
  .header-info {
    .agents-title {
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
    
    .agents-subtitle {
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

.agent-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.agent-card {
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
  
  &--active {
    border-left: 4px solid #10b981;
  }
  
  &--idle {
    border-left: 4px solid #f59e0b;
  }
  
  &--disconnected {
    border-left: 4px solid #ef4444;
  }
}

.agent-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem 1.5rem;
  
  .agent-info {
    .agent-name {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color);
    }
  }
  
  .agent-actions {
    display: flex;
    gap: 0.5rem;
  }
}

.agent-details {
  padding: 0 1.5rem 1.5rem;
  
  .agent-type {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-weight: 500;
    
    i {
      color: var(--primary-color);
    }
  }
  
  .agent-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
    
    .metric {
      text-align: center;
      
      .metric-label {
        display: block;
        font-size: 0.75rem;
        color: var(--text-color-secondary);
        margin-bottom: 0.25rem;
        text-transform: uppercase;
        letter-spacing: 0.025em;
      }
      
      .metric-value {
        display: block;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-color);
      }
    }
  }
  
  .tech-stack {
    margin-bottom: 1rem;
    
    h4 {
      margin: 0 0 0.75rem 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-color);
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }
    
    .tech-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      
      .tech-chip {
        font-size: 0.75rem;
        
        &--more {
          background-color: var(--surface-border);
          color: var(--text-color-secondary);
        }
      }
    }
  }
  
  .agent-footer {
    .last-seen {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }
  }
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
  
  .empty-icon {
    font-size: 4rem;
    color: var(--text-color-secondary);
    margin-bottom: 1.5rem;
  }
  
  .empty-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 1rem 0;
  }
  
  .empty-description {
    color: var(--text-color-secondary);
    margin: 0 0 2rem 0;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }
}

.agent-details-dialog {
  .agent-overview {
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      
      .overview-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        
        label {
          font-weight: 500;
          color: var(--text-color-secondary);
          font-size: 0.875rem;
        }
        
        code {
          font-family: 'Monaco', 'Menlo', monospace;
          background: var(--surface-border);
          padding: 0.5rem;
          border-radius: 4px;
          font-size: 0.875rem;
        }
      }
    }
  }
  
  .agent-performance {
    h4 {
      margin: 0 0 1rem 0;
      color: var(--text-color);
    }
    
    .performance-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      
      .performance-metric {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: var(--surface-border);
        border-radius: 8px;
        
        .metric-icon {
          width: 40px;
          height: 40px;
          background: var(--primary-color);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          
          i {
            color: white;
            font-size: 1.25rem;
          }
        }
        
        .metric-info {
          .metric-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-color);
            line-height: 1;
          }
          
          .metric-label {
            font-size: 0.875rem;
            color: var(--text-color-secondary);
          }
        }
      }
    }
  }
  
  .agent-recent-events {
    h4 {
      margin: 0 0 1rem 0;
      color: var(--text-color);
    }
  }
}

.setup-guide {
  .setup-step {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    
    .step-number {
      width: 32px;
      height: 32px;
      background: var(--primary-color);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      flex-shrink: 0;
    }
    
    .step-content {
      flex: 1;
      
      h4 {
        margin: 0 0 0.5rem 0;
        color: var(--text-color);
      }
      
      pre {
        background: var(--surface-border);
        padding: 1rem;
        border-radius: 8px;
        overflow-x: auto;
        
        code {
          background: none;
          padding: 0;
        }
      }
    }
  }
}

.health-bar {
  width: 100%;
}

@media (max-width: 768px) {
  .agents-header {
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
  
  .agent-stats {
    grid-template-columns: 1fr;
  }
  
  .agents-grid {
    grid-template-columns: 1fr;
  }
  
  .agent-details .agent-metrics {
    grid-template-columns: repeat(2, 1fr);
    
    .metric:last-child {
      grid-column: 1 / -1;
    }
  }
  
  .agent-details-dialog {
    .agent-overview .overview-grid {
      grid-template-columns: 1fr;
    }
    
    .agent-performance .performance-grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
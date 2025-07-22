<template>
  <div class="agent-status-grid">
    <div 
      v-for="agent in agents" 
      :key="agent.id"
      class="agent-card"
      :class="`agent-card--${agent.status}`"
    >
      <div class="agent-header">
        <div class="agent-info">
          <div class="agent-name">{{ agent.name }}</div>
          <div class="agent-type">{{ formatAgentType(agent.type) }}</div>
        </div>
        
        <Badge 
          :value="agent.status" 
          :severity="getStatusSeverity(agent.status)"
          class="status-badge"
        />
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
          <span class="metric-label">Avg Response</span>
          <span class="metric-value">{{ agent.avg_response_time }}ms</span>
        </div>
      </div>
      
      <div class="agent-tech-stack">
        <Chip 
          v-for="tech in agent.tech_stack.slice(0, 3)" 
          :key="tech"
          :label="tech"
          class="tech-chip"
        />
        <Chip 
          v-if="agent.tech_stack.length > 3"
          :label="`+${agent.tech_stack.length - 3}`"
          class="tech-chip tech-chip--more"
        />
      </div>
      
      <div class="agent-footer">
        <span class="last-seen">
          Last seen: {{ formatLastSeen(agent.last_seen) }}
        </span>
      </div>
    </div>
    
    <!-- Empty state -->
    <div v-if="agents.length === 0" class="empty-state">
      <i class="fas fa-robot empty-icon"></i>
      <p class="empty-message">No agents connected</p>
      <p class="empty-description">
        Start Claude Code agents with observability hooks to see them here.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import type { AgentInfo } from '@/types'

interface Props {
  agents: AgentInfo[]
}

const props = defineProps<Props>()

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

const formatLastSeen = (timestamp: string): string => {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  } catch (error) {
    return 'Unknown'
  }
}
</script>

<style lang="scss" scoped>
.agent-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.agent-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.3s ease;
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 8px 8px 0 0;
    transition: all 0.3s ease;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  &--active::before {
    background: linear-gradient(90deg, #10b981, #059669);
  }
  
  &--idle::before {
    background: linear-gradient(90deg, #f59e0b, #d97706);
  }
  
  &--disconnected::before {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  
  .agent-info {
    flex: 1;
    min-width: 0;
    
    .agent-name {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 0.25rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .agent-type {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }
  }
  
  .status-badge {
    flex-shrink: 0;
    text-transform: capitalize;
  }
}

.agent-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
  
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
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-color);
    }
  }
}

.agent-tech-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
  
  .tech-chip {
    font-size: 0.75rem;
    
    &--more {
      background-color: var(--surface-border);
      color: var(--text-color-secondary);
    }
  }
}

.agent-footer {
  .last-seen {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
  }
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 3rem 1rem;
  
  .empty-icon {
    font-size: 3rem;
    color: var(--text-color-secondary);
    margin-bottom: 1rem;
  }
  
  .empty-message {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.5rem 0;
  }
  
  .empty-description {
    color: var(--text-color-secondary);
    margin: 0;
  }
}

@media (max-width: 768px) {
  .agent-status-grid {
    grid-template-columns: 1fr;
    padding: 0.5rem;
  }
  
  .agent-metrics {
    grid-template-columns: repeat(2, 1fr);
    
    .metric:last-child {
      grid-column: 1 / -1;
    }
  }
}
</style>
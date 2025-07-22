<template>
  <Card class="metric-card" :class="`metric-card--${color}`">
    <template #content>
      <div class="metric-content">
        <div class="metric-icon">
          <i :class="icon"></i>
        </div>
        
        <div class="metric-info">
          <div class="metric-value">{{ value }}</div>
          <div class="metric-title">{{ title }}</div>
        </div>
        
        <div class="metric-trend" v-if="trend">
          <i :class="trendIcon" :style="{ color: trendColor }"></i>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  title: string
  value: string | number
  icon: string
  trend?: 'up' | 'down' | 'stable'
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple'
}

const props = withDefaults(defineProps<Props>(), {
  color: 'blue'
})

const trendIcon = computed(() => {
  switch (props.trend) {
    case 'up':
      return 'fas fa-arrow-up'
    case 'down':
      return 'fas fa-arrow-down'
    case 'stable':
      return 'fas fa-minus'
    default:
      return ''
  }
})

const trendColor = computed(() => {
  switch (props.trend) {
    case 'up':
      return '#10b981'
    case 'down':
      return '#ef4444'
    case 'stable':
      return '#6b7280'
    default:
      return '#6b7280'
  }
})
</script>

<style lang="scss" scoped>
.metric-card {
  border: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  
  :deep(.p-card-body) {
    padding: 1.5rem;
  }
}

.metric-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.metric-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  i {
    font-size: 1.5rem;
    color: white;
  }
}

.metric-info {
  flex: 1;
  min-width: 0;
  
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

.metric-trend {
  font-size: 1.25rem;
  
  i {
    animation: pulse 2s infinite;
  }
}

// Color variants
.metric-card--blue .metric-icon {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
}

.metric-card--green .metric-icon {
  background: linear-gradient(135deg, #10b981, #047857);
}

.metric-card--orange .metric-icon {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.metric-card--red .metric-icon {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.metric-card--purple .metric-icon {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@media (max-width: 768px) {
  .metric-content {
    flex-direction: column;
    text-align: center;
    gap: 0.75rem;
  }
  
  .metric-info .metric-value {
    font-size: 1.75rem;
  }
}
</style>
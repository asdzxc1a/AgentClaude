<template>
  <div class="realtime-event-list">
    <div class="event-list-header">
      <div class="event-count">
        <Badge :value="`${events.length} Events`" severity="info" />
      </div>
      <div class="list-controls">
        <Button
          icon="fas fa-pause"
          :class="{ 'fa-play': isPaused }"
          size="small"
          outlined
          @click="togglePause"
          v-tooltip.bottom="isPaused ? 'Resume' : 'Pause'"
        />
        <Button
          icon="fas fa-trash"
          size="small"
          outlined
          severity="danger"
          @click="clearEvents"
          v-tooltip.bottom="Clear Events"
        />
      </div>
    </div>

    <div class="event-stream" ref="eventStream">
      <div
        v-for="event in displayedEvents"
        :key="event.id"
        class="event-item"
        :class="`event-item--${getEventSeverity(event)}`"
        @click="showEventDetails(event)"
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
          <div class="event-source">
            <Chip :label="event.source_app" size="small" />
          </div>
          <div class="event-summary">
            {{ getEventSummary(event) }}
          </div>
        </div>
        
        <div class="event-indicators" v-if="hasIndicators(event)">
          <Badge
            v-if="event.payload.validation_status === 'blocked'"
            value="BLOCKED"
            severity="danger"
            size="small"
          />
          <Badge
            v-if="event.payload.error"
            value="ERROR"
            severity="danger"
            size="small"
          />
          <Badge
            v-if="event.payload.duration_ms"
            :value="`${event.payload.duration_ms}ms`"
            severity="info"
            size="small"
          />
        </div>
      </div>
      
      <div v-if="events.length === 0" class="empty-state">
        <i class="fas fa-stream empty-icon"></i>
        <p class="empty-message">No events yet</p>
        <p class="empty-description">
          Events will appear here in real-time as agents execute commands.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import type { DatabaseEvent } from '@/types'

interface Props {
  events: DatabaseEvent[]
  maxEvents?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxEvents: 50
})

const emit = defineEmits<{
  eventSelected: [event: DatabaseEvent]
}>()

// Local state
const isPaused = ref(false)
const eventStream = ref<HTMLElement>()
const autoScroll = ref(true)

// Computed
const displayedEvents = computed(() => {
  return props.events.slice(0, props.maxEvents)
})

// Methods
const togglePause = () => {
  isPaused.value = !isPaused.value
}

const clearEvents = () => {
  // This would emit an event to parent to clear events
  emit('eventSelected', null as any) // Placeholder
}

const showEventDetails = (event: DatabaseEvent) => {
  emit('eventSelected', event)
}

const getEventSeverity = (event: DatabaseEvent): string => {
  if (event.payload.validation_status === 'blocked') return 'danger'
  if (event.payload.error) return 'danger'
  if (event.hook_event_type === 'Stop') return 'success'
  return 'info'
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

const getEventSummary = (event: DatabaseEvent): string => {
  const payload = event.payload
  
  if (payload.command) {
    return `Command: ${payload.command.substring(0, 50)}${payload.command.length > 50 ? '...' : ''}`
  }
  
  if (payload.prompt) {
    return `Prompt: ${payload.prompt.substring(0, 50)}${payload.prompt.length > 50 ? '...' : ''}`
  }
  
  if (payload.message) {
    return payload.message
  }
  
  if (payload.tool) {
    return `Tool: ${payload.tool}`
  }
  
  return 'Event details available'
}

const hasIndicators = (event: DatabaseEvent): boolean => {
  return !!(
    event.payload.validation_status === 'blocked' ||
    event.payload.error ||
    event.payload.duration_ms
  )
}

const formatTime = (timestamp: string): string => {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  } catch {
    return 'Unknown time'
  }
}

// Auto-scroll to bottom when new events arrive
watch(() => props.events.length, async () => {
  if (!isPaused.value && autoScroll.value && eventStream.value) {
    await nextTick()
    eventStream.value.scrollTop = eventStream.value.scrollHeight
  }
})
</script>

<style lang="scss" scoped>
.realtime-event-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.event-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--surface-border);
  
  .list-controls {
    display: flex;
    gap: 0.5rem;
  }
}

.event-stream {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  max-height: 600px;
}

.event-item {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateX(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  &--danger {
    border-left: 4px solid #ef4444;
  }
  
  &--success {
    border-left: 4px solid #10b981;
  }
  
  &--info {
    border-left: 4px solid #3b82f6;
  }
}

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
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.5rem;
  
  .event-summary {
    flex: 1;
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    line-height: 1.4;
  }
}

.event-indicators {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.empty-state {
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
  .event-content {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .event-indicators {
    justify-content: flex-start;
  }
}
</style>
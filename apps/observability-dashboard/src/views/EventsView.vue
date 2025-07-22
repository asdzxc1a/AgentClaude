<template>
  <div class="events-view">
    <!-- Events Header -->
    <div class="events-header">
      <div class="header-info">
        <h2 class="events-title">
          <i class="fas fa-list"></i>
          Event Stream
        </h2>
        <p class="events-subtitle">
          Real-time monitoring of all agent activities
        </p>
      </div>
      
      <div class="header-actions">
        <Button
          icon="fas fa-filter"
          label="Filters"
          outlined
          @click="showFilters = !showFilters"
          :class="{ 'p-button-outlined': !showFilters }"
        />
        <Button
          icon="fas fa-download"
          label="Export"
          outlined
          @click="exportEvents"
        />
      </div>
    </div>

    <!-- Filters Panel -->
    <Card v-if="showFilters" class="filters-panel">
      <template #content>
        <div class="filters-grid">
          <div class="filter-group">
            <label>Source App</label>
            <Dropdown
              v-model="filters.source_app"
              :options="filterOptions.source_apps"
              placeholder="All Agents"
              showClear
              @change="applyFilters"
            />
          </div>
          
          <div class="filter-group">
            <label>Event Type</label>
            <Dropdown
              v-model="filters.event_type"
              :options="eventTypeOptions"
              placeholder="All Types"
              showClear
              @change="applyFilters"
            />
          </div>
          
          <div class="filter-group">
            <label>Session ID</label>
            <Dropdown
              v-model="filters.session_id"
              :options="filterOptions.session_ids"
              placeholder="All Sessions"
              showClear
              @change="applyFilters"
            />
          </div>
          
          <div class="filter-group">
            <label>Search</label>
            <InputText
              v-model="searchQuery"
              placeholder="Search events..."
              @input="debouncedSearch"
            />
          </div>
          
          <div class="filter-group">
            <label>Time Range</label>
            <Calendar
              v-model="dateRange"
              selectionMode="range"
              :manualInput="false"
              showTime
              @date-select="applyFilters"
            />
          </div>
          
          <div class="filter-actions">
            <Button
              label="Clear All"
              outlined
              @click="clearAllFilters"
            />
            <Button
              label="Apply"
              @click="applyFilters"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Events Table -->
    <Card class="events-table-card">
      <template #content>
        <DataTable
          :value="filteredEvents"
          :paginator="true"
          :rows="50"
          :totalRecords="totalEvents"
          :loading="isLoading"
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
          :rowsPerPageOptions="[25, 50, 100]"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords} events"
          responsiveLayout="scroll"
          :scrollable="true"
          scrollHeight="600px"
          @page="onPageChange"
        >
          <Column field="id" header="ID" :sortable="true" style="width: 80px">
            <template #body="{ data }">
              <Badge :value="data.id" severity="info" />
            </template>
          </Column>
          
          <Column field="timestamp" header="Time" :sortable="true" style="width: 150px">
            <template #body="{ data }">
              <div class="timestamp-cell">
                <div class="timestamp-date">
                  {{ formatDate(data.timestamp) }}
                </div>
                <div class="timestamp-time">
                  {{ formatTime(data.timestamp) }}
                </div>
              </div>
            </template>
          </Column>
          
          <Column field="source_app" header="Agent" :sortable="true" style="width: 150px">
            <template #body="{ data }">
              <Chip :label="data.source_app" class="agent-chip" />
            </template>
          </Column>
          
          <Column field="hook_event_type" header="Event Type" :sortable="true" style="width: 140px">
            <template #body="{ data }">
              <div class="event-type-cell">
                <i :class="getEventIcon(data.hook_event_type)"></i>
                <span>{{ data.hook_event_type }}</span>
              </div>
            </template>
          </Column>
          
          <Column field="session_id" header="Session" style="width: 120px">
            <template #body="{ data }">
              <code class="session-id">{{ data.session_id.substring(0, 8) }}...</code>
            </template>
          </Column>
          
          <Column header="Summary" style="min-width: 300px">
            <template #body="{ data }">
              <div class="event-summary">
                {{ getEventSummary(data) }}
              </div>
            </template>
          </Column>
          
          <Column header="Status" style="width: 100px">
            <template #body="{ data }">
              <Badge
                :value="getEventStatus(data)"
                :severity="getEventSeverity(data)"
              />
            </template>
          </Column>
          
          <Column header="Actions" style="width: 100px">
            <template #body="{ data }">
              <Button
                icon="fas fa-eye"
                size="small"
                outlined
                @click="viewEventDetails(data)"
                v-tooltip.bottom="'View Details'"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Event Details Dialog -->
    <Dialog
      v-model:visible="showEventDialog"
      :header="`Event Details - ${selectedEvent?.hook_event_type}`"
      :modal="true"
      :style="{ width: '80vw', maxWidth: '800px' }"
      :maximizable="true"
    >
      <div v-if="selectedEvent" class="event-details">
        <div class="event-metadata">
          <div class="metadata-grid">
            <div class="metadata-item">
              <label>Event ID</label>
              <span>{{ selectedEvent.id }}</span>
            </div>
            <div class="metadata-item">
              <label>Source App</label>
              <Chip :label="selectedEvent.source_app" />
            </div>
            <div class="metadata-item">
              <label>Session ID</label>
              <code>{{ selectedEvent.session_id }}</code>
            </div>
            <div class="metadata-item">
              <label>Timestamp</label>
              <span>{{ formatFullTimestamp(selectedEvent.timestamp) }}</span>
            </div>
          </div>
        </div>
        
        <Divider />
        
        <div class="event-payload">
          <h4>Event Payload</h4>
          <pre class="payload-json">{{ JSON.stringify(selectedEvent.payload, null, 2) }}</pre>
        </div>
        
        <div v-if="selectedEvent.chat" class="event-chat">
          <Divider />
          <h4>Chat Context</h4>
          <div class="chat-messages">
            <div
              v-for="(message, index) in selectedEvent.chat"
              :key="index"
              class="chat-message"
              :class="`chat-message--${message.role}`"
            >
              <div class="message-role">{{ message.role }}</div>
              <div class="message-content">{{ message.content }}</div>
            </div>
          </div>
        </div>
        
        <div v-if="selectedEvent.summary" class="event-summary-section">
          <Divider />
          <h4>AI Summary</h4>
          <p class="summary-text">{{ selectedEvent.summary }}</p>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useObservabilityStore } from '@/stores/observability'
import { useToast } from 'primevue/usetoast'
import { format } from 'date-fns'
import { debounce } from 'lodash-es'
import type { DatabaseEvent, FilterOptions } from '@/types'

const store = useObservabilityStore()
const toast = useToast()

const { events, isConnected } = storeToRefs(store)

// Local state
const isLoading = ref(false)
const showFilters = ref(false)
const showEventDialog = ref(false)
const selectedEvent = ref<DatabaseEvent | null>(null)
const searchQuery = ref('')
const dateRange = ref<Date[]>([])
const totalEvents = ref(0)

// Filters
const filters = ref<FilterOptions>({
  limit: 50,
  offset: 0
})

const filterOptions = ref({
  source_apps: [] as string[],
  session_ids: [] as string[],
  event_types: [] as string[]
})

// Computed
const eventTypeOptions = computed(() => [
  'PreToolUse',
  'PostToolUse', 
  'UserPromptSubmit',
  'Notification',
  'Stop',
  'SubagentStop'
])

const filteredEvents = computed(() => {
  let filtered = [...events.value]
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(event => 
      JSON.stringify(event.payload).toLowerCase().includes(query) ||
      event.source_app.toLowerCase().includes(query) ||
      event.session_id.toLowerCase().includes(query) ||
      (event.summary && event.summary.toLowerCase().includes(query))
    )
  }
  
  return filtered
})

// Methods
const applyFilters = async () => {
  isLoading.value = true
  
  try {
    const filterParams = { ...filters.value }
    
    if (dateRange.value.length === 2) {
      filterParams.start_time = dateRange.value[0].toISOString()
      filterParams.end_time = dateRange.value[1].toISOString()
    }
    
    await store.fetchEvents(filterParams)
    totalEvents.value = events.value.length
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Filter Error',
      detail: error instanceof Error ? error.message : 'Failed to apply filters',
      life: 5000
    })
  } finally {
    isLoading.value = false
  }
}

const clearAllFilters = () => {
  filters.value = { limit: 50, offset: 0 }
  searchQuery.value = ''
  dateRange.value = []
  store.clearFilters()
}

const debouncedSearch = debounce(() => {
  // Search is handled in computed property
}, 300)

const onPageChange = (event: any) => {
  filters.value.offset = event.first
  filters.value.limit = event.rows
  applyFilters()
}

const viewEventDetails = (event: DatabaseEvent) => {
  selectedEvent.value = event
  showEventDialog.value = true
}

const exportEvents = () => {
  const data = {
    timestamp: new Date().toISOString(),
    total_events: filteredEvents.value.length,
    events: filteredEvents.value,
    filters: filters.value
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { 
    type: 'application/json' 
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `events-export-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  toast.add({
    severity: 'success',
    summary: 'Export Complete',
    detail: `Exported ${filteredEvents.value.length} events`,
    life: 3000
  })
}

// Utility methods
const formatDate = (timestamp: string): string => {
  try {
    return format(new Date(timestamp), 'MMM dd')
  } catch {
    return 'Invalid'
  }
}

const formatTime = (timestamp: string): string => {
  try {
    return format(new Date(timestamp), 'HH:mm:ss')
  } catch {
    return 'Invalid'
  }
}

const formatFullTimestamp = (timestamp: string): string => {
  try {
    return format(new Date(timestamp), 'PPpp')
  } catch {
    return 'Invalid timestamp'
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

const getEventSummary = (event: DatabaseEvent): string => {
  const payload = event.payload
  
  if (payload.command) {
    return `Command: ${payload.command}`
  }
  
  if (payload.prompt) {
    return `Prompt: ${payload.prompt.substring(0, 100)}${payload.prompt.length > 100 ? '...' : ''}`
  }
  
  if (payload.message) {
    return payload.message
  }
  
  if (payload.tool) {
    return `Tool: ${payload.tool}`
  }
  
  if (event.summary) {
    return event.summary
  }
  
  return 'Event data available'
}

const getEventStatus = (event: DatabaseEvent): string => {
  if (event.payload.validation_status === 'blocked') return 'BLOCKED'
  if (event.payload.error) return 'ERROR'
  if (event.payload.exit_code === 0) return 'SUCCESS'
  if (event.hook_event_type === 'Stop') return 'COMPLETED'
  return 'PROCESSED'
}

const getEventSeverity = (event: DatabaseEvent): string => {
  if (event.payload.validation_status === 'blocked') return 'danger'
  if (event.payload.error) return 'danger'
  if (event.hook_event_type === 'Stop') return 'success'
  return 'info'
}

// Lifecycle
onMounted(async () => {
  await store.initialize()
  
  // Load filter options
  try {
    const response = await store.fetchStats()
    if (response?.data) {
      filterOptions.value.source_apps = response.data.events_by_app.map((item: any) => item.source_app)
    }
  } catch (error) {
    console.error('Failed to load filter options:', error)
  }
})

// Watch for real-time updates
watch(() => events.value.length, () => {
  totalEvents.value = events.value.length
})
</script>

<style lang="scss" scoped>
.events-view {
  max-width: 1400px;
  margin: 0 auto;
}

.events-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  
  .header-info {
    .events-title {
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
    
    .events-subtitle {
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

.filters-panel {
  margin-bottom: 2rem;
  
  .filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    align-items: end;
    
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      
      label {
        font-weight: 500;
        color: var(--text-color);
      }
    }
    
    .filter-actions {
      display: flex;
      gap: 0.5rem;
      grid-column: 1 / -1;
      justify-content: flex-end;
    }
  }
}

.events-table-card {
  .timestamp-cell {
    .timestamp-date {
      font-weight: 500;
    }
    
    .timestamp-time {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }
  }
  
  .agent-chip {
    font-size: 0.75rem;
  }
  
  .event-type-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    
    i {
      color: var(--primary-color);
    }
  }
  
  .session-id {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    background: var(--surface-border);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
  
  .event-summary {
    font-size: 0.875rem;
    line-height: 1.4;
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.event-details {
  .event-metadata {
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
      
      .metadata-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        
        label {
          font-weight: 500;
          color: var(--text-color-secondary);
          font-size: 0.875rem;
        }
        
        code {
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
          background: var(--surface-border);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }
      }
    }
  }
  
  .event-payload {
    h4 {
      margin: 0 0 1rem 0;
      color: var(--text-color);
    }
    
    .payload-json {
      background: var(--surface-border);
      padding: 1rem;
      border-radius: 8px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.875rem;
      line-height: 1.4;
      overflow-x: auto;
      max-height: 400px;
      overflow-y: auto;
    }
  }
  
  .event-chat {
    h4 {
      margin: 0 0 1rem 0;
      color: var(--text-color);
    }
    
    .chat-messages {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 300px;
      overflow-y: auto;
      
      .chat-message {
        padding: 1rem;
        border-radius: 8px;
        
        &--user {
          background: var(--primary-color);
          color: white;
          align-self: flex-end;
          max-width: 80%;
        }
        
        &--assistant {
          background: var(--surface-border);
          align-self: flex-start;
          max-width: 80%;
        }
        
        .message-role {
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          margin-bottom: 0.5rem;
          opacity: 0.8;
        }
        
        .message-content {
          line-height: 1.4;
        }
      }
    }
  }
  
  .event-summary-section {
    h4 {
      margin: 0 0 1rem 0;
      color: var(--text-color);
    }
    
    .summary-text {
      background: var(--surface-border);
      padding: 1rem;
      border-radius: 8px;
      line-height: 1.6;
      margin: 0;
    }
  }
}

@media (max-width: 768px) {
  .events-header {
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
  
  .filters-panel .filters-grid {
    grid-template-columns: 1fr;
  }
  
  .event-details .event-metadata .metadata-grid {
    grid-template-columns: 1fr;
  }
}
</style>
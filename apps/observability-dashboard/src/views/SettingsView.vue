<template>
  <div class="settings-view">
    <!-- Settings Header -->
    <div class="settings-header">
      <div class="header-info">
        <h2 class="settings-title">
          <i class="fas fa-cog"></i>
          Settings
        </h2>
        <p class="settings-subtitle">
          Configure dashboard preferences and system settings
        </p>
      </div>
    </div>

    <!-- Settings Tabs -->
    <div class="settings-content">
      <div class="settings-sidebar">
        <nav class="settings-nav">
          <button
            v-for="tab in settingsTabs"
            :key="tab.id"
            class="nav-item"
            :class="{ 'nav-item--active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <i :class="tab.icon"></i>
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <div class="settings-main">
        <!-- General Settings -->
        <Card v-if="activeTab === 'general'" class="settings-card">
          <template #header>
            <h3>General Settings</h3>
          </template>
          
          <template #content>
            <div class="settings-form">
              <div class="form-group">
                <label>Dashboard Title</label>
                <InputText
                  v-model="settings.general.title"
                  placeholder="Multi-Agent Observability Dashboard"
                />
              </div>
              
              <div class="form-group">
                <label>Refresh Interval</label>
                <Dropdown
                  v-model="settings.general.refreshInterval"
                  :options="refreshIntervalOptions"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Select interval"
                />
              </div>
              
              <div class="form-group">
                <label>Max Events to Display</label>
                <InputNumber
                  v-model="settings.general.maxEvents"
                  :min="50"
                  :max="1000"
                  :step="50"
                />
              </div>
              
              <div class="form-group">
                <label>Auto-scroll Events</label>
                <div class="checkbox-wrapper">
                  <Checkbox
                    v-model="settings.general.autoScroll"
                    :binary="true"
                  />
                  <span>Automatically scroll to new events</span>
                </div>
              </div>
              
              <div class="form-group">
                <label>Show Event Timestamps</label>
                <div class="checkbox-wrapper">
                  <Checkbox
                    v-model="settings.general.showTimestamps"
                    :binary="true"
                  />
                  <span>Display timestamps in event list</span>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Theme Settings -->
        <Card v-if="activeTab === 'theme'" class="settings-card">
          <template #header>
            <h3>Theme & Appearance</h3>
          </template>
          
          <template #content>
            <div class="settings-form">
              <div class="form-group">
                <label>Theme Mode</label>
                <div class="theme-selector">
                  <Button
                    v-for="mode in themeModes"
                    :key="mode.value"
                    :label="mode.label"
                    :icon="mode.icon"
                    :outlined="settings.theme.mode !== mode.value"
                    @click="settings.theme.mode = mode.value"
                    class="theme-button"
                  />
                </div>
              </div>
              
              <div class="form-group">
                <label>Color Scheme</label>
                <div class="color-schemes">
                  <div
                    v-for="scheme in colorSchemes"
                    :key="scheme.id"
                    class="color-scheme"
                    :class="{ 'color-scheme--active': settings.theme.colorScheme === scheme.id }"
                    @click="settings.theme.colorScheme = scheme.id"
                  >
                    <div class="scheme-preview">
                      <div
                        v-for="color in scheme.colors"
                        :key="color"
                        class="color-swatch"
                        :style="{ backgroundColor: color }"
                      ></div>
                    </div>
                    <div class="scheme-name">{{ scheme.name }}</div>
                  </div>
                </div>
              </div>
              
              <div class="form-group">
                <label>Font Size</label>
                <Slider
                  v-model="settings.theme.fontSize"
                  :min="12"
                  :max="18"
                  :step="1"
                />
                <div class="font-size-preview">
                  Preview text at {{ settings.theme.fontSize }}px
                </div>
              </div>
              
              <div class="form-group">
                <label>Compact Mode</label>
                <div class="checkbox-wrapper">
                  <Checkbox
                    v-model="settings.theme.compactMode"
                    :binary="true"
                  />
                  <span>Use compact layout for more information density</span>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Notifications Settings -->
        <Card v-if="activeTab === 'notifications'" class="settings-card">
          <template #header>
            <h3>Notifications & Alerts</h3>
          </template>
          
          <template #content>
            <div class="settings-form">
              <div class="form-group">
                <label>Enable Notifications</label>
                <div class="checkbox-wrapper">
                  <Checkbox
                    v-model="settings.notifications.enabled"
                    :binary="true"
                  />
                  <span>Show browser notifications for important events</span>
                </div>
              </div>
              
              <div class="form-group">
                <label>Security Alerts</label>
                <div class="checkbox-wrapper">
                  <Checkbox
                    v-model="settings.notifications.securityAlerts"
                    :binary="true"
                  />
                  <span>Alert when dangerous commands are blocked</span>
                </div>
              </div>
              
              <div class="form-group">
                <label>Agent Disconnection Alerts</label>
                <div class="checkbox-wrapper">
                  <Checkbox
                    v-model="settings.notifications.agentDisconnection"
                    :binary="true"
                  />
                  <span>Alert when agents disconnect unexpectedly</span>
                </div>
              </div>
              
              <div class="form-group">
                <label>Performance Alerts</label>
                <div class="checkbox-wrapper">
                  <Checkbox
                    v-model="settings.notifications.performanceAlerts"
                    :binary="true"
                  />
                  <span>Alert when response times exceed thresholds</span>
                </div>
              </div>
              
              <div class="form-group">
                <label>Alert Sound</label>
                <Dropdown
                  v-model="settings.notifications.sound"
                  :options="alertSounds"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Select sound"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Connection Settings -->
        <Card v-if="activeTab === 'connection'" class="settings-card">
          <template #header>
            <h3>Connection Settings</h3>
          </template>
          
          <template #content>
            <div class="settings-form">
              <div class="form-group">
                <label>API Base URL</label>
                <InputText
                  v-model="settings.connection.apiUrl"
                  placeholder="http://localhost:4000"
                />
              </div>
              
              <div class="form-group">
                <label>WebSocket URL</label>
                <InputText
                  v-model="settings.connection.wsUrl"
                  placeholder="ws://localhost:4000"
                />
              </div>
              
              <div class="form-group">
                <label>Connection Timeout (seconds)</label>
                <InputNumber
                  v-model="settings.connection.timeout"
                  :min="5"
                  :max="60"
                  :step="5"
                />
              </div>
              
              <div class="form-group">
                <label>Auto-reconnect</label>
                <div class="checkbox-wrapper">
                  <Checkbox
                    v-model="settings.connection.autoReconnect"
                    :binary="true"
                  />
                  <span>Automatically reconnect when connection is lost</span>
                </div>
              </div>
              
              <div class="form-group">
                <label>Max Reconnection Attempts</label>
                <InputNumber
                  v-model="settings.connection.maxReconnectAttempts"
                  :min="1"
                  :max="20"
                  :step="1"
                />
              </div>
              
              <div class="connection-status">
                <h4>Connection Status</h4>
                <div class="status-grid">
                  <div class="status-item">
                    <span class="status-label">API Connection</span>
                    <Badge 
                      :value="apiConnectionStatus" 
                      :severity="apiConnectionStatus === 'Connected' ? 'success' : 'danger'"
                    />
                  </div>
                  <div class="status-item">
                    <span class="status-label">WebSocket Connection</span>
                    <Badge 
                      :value="wsConnectionStatus" 
                      :severity="wsConnectionStatus === 'Connected' ? 'success' : 'danger'"
                    />
                  </div>
                </div>
                
                <div class="connection-actions">
                  <Button
                    label="Test Connection"
                    icon="fas fa-plug"
                    @click="testConnection"
                    :loading="testingConnection"
                  />
                  <Button
                    label="Reconnect"
                    icon="fas fa-sync-alt"
                    outlined
                    @click="reconnect"
                  />
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Data Settings -->
        <Card v-if="activeTab === 'data'" class="settings-card">
          <template #header>
            <h3>Data Management</h3>
          </template>
          
          <template #content>
            <div class="settings-form">
              <div class="form-group">
                <label>Data Retention (days)</label>
                <InputNumber
                  v-model="settings.data.retentionDays"
                  :min="1"
                  :max="365"
                  :step="1"
                />
                <small>Events older than this will be automatically deleted</small>
              </div>
              
              <div class="form-group">
                <label>Export Format</label>
                <Dropdown
                  v-model="settings.data.exportFormat"
                  :options="exportFormats"
                  optionLabel="label"
                  optionValue="value"
                  placeholder="Select format"
                />
              </div>
              
              <div class="form-group">
                <label>Include Chat Data in Exports</label>
                <div class="checkbox-wrapper">
                  <Checkbox
                    v-model="settings.data.includeChatData"
                    :binary="true"
                  />
                  <span>Include conversation transcripts in data exports</span>
                </div>
              </div>
              
              <div class="data-actions">
                <h4>Data Actions</h4>
                <div class="action-buttons">
                  <Button
                    label="Export All Data"
                    icon="fas fa-download"
                    @click="exportAllData"
                  />
                  <Button
                    label="Clear Old Events"
                    icon="fas fa-trash"
                    severity="warning"
                    outlined
                    @click="clearOldEvents"
                  />
                  <Button
                    label="Reset Database"
                    icon="fas fa-exclamation-triangle"
                    severity="danger"
                    outlined
                    @click="showResetDialog = true"
                  />
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Save Actions -->
        <div class="settings-actions">
          <Button
            label="Reset to Defaults"
            icon="fas fa-undo"
            outlined
            @click="resetToDefaults"
          />
          <Button
            label="Save Settings"
            icon="fas fa-save"
            @click="saveSettings"
            :loading="savingSettings"
          />
        </div>
      </div>
    </div>

    <!-- Reset Confirmation Dialog -->
    <Dialog
      v-model:visible="showResetDialog"
      header="Reset Database"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <div class="reset-dialog">
        <div class="warning-message">
          <i class="fas fa-exclamation-triangle warning-icon"></i>
          <p>
            This action will permanently delete all events and data from the database.
            This cannot be undone.
          </p>
        </div>
        
        <div class="confirmation-input">
          <label>Type "RESET" to confirm:</label>
          <InputText
            v-model="resetConfirmation"
            placeholder="RESET"
          />
        </div>
        
        <div class="dialog-actions">
          <Button
            label="Cancel"
            outlined
            @click="showResetDialog = false"
          />
          <Button
            label="Reset Database"
            severity="danger"
            :disabled="resetConfirmation !== 'RESET'"
            @click="resetDatabase"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useObservabilityStore } from '@/stores/observability'
import { useThemeStore } from '@/stores/theme'
import { useToast } from 'primevue/usetoast'

const store = useObservabilityStore()
const themeStore = useThemeStore()
const toast = useToast()

const { isConnected } = storeToRefs(store)

// Local state
const activeTab = ref('general')
const savingSettings = ref(false)
const testingConnection = ref(false)
const showResetDialog = ref(false)
const resetConfirmation = ref('')

const settingsTabs = [
  { id: 'general', label: 'General', icon: 'fas fa-cog' },
  { id: 'theme', label: 'Theme', icon: 'fas fa-palette' },
  { id: 'notifications', label: 'Notifications', icon: 'fas fa-bell' },
  { id: 'connection', label: 'Connection', icon: 'fas fa-wifi' },
  { id: 'data', label: 'Data', icon: 'fas fa-database' }
]

const settings = ref({
  general: {
    title: 'Multi-Agent Observability Dashboard',
    refreshInterval: 30,
    maxEvents: 100,
    autoScroll: true,
    showTimestamps: true
  },
  theme: {
    mode: 'auto',
    colorScheme: 'default',
    fontSize: 14,
    compactMode: false
  },
  notifications: {
    enabled: true,
    securityAlerts: true,
    agentDisconnection: true,
    performanceAlerts: false,
    sound: 'default'
  },
  connection: {
    apiUrl: 'http://localhost:4000',
    wsUrl: 'ws://localhost:4000',
    timeout: 10,
    autoReconnect: true,
    maxReconnectAttempts: 5
  },
  data: {
    retentionDays: 30,
    exportFormat: 'json',
    includeChatData: true
  }
})

const refreshIntervalOptions = [
  { label: '10 seconds', value: 10 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: 'Manual only', value: 0 }
]

const themeModes = [
  { label: 'Auto', value: 'auto', icon: 'fas fa-adjust' },
  { label: 'Light', value: 'light', icon: 'fas fa-sun' },
  { label: 'Dark', value: 'dark', icon: 'fas fa-moon' }
]

const colorSchemes = [
  {
    id: 'default',
    name: 'Default Blue',
    colors: ['#3b82f6', '#1e40af', '#dbeafe', '#f8fafc']
  },
  {
    id: 'green',
    name: 'Nature Green',
    colors: ['#10b981', '#047857', '#d1fae5', '#f0fdf4']
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    colors: ['#8b5cf6', '#7c3aed', '#e9d5ff', '#faf5ff']
  },
  {
    id: 'orange',
    name: 'Sunset Orange',
    colors: ['#f59e0b', '#d97706', '#fed7aa', '#fffbeb']
  }
]

const alertSounds = [
  { label: 'Default', value: 'default' },
  { label: 'Chime', value: 'chime' },
  { label: 'Bell', value: 'bell' },
  { label: 'None', value: 'none' }
]

const exportFormats = [
  { label: 'JSON', value: 'json' },
  { label: 'CSV', value: 'csv' },
  { label: 'Excel', value: 'xlsx' }
]

// Computed
const apiConnectionStatus = computed(() => {
  return isConnected.value ? 'Connected' : 'Disconnected'
})

const wsConnectionStatus = computed(() => {
  return isConnected.value ? 'Connected' : 'Disconnected'
})

// Methods
const saveSettings = async () => {
  savingSettings.value = true
  
  try {
    // Save to localStorage
    localStorage.setItem('observability-settings', JSON.stringify(settings.value))
    
    // Apply theme changes
    if (settings.value.theme.mode === 'dark') {
      themeStore.isDarkMode = true
    } else if (settings.value.theme.mode === 'light') {
      themeStore.isDarkMode = false
    }
    
    themeStore.setTheme(settings.value.theme.colorScheme)
    
    toast.add({
      severity: 'success',
      summary: 'Settings Saved',
      detail: 'Your preferences have been saved successfully',
      life: 3000
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Save Failed',
      detail: 'Failed to save settings',
      life: 5000
    })
  } finally {
    savingSettings.value = false
  }
}

const resetToDefaults = () => {
  settings.value = {
    general: {
      title: 'Multi-Agent Observability Dashboard',
      refreshInterval: 30,
      maxEvents: 100,
      autoScroll: true,
      showTimestamps: true
    },
    theme: {
      mode: 'auto',
      colorScheme: 'default',
      fontSize: 14,
      compactMode: false
    },
    notifications: {
      enabled: true,
      securityAlerts: true,
      agentDisconnection: true,
      performanceAlerts: false,
      sound: 'default'
    },
    connection: {
      apiUrl: 'http://localhost:4000',
      wsUrl: 'ws://localhost:4000',
      timeout: 10,
      autoReconnect: true,
      maxReconnectAttempts: 5
    },
    data: {
      retentionDays: 30,
      exportFormat: 'json',
      includeChatData: true
    }
  }
  
  toast.add({
    severity: 'info',
    summary: 'Settings Reset',
    detail: 'All settings have been reset to defaults',
    life: 3000
  })
}

const testConnection = async () => {
  testingConnection.value = true
  
  try {
    // Test API connection
    const response = await fetch(`${settings.value.connection.apiUrl}/health`)
    
    if (response.ok) {
      toast.add({
        severity: 'success',
        summary: 'Connection Test Successful',
        detail: 'API server is responding correctly',
        life: 3000
      })
    } else {
      throw new Error('API server returned error status')
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Connection Test Failed',
      detail: 'Unable to connect to the API server',
      life: 5000
    })
  } finally {
    testingConnection.value = false
  }
}

const reconnect = () => {
  store.disconnect()
  setTimeout(() => {
    store.connect()
  }, 1000)
  
  toast.add({
    severity: 'info',
    summary: 'Reconnecting',
    detail: 'Attempting to reconnect to the server',
    life: 3000
  })
}

const exportAllData = () => {
  toast.add({
    severity: 'info',
    summary: 'Export Started',
    detail: 'Data export will begin shortly',
    life: 3000
  })
}

const clearOldEvents = () => {
  toast.add({
    severity: 'info',
    summary: 'Cleanup Started',
    detail: 'Old events are being removed',
    life: 3000
  })
}

const resetDatabase = () => {
  if (resetConfirmation.value === 'RESET') {
    toast.add({
      severity: 'warn',
      summary: 'Database Reset',
      detail: 'Database has been reset (simulation)',
      life: 5000
    })
    showResetDialog.value = false
    resetConfirmation.value = ''
  }
}

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('observability-settings')
    if (saved) {
      const savedSettings = JSON.parse(saved)
      settings.value = { ...settings.value, ...savedSettings }
    }
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error)
  }
}

// Lifecycle
onMounted(() => {
  loadSettings()
})
</script>

<style lang="scss" scoped>
.settings-view {
  max-width: 1200px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 2rem;
  
  .settings-title {
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
  
  .settings-subtitle {
    color: var(--text-color-secondary);
    font-size: 1.1rem;
    margin: 0;
  }
}

.settings-content {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 2rem;
}

.settings-sidebar {
  .settings-nav {
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    padding: 0.5rem;
    
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.75rem 1rem;
      border: none;
      background: none;
      color: var(--text-color);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.875rem;
      
      &:hover {
        background: var(--surface-hover);
      }
      
      &--active {
        background: var(--primary-color);
        color: white;
      }
      
      i {
        width: 16px;
        text-align: center;
      }
    }
  }
}

.settings-main {
  .settings-card {
    margin-bottom: 2rem;
    
    :deep(.p-card-header) {
      padding: 1.5rem 1.5rem 0;
      
      h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-color);
      }
    }
  }
  
  .settings-form {
    padding: 1.5rem;
    
    .form-group {
      margin-bottom: 2rem;
      
      label {
        display: block;
        font-weight: 500;
        color: var(--text-color);
        margin-bottom: 0.5rem;
      }
      
      small {
        display: block;
        color: var(--text-color-secondary);
        font-size: 0.875rem;
        margin-top: 0.25rem;
      }
      
      .checkbox-wrapper {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        
        span {
          color: var(--text-color-secondary);
        }
      }
    }
  }
}

.theme-selector {
  display: flex;
  gap: 0.5rem;
  
  .theme-button {
    flex: 1;
  }
}

.color-schemes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  
  .color-scheme {
    padding: 1rem;
    border: 2px solid var(--surface-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
    
    &:hover {
      border-color: var(--primary-color);
    }
    
    &--active {
      border-color: var(--primary-color);
      background: var(--primary-50);
    }
    
    .scheme-preview {
      display: flex;
      gap: 2px;
      margin-bottom: 0.5rem;
      
      .color-swatch {
        flex: 1;
        height: 20px;
        border-radius: 2px;
      }
    }
    
    .scheme-name {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-color);
    }
  }
}

.font-size-preview {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--surface-border);
  border-radius: 4px;
  color: var(--text-color-secondary);
}

.connection-status {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--surface-border);
  
  h4 {
    margin: 0 0 1rem 0;
    color: var(--text-color);
  }
  
  .status-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
    
    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: var(--surface-border);
      border-radius: 6px;
      
      .status-label {
        font-weight: 500;
        color: var(--text-color);
      }
    }
  }
  
  .connection-actions {
    display: flex;
    gap: 1rem;
  }
}

.data-actions {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--surface-border);
  
  h4 {
    margin: 0 0 1rem 0;
    color: var(--text-color);
  }
  
  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
}

.reset-dialog {
  .warning-message {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 2rem;
    
    .warning-icon {
      color: var(--warning-color);
      font-size: 1.5rem;
      flex-shrink: 0;
      margin-top: 0.25rem;
    }
    
    p {
      margin: 0;
      color: var(--text-color);
      line-height: 1.5;
    }
  }
  
  .confirmation-input {
    margin-bottom: 2rem;
    
    label {
      display: block;
      font-weight: 500;
      color: var(--text-color);
      margin-bottom: 0.5rem;
    }
  }
  
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
}

@media (max-width: 768px) {
  .settings-content {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .settings-sidebar {
    .settings-nav {
      display: flex;
      overflow-x: auto;
      padding: 0.5rem;
      
      .nav-item {
        flex-shrink: 0;
        white-space: nowrap;
      }
    }
  }
  
  .color-schemes {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .connection-status .status-grid {
    grid-template-columns: 1fr;
  }
  
  .data-actions .action-buttons {
    flex-direction: column;
    
    :deep(.p-button) {
      width: 100%;
    }
  }
  
  .settings-actions {
    flex-direction: column;
    
    :deep(.p-button) {
      width: 100%;
    }
  }
}
</style>
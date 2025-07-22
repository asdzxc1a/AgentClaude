<template>
  <div id="app" :class="{ 'dark-mode': isDarkMode }">
    <Toast />
    
    <!-- Navigation Header -->
    <nav class="app-header">
      <div class="header-content">
        <div class="header-brand">
          <i class="fas fa-chart-network brand-icon"></i>
          <h1 class="brand-title">{{ appTitle }}</h1>
          <Badge 
            :value="connectionStatus" 
            :severity="connectionBadgeSeverity"
            class="connection-badge"
          />
        </div>
        
        <div class="header-actions">
          <Button
            icon="fas fa-moon"
            :class="{ 'fa-sun': isDarkMode }"
            outlined
            rounded
            @click="toggleDarkMode"
            v-tooltip.bottom="isDarkMode ? 'Light Mode' : 'Dark Mode'"
          />
          <Button
            icon="fas fa-cog"
            outlined
            rounded
            @click="showSettings = true"
            v-tooltip.bottom="Settings"
          />
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useObservabilityStore } from './stores/observability'
import { useThemeStore } from './stores/theme'

const router = useRouter()
const observabilityStore = useObservabilityStore()
const themeStore = useThemeStore()

const { isConnected } = storeToRefs(observabilityStore)
const { isDarkMode } = storeToRefs(themeStore)

const appTitle = import.meta.env.VITE_APP_TITLE

const connectionStatus = computed(() => {
  return isConnected.value ? 'Connected' : 'Disconnected'
})

const connectionBadgeSeverity = computed(() => {
  return isConnected.value ? 'success' : 'danger'
})

const toggleDarkMode = () => {
  themeStore.toggleDarkMode()
}

onMounted(() => {
  // Initialize WebSocket connection
  observabilityStore.connect()
  
  // Navigate to dashboard by default
  if (router.currentRoute.value.path === '/') {
    router.push('/dashboard')
  }
})

onUnmounted(() => {
  observabilityStore.disconnect()
})
</script>

<style lang="scss">
@import './assets/styles/variables.scss';

#app {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
  background: var(--surface-ground);
  color: var(--text-color);
  transition: all 0.3s ease;
}

.app-header {
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  padding: 1rem 2rem;
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(10px);
  
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .header-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    
    .brand-icon {
      font-size: 2rem;
      color: var(--primary-color);
    }
    
    .brand-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0;
      color: var(--text-color);
    }
    
    .connection-badge {
      font-size: 0.75rem;
    }
  }
  
  .header-actions {
    display: flex;
    gap: 0.5rem;
  }
}

.app-main {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 100px);
}

// Dark mode styles
.dark-mode {
  --surface-ground: #0f172a;
  --surface-card: #1e293b;
  --surface-border: #334155;
  --text-color: #f1f5f9;
  --primary-color: #3b82f6;
}

// Responsive design
@media (max-width: 768px) {
  .app-header {
    padding: 1rem;
    
    .header-brand .brand-title {
      font-size: 1.25rem;
    }
  }
  
  .app-main {
    padding: 1rem;
  }
}
</style>
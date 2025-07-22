<template>
  <div id="app" :class="{ 'dark-mode': isDarkMode }">
    <Toast />
    
    <!-- Navigation -->
    <Navigation />

    <!-- Main Content -->
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useObservabilityStore } from './stores/observability'
import { useThemeStore } from './stores/theme'
import Navigation from './components/Navigation.vue'

const router = useRouter()
const observabilityStore = useObservabilityStore()
const themeStore = useThemeStore()

const { isDarkMode } = storeToRefs(themeStore)

onMounted(() => {
  // Initialize WebSocket connection
  observabilityStore.connect()
  
  // Initialize theme
  themeStore.initializeTheme()
  
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

.app-main {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 64px);
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
  .app-main {
    padding: 1rem;
    min-height: calc(100vh - 56px);
  }
}
</style>
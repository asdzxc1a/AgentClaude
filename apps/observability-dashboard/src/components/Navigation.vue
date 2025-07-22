<template>
  <nav class="main-navigation">
    <div class="nav-content">
      <div class="nav-brand">
        <router-link to="/dashboard" class="brand-link">
          <i class="fas fa-chart-network brand-icon"></i>
          <span class="brand-text">Observability</span>
        </router-link>
      </div>
      
      <div class="nav-links">
        <router-link
          v-for="route in navigationRoutes"
          :key="route.path"
          :to="route.path"
          class="nav-link"
          :class="{ 'nav-link--active': isActiveRoute(route.path) }"
        >
          <i :class="route.icon"></i>
          <span>{{ route.name }}</span>
          <Badge
            v-if="route.badge"
            :value="route.badge"
            severity="info"
            size="small"
            class="nav-badge"
          />
        </router-link>
      </div>
      
      <div class="nav-actions">
        <Button
          icon="fas fa-moon"
          :class="{ 'fa-sun': isDarkMode }"
          outlined
          rounded
          size="small"
          @click="toggleTheme"
          v-tooltip.bottom="isDarkMode ? 'Light Mode' : 'Dark Mode'"
        />
        
        <div class="connection-indicator">
          <div
            class="connection-dot"
            :class="{ 'connection-dot--connected': isConnected }"
            v-tooltip.bottom="connectionTooltip"
          ></div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useObservabilityStore } from '@/stores/observability'
import { useThemeStore } from '@/stores/theme'

const route = useRoute()
const observabilityStore = useObservabilityStore()
const themeStore = useThemeStore()

const { isConnected, agents, events } = storeToRefs(observabilityStore)
const { isDarkMode } = storeToRefs(themeStore)

const navigationRoutes = computed(() => [
  {
    path: '/dashboard',
    name: 'Dashboard',
    icon: 'fas fa-chart-line',
    badge: null
  },
  {
    path: '/events',
    name: 'Events',
    icon: 'fas fa-list',
    badge: events.value.length > 0 ? events.value.length : null
  },
  {
    path: '/agents',
    name: 'Agents',
    icon: 'fas fa-robot',
    badge: agents.value.filter(a => a.status === 'active').length || null
  },
  {
    path: '/analytics',
    name: 'Analytics',
    icon: 'fas fa-chart-pie',
    badge: null
  },
  {
    path: '/settings',
    name: 'Settings',
    icon: 'fas fa-cog',
    badge: null
  }
])

const connectionTooltip = computed(() => {
  return isConnected.value ? 'Connected to server' : 'Disconnected from server'
})

const isActiveRoute = (path: string): boolean => {
  return route.path === path
}

const toggleTheme = () => {
  themeStore.toggleDarkMode()
}
</script>

<style lang="scss" scoped>
.main-navigation {
  background: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  padding: 0 2rem;
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.nav-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto;
  height: 64px;
}

.nav-brand {
  .brand-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    color: var(--text-color);
    font-weight: 600;
    font-size: 1.25rem;
    
    .brand-icon {
      font-size: 1.5rem;
      color: var(--primary-color);
    }
    
    .brand-text {
      color: var(--text-color);
    }
  }
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    text-decoration: none;
    color: var(--text-color-secondary);
    font-weight: 500;
    transition: all 0.2s ease;
    position: relative;
    
    &:hover {
      background: var(--surface-hover);
      color: var(--text-color);
    }
    
    &--active {
      background: var(--primary-color);
      color: white;
      
      .nav-badge {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }
    }
    
    i {
      width: 16px;
      text-align: center;
    }
    
    .nav-badge {
      margin-left: 0.25rem;
    }
  }
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  
  .connection-indicator {
    .connection-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--error-color);
      transition: all 0.3s ease;
      animation: pulse 2s infinite;
      
      &--connected {
        background: var(--success-color);
        animation: none;
      }
    }
  }
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
  .main-navigation {
    padding: 0 1rem;
  }
  
  .nav-content {
    height: 56px;
  }
  
  .nav-brand .brand-link {
    font-size: 1.125rem;
    
    .brand-text {
      display: none;
    }
  }
  
  .nav-links {
    gap: 0.25rem;
    
    .nav-link {
      padding: 0.5rem;
      
      span {
        display: none;
      }
      
      .nav-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        margin: 0;
      }
    }
  }
}
</style>
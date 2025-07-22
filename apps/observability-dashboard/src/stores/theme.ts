import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Theme } from '@/types'

export const useThemeStore = defineStore('theme', () => {
  // State
  const isDarkMode = ref(false)
  const currentTheme = ref<Theme>({
    id: 'default',
    name: 'Default',
    colors: {
      primary: '#3b82f6',
      secondary: '#6366f1',
      surface: '#ffffff',
      text: '#1f2937'
    }
  })

  // Available themes
  const themes = ref<Theme[]>([
    {
      id: 'default',
      name: 'Default',
      colors: {
        primary: '#3b82f6',
        secondary: '#6366f1',
        surface: '#ffffff',
        text: '#1f2937'
      }
    },
    {
      id: 'dark',
      name: 'Dark',
      colors: {
        primary: '#60a5fa',
        secondary: '#818cf8',
        surface: '#1f2937',
        text: '#f9fafb'
      }
    },
    {
      id: 'green',
      name: 'Green',
      colors: {
        primary: '#10b981',
        secondary: '#059669',
        surface: '#ffffff',
        text: '#1f2937'
      }
    },
    {
      id: 'purple',
      name: 'Purple',
      colors: {
        primary: '#8b5cf6',
        secondary: '#7c3aed',
        surface: '#ffffff',
        text: '#1f2937'
      }
    }
  ])

  // Computed
  const themeColors = computed(() => currentTheme.value.colors)

  // Actions
  const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value
    applyTheme()
  }

  const setTheme = (themeId: string) => {
    const theme = themes.value.find(t => t.id === themeId)
    if (theme) {
      currentTheme.value = theme
      applyTheme()
    }
  }

  const applyTheme = () => {
    const root = document.documentElement
    const theme = currentTheme.value
    
    if (isDarkMode.value) {
      document.body.classList.add('dark-mode')
      root.style.setProperty('--primary-color', theme.colors.primary)
      root.style.setProperty('--secondary-color', theme.colors.secondary)
      root.style.setProperty('--surface-ground', '#0f172a')
      root.style.setProperty('--surface-card', '#1e293b')
      root.style.setProperty('--surface-border', '#334155')
      root.style.setProperty('--text-color', '#f1f5f9')
      root.style.setProperty('--text-color-secondary', '#cbd5e1')
    } else {
      document.body.classList.remove('dark-mode')
      root.style.setProperty('--primary-color', theme.colors.primary)
      root.style.setProperty('--secondary-color', theme.colors.secondary)
      root.style.setProperty('--surface-ground', '#ffffff')
      root.style.setProperty('--surface-card', '#ffffff')
      root.style.setProperty('--surface-border', '#e5e7eb')
      root.style.setProperty('--text-color', theme.colors.text)
      root.style.setProperty('--text-color-secondary', '#6b7280')
    }
    
    saveToLocalStorage()
  }

  const saveToLocalStorage = () => {
    localStorage.setItem('observability-theme', JSON.stringify({
      isDarkMode: isDarkMode.value,
      currentTheme: currentTheme.value.id
    }))
  }

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('observability-theme')
      if (saved) {
        const { isDarkMode: savedDarkMode, currentTheme: savedThemeId } = JSON.parse(saved)
        isDarkMode.value = savedDarkMode
        
        const theme = themes.value.find(t => t.id === savedThemeId)
        if (theme) {
          currentTheme.value = theme
        }
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error)
    }
  }

  const initializeTheme = () => {
    // Check for system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    // Load saved preferences or use system preference
    loadFromLocalStorage()
    
    // If no saved preference, use system preference
    if (!localStorage.getItem('observability-theme')) {
      isDarkMode.value = prefersDark
    }
    
    applyTheme()
  }

  // Watch for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', (e) => {
    if (!localStorage.getItem('observability-theme')) {
      isDarkMode.value = e.matches
      applyTheme()
    }
  })

  // Watch for theme changes
  watch([isDarkMode, currentTheme], () => {
    applyTheme()
  }, { deep: true })

  return {
    // State
    isDarkMode,
    currentTheme,
    themes,
    
    // Computed
    themeColors,
    
    // Actions
    toggleDarkMode,
    setTheme,
    applyTheme,
    initializeTheme
  }
})
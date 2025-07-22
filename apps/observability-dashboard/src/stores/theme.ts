import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDarkMode = ref(false)

  const toggleDarkMode = () => {
    isDarkMode.value = !isDarkMode.value
    applyTheme()
  }

  const applyTheme = () => {
    if (isDarkMode.value) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
  }

  const initializeTheme = () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    isDarkMode.value = prefersDark
    applyTheme()
  }

  return {
    isDarkMode,
    toggleDarkMode,
    initializeTheme
  }
})
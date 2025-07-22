import axios, { AxiosInstance, AxiosResponse } from 'axios'
import type { 
  ApiResponse, 
  DatabaseEvent, 
  EventStats, 
  FilterOptions,
  HookEvent 
} from '@/types'

class ApiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
        return config
      },
      (error) => {
        console.error('API Request Error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`API Response: ${response.status} ${response.config.url}`)
        return response
      },
      (error) => {
        console.error('API Response Error:', error.response?.data || error.message)
        
        // Handle common error cases
        if (error.response?.status === 404) {
          throw new Error('Resource not found')
        } else if (error.response?.status === 500) {
          throw new Error('Server error occurred')
        } else if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED') {
          throw new Error('Unable to connect to server. Please check if the observability server is running.')
        }
        
        throw error
      }
    )
  }

  // Health check
  async checkHealth(): Promise<ApiResponse> {
    try {
      const response = await this.client.get('/health')
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Events endpoints
  async getEvents(filters?: FilterOptions): Promise<ApiResponse<DatabaseEvent[]>> {
    try {
      const params = new URLSearchParams()
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString())
          }
        })
      }

      const response = await this.client.get(`/events?${params.toString()}`)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async getRecentEvents(limit = 100): Promise<ApiResponse<DatabaseEvent[]>> {
    try {
      const response = await this.client.get(`/events/recent?limit=${limit}`)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  async createEvent(event: HookEvent): Promise<ApiResponse<DatabaseEvent>> {
    try {
      const response = await this.client.post('/events', event)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Statistics endpoint
  async getStats(): Promise<ApiResponse<EventStats>> {
    try {
      const response = await this.client.get('/stats')
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Search events
  async searchEvents(query: string, filters?: FilterOptions): Promise<ApiResponse<DatabaseEvent[]>> {
    try {
      const params = new URLSearchParams({ search: query })
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString())
          }
        })
      }

      const response = await this.client.get(`/events?${params.toString()}`)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Filter events by source app
  async getEventsBySourceApp(sourceApp: string, limit = 50): Promise<ApiResponse<DatabaseEvent[]>> {
    try {
      const response = await this.client.get(`/events?source_app=${sourceApp}&limit=${limit}`)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Filter events by event type
  async getEventsByType(eventType: string, limit = 50): Promise<ApiResponse<DatabaseEvent[]>> {
    try {
      const response = await this.client.get(`/events?event_type=${eventType}&limit=${limit}`)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Get events within time range
  async getEventsByTimeRange(
    startTime: string, 
    endTime: string, 
    filters?: FilterOptions
  ): Promise<ApiResponse<DatabaseEvent[]>> {
    try {
      const params = new URLSearchParams({
        start_time: startTime,
        end_time: endTime
      })
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString())
          }
        })
      }

      const response = await this.client.get(`/events?${params.toString()}`)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Themes endpoint (if supported by backend)
  async getThemes(): Promise<ApiResponse> {
    try {
      const response = await this.client.get('/themes')
      return response.data
    } catch (error) {
      // Themes might not be implemented yet, return empty array
      return { success: true, data: [] }
    }
  }

  async saveTheme(theme: any): Promise<ApiResponse> {
    try {
      const response = await this.client.post('/themes', theme)
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }

  // Utility methods
  private handleError(error: any): Error {
    if (error.response?.data?.error) {
      return new Error(error.response.data.error)
    } else if (error.message) {
      return new Error(error.message)
    } else {
      return new Error('An unknown error occurred')
    }
  }

  // Get base URL for external references
  getBaseUrl(): string {
    return this.client.defaults.baseURL || ''
  }

  // Update base URL if needed
  setBaseUrl(baseUrl: string): void {
    this.client.defaults.baseURL = baseUrl
  }

  // Generic request method for extensibility
  async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.request({
        method,
        url: endpoint,
        data,
        params
      })
      return response.data
    } catch (error) {
      throw this.handleError(error)
    }
  }
}

// Export singleton instance
export const apiService = new ApiService()
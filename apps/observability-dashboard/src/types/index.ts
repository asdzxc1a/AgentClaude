// Core event types matching the backend
export type HookEventType = 
  | 'PreToolUse' 
  | 'PostToolUse' 
  | 'UserPromptSubmit' 
  | 'Notification' 
  | 'Stop' 
  | 'SubagentStop'

export interface HookEvent {
  source_app: string
  session_id: string
  hook_event_type: HookEventType
  payload: Record<string, any>
  chat?: Array<{ role: string; content: string }>
  summary?: string
  timestamp: string
}

export interface DatabaseEvent extends HookEvent {
  id: number
  created_at: string
  updated_at: string
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  count?: number
}

export interface WebSocketMessage {
  type: 'event' | 'stats' | 'connection' | 'error'
  data: any
  timestamp: string
}

export interface EventStats {
  total_events: number
  events_last_24h: number
  events_by_type: Array<{
    hook_event_type: HookEventType
    count: number
  }>
  events_by_app: Array<{
    source_app: string
    count: number
  }>
  database_path: string
}

export interface FilterOptions {
  limit?: number
  offset?: number
  source_app?: string
  session_id?: string
  event_type?: HookEventType
  start_time?: string
  end_time?: string
  search?: string
}

// Agent metadata types
export interface AgentInfo {
  id: string
  name: string
  type: 'web_application' | 'data_analysis' | 'infrastructure'
  tech_stack: string[]
  status: 'active' | 'idle' | 'disconnected'
  last_seen: string
  session_count: number
  event_count: number
  avg_response_time: number
}

// Chart data types
export interface ChartDataPoint {
  x: string | number
  y: number
  label?: string
}

export interface TimeSeriesData {
  timestamp: string
  value: number
  source_app?: string
  event_type?: HookEventType
}

// Dashboard metrics
export interface DashboardMetrics {
  active_agents: number
  total_events_today: number
  avg_response_time: number
  error_rate: number
  events_per_minute: number
  top_commands: Array<{
    command: string
    count: number
    success_rate: number
  }>
}

// UI state types
export interface ToastMessage {
  severity: 'success' | 'info' | 'warn' | 'error'
  summary: string
  detail?: string
  life?: number
}

export interface Theme {
  id: string
  name: string
  colors: {
    primary: string
    secondary: string
    surface: string
    text: string
  }
}

// Connection states
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

// Event severity levels
export type EventSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface EventSeverityInfo {
  level: EventSeverity
  color: string
  icon: string
}

// Performance metrics
export interface PerformanceMetric {
  name: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  threshold?: {
    warning: number
    critical: number
  }
}
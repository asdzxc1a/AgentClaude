/**
 * Type definitions for the Data Processing Agent
 */

export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: HookEventType;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp: string;
}

export type HookEventType = 
  | 'PreToolUse'
  | 'PostToolUse' 
  | 'UserPromptSubmit'
  | 'Notification'
  | 'Stop'
  | 'SubagentStop';

export interface DatabaseEvent extends HookEvent {
  id: number;
  created_at: string;
  updated_at: string;
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  event_types: HookEventType[];
}

export interface EventsQuery {
  limit?: number;
  offset?: number;
  source_app?: string;
  session_id?: string;
  event_type?: HookEventType;
  start_time?: string;
  end_time?: string;
  search?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ServerConfig {
  port: number;
  host: string;
  database_path: string;
  cors_enabled: boolean;
  max_payload_size: number;
  rate_limit: {
    events_per_minute: number;
    connections_per_ip: number;
  };
}

export interface Theme {
  id?: number;
  name: string;
  description?: string;
  colors: ThemeColors;
  author_id?: string;
  created_at?: string;
  updated_at?: string;
  is_public?: boolean;
  download_count?: number;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text_primary: string;
  text_secondary: string;
  accent: string;
  warning: string;
  error: string;
  success: string;
}

export interface WebSocketMessage {
  type: 'initial' | 'event' | 'filter' | 'theme' | 'error';
  data?: any;
  timestamp?: string;
}
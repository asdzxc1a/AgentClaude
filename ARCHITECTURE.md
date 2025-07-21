# Multi-Agent Observability System Architecture

## System Overview

The Multi-Agent Observability System is designed to monitor multiple concurrent Claude Code agents through a distributed architecture of specialized agents. Each agent has specific responsibilities and communicates through well-defined interfaces.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Multi-Agent Observability System                    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Claude Code    │    │  Claude Code    │    │  Claude Code    │
│   Agent 1       │    │   Agent 2       │    │   Agent N       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Event Capture Agent    │
                    │  (Hook Scripts Manager)  │
                    └─────────────┬─────────────┘
                                 │ HTTP POST
                    ┌─────────────▼─────────────┐
                    │  Data Processing Agent   │
                    │ (Validation & Storage)   │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │ WebSocket Broadcast Agent │
                    │   (Real-time Comms)     │
                    └─────────────┬─────────────┘
                                 │ WebSocket
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼───────┐    ┌─────────▼───────┐    ┌─────────▼───────┐
│ UI State Mgmt   │    │ Filtering Agent │    │Chart Rendering  │
│     Agent       │    │                 │    │     Agent       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │  Theme Management Agent  │
                    │    (UI Customization)    │
                    └───────────────────────────┘
```

## Agent Specifications

### 1. Event Capture Agent
**Purpose:** Manages Claude Code hook scripts and captures events from multiple agents

**Responsibilities:**
- Deploy and manage Python hook scripts (`.claude/hooks/`)
- Configure hook mappings in `settings.json`
- Capture 7 event types: PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop, SubagentStop
- Augment events with metadata (timestamps, source app, session IDs)
- Handle network failures gracefully (never break agent flow)
- Support optional chat transcript and AI summary generation

**Key Components:**
- `send_event.py` - Universal event sender
- Event-specific hook scripts for each lifecycle stage
- Configuration management system
- Error handling and retry logic

**Interfaces:**
- **Input:** Claude Code agent events via hook triggers
- **Output:** HTTP POST to Data Processing Agent (`/events` endpoint)

### 2. Data Processing Agent  
**Purpose:** Server-side event validation, storage, and initial processing

**Responsibilities:**
- Validate incoming event payloads
- Store events in SQLite database with proper schema
- Generate unique IDs and timestamps
- Handle concurrent access via WAL mode
- Manage database migrations and schema evolution
- Provide recent events and filter options via REST API

**Technology Stack:**
- **Runtime:** Bun (TypeScript)
- **Database:** SQLite with indexes on key fields
- **API:** RESTful endpoints

**Key Endpoints:**
- `POST /events` - Event ingestion
- `GET /events/recent` - Historical data
- `GET /events/filter-options` - Available filters

**Interfaces:**
- **Input:** HTTP requests from Event Capture Agent
- **Output:** Event broadcasts to WebSocket Agent, REST responses

### 3. WebSocket Broadcast Agent
**Purpose:** Real-time event distribution to connected clients

**Responsibilities:**
- Maintain WebSocket connections with multiple clients
- Broadcast new events immediately to all connected clients
- Send initial state (recent ~50 events) to new connections
- Handle client disconnections and cleanup
- Manage connection state and health

**Communication Patterns:**
- **Event Broadcasting:** Server → All Clients
- **Connection Management:** Bidirectional handshake
- **Initial State Sync:** Server → New Client

**Interfaces:**
- **Input:** New events from Data Processing Agent
- **Output:** WebSocket messages to UI agents

### 4. UI State Management Agent
**Purpose:** Client-side reactive state management and data synchronization

**Responsibilities:**
- Maintain reactive state using Vue 3 Composition API
- Handle WebSocket connection management with auto-reconnect
- Manage event collection with configurable limits
- Implement optimistic updates and conflict resolution
- Handle offline/online state transitions

**Technology Stack:**
- **Framework:** Vue 3 with Composition API
- **State Management:** Reactive refs and computed properties
- **WebSocket:** Custom composable with reconnection logic

**Interfaces:**
- **Input:** WebSocket messages from Broadcast Agent
- **Output:** Reactive state updates to UI components

### 5. Filtering Agent
**Purpose:** Dynamic event filtering and search capabilities

**Responsibilities:**
- Implement real-time client-side filtering
- Support multiple filter criteria: source app, session ID, event type, timestamp
- Provide search functionality across event content
- Maintain filter state and persistence
- Generate filtered views without server round-trips

**Filter Types:**
- **Source App Filtering** - By Claude Code agent instance
- **Session Filtering** - By conversation/run ID  
- **Event Type Filtering** - By hook event type
- **Time Range Filtering** - By timestamp windows
- **Content Search** - Full-text search in payloads

**Interfaces:**
- **Input:** User filter requests, raw event data
- **Output:** Filtered event collections to UI components

### 6. Chart Rendering Agent
**Purpose:** Real-time data visualization with custom canvas rendering

**Responsibilities:**
- Render real-time event timeline charts
- Implement time-bucketed data aggregation
- Handle smooth animations and transitions
- Support multiple visualization types (timeline, histogram, heat map)
- Optimize canvas performance for high-frequency updates

**Visualization Features:**
- **Timeline Charts** - Event occurrence over time
- **Agent Activity** - Per-agent event frequency
- **Event Type Distribution** - Hook event type breakdown
- **Session Analysis** - Conversation flow visualization

**Technology Stack:**
- **Canvas API** - Custom rendering (no Chart.js dependency)
- **Performance Optimization** - RequestAnimationFrame, efficient redraws
- **Data Processing** - Time bucketing, aggregation algorithms

**Interfaces:**
- **Input:** Filtered event data from Filtering Agent
- **Output:** Canvas-rendered visualizations

### 7. Theme Management Agent
**Purpose:** Custom UI theme creation and persistence

**Responsibilities:**
- Manage custom color schemes and UI themes
- Provide theme CRUD operations via REST API
- Handle theme import/export functionality
- Support theme sharing and rating system
- Apply themes dynamically across all UI components

**Features:**
- **Theme Editor** - Visual theme customization interface
- **Theme Persistence** - SQLite storage with versioning
- **Theme Sharing** - Export/import functionality
- **Live Preview** - Real-time theme application

**Database Schema:**
- `themes` - Theme definitions and metadata
- `theme_shares` - Sharing functionality
- `theme_ratings` - Community rating system

**Interfaces:**
- **Input:** Theme management requests from UI
- **Output:** Theme data and CSS variable updates

## Inter-Agent Communication System

### Communication Patterns

1. **HTTP/REST** - Synchronous request-response for CRUD operations
2. **WebSocket** - Real-time event streaming and broadcasts  
3. **Event Bus** - Internal agent coordination (planned)
4. **Shared State** - Reactive state synchronization

### Message Formats

**Event Message Structure:**
```json
{
  "id": "auto-generated",
  "source_app": "claude-agent-1",
  "session_id": "conv_uuid",
  "hook_event_type": "PreToolUse",
  "payload": { /* event-specific data */ },
  "chat": [ /* optional conversation */ ],
  "summary": "AI-generated summary",
  "timestamp": "2025-01-21T10:30:00Z"
}
```

**WebSocket Message Types:**
- `initial` - Initial state synchronization
- `event` - New event broadcast
- `filter` - Filter updates
- `theme` - Theme changes

### Error Handling Strategy

1. **Graceful Degradation** - Agents continue operating with reduced functionality
2. **Circuit Breaker** - Automatic retry with backoff for failed connections
3. **Event Buffering** - Local queuing during network outages
4. **Health Monitoring** - Agent health checks and status reporting

## Deployment Architecture

### Development Setup
```
apps/
├── event-capture/          # Event Capture Agent (Python)
├── data-processing/        # Data Processing Agent (Bun/TypeScript) 
├── websocket-broadcast/    # WebSocket Broadcast Agent
├── ui-state/              # UI State Management Agent (Vue 3)
├── filtering/             # Filtering Agent
├── chart-rendering/       # Chart Rendering Agent  
├── theme-management/      # Theme Management Agent
└── shared/                # Shared utilities and types
```

### Production Considerations

- **Scalability:** Horizontal scaling via multiple agent instances
- **Performance:** SQLite WAL mode for concurrent access
- **Monitoring:** Agent health checks and performance metrics
- **Security:** Event payload sanitization and validation
- **Reliability:** Event persistence and replay capabilities

## Technology Stack Summary

- **Backend Agents:** Bun + TypeScript + SQLite
- **Frontend Agents:** Vue 3 + Composition API + Vite
- **Real-time Comms:** Native WebSocket implementation
- **Data Storage:** SQLite with WAL mode
- **Hook Scripts:** Python with Astral UV runtime
- **Styling:** TailwindCSS with CSS custom properties
- **Build Tools:** Vite for frontend, Bun for backend

This architecture provides a robust, scalable system for monitoring multiple Claude Code agents through specialized, loosely-coupled agents that communicate via well-defined interfaces.
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

This is a **Multi-Agent Observability System** designed to monitor multiple concurrent Claude Code agents through a distributed architecture. The system captures events from Claude Code hook scripts, processes them through a data pipeline, and provides real-time visualization through specialized agents.

## Core Architecture

The system follows a **pipeline pattern**: `Claude Code Agents → Hook Scripts → Data Processing Agent → WebSocket Broadcasting → UI Agents`

### Agent Components
- **Event Capture Agent** (`apps/event-capture/`) - Python hook scripts that capture 7 event types from Claude Code agents
- **Data Processing Agent** (`apps/data-processing/`) - Bun/TypeScript server for event validation, storage, and REST API
- **WebSocket Broadcast Agent** - Real-time event distribution to connected clients
- **UI State Management Agent** - Vue 3 reactive state synchronization
- **Filtering Agent** - Dynamic event search and filtering
- **Chart Rendering Agent** - Canvas-based real-time data visualization  
- **Theme Management Agent** - Custom UI theme persistence

## Common Commands

### PDF Document Processing
```bash
# Set up PDF processing environment (first time only)
python3 -m venv pdf_env
source pdf_env/bin/activate
pip install PyPDF2 pdfplumber

# Extract text from PDF documents
python pdf_reader.py "path/to/document.pdf" output.txt
```

### Event Capture Agent
```bash
# Install Python dependencies
cd apps/event-capture
pip install -r requirements.txt

# Set up Claude Code hooks in a target project
python setup.py --target-dir /path/to/claude/project

# Test event sender manually
echo '{"tool": "bash", "command": "ls"}' | python send_event.py --event-type PreToolUse --summarize
```

### Data Processing Agent  
```bash
cd apps/data-processing

# Install dependencies
bun install

# Development server with hot reload
bun run dev

# Production server
bun run start

# Database operations
bun run db:init     # Initialize database
bun run db:reset    # Reset database (deletes all data)

# Code quality
bun run lint        # ESLint
bun run format      # Prettier
bun run type-check  # TypeScript checking
bun test           # Run tests
```

## Event Processing Pipeline

### Hook Event Types
The system captures 7 specific hook events from Claude Code agents:
1. **PreToolUse** - Tool validation before execution (can block dangerous commands)
2. **PostToolUse** - Tool result capture with performance metrics
3. **UserPromptSubmit** - User input analysis and categorization 
4. **Notification** - Agent-user interaction events
5. **Stop** - Main agent session completion
6. **SubagentStop** - Sub-agent task completion

### Security Validation
The `pre_tool_use.py` hook implements security pattern matching to block dangerous operations:
- File system destructive commands (`rm -rf /`, `dd if=...`)
- Privilege escalation attempts (`sudo rm`)
- Pipe-to-shell attacks (`curl ... | bash`)

### Data Storage Schema
SQLite database with optimized schema:
- **events** table: `id, source_app, session_id, hook_event_type, payload(JSON), chat(JSON), summary, timestamp`
- **themes** table: Custom UI theme persistence
- Performance indexes on `source_app`, `session_id`, `hook_event_type`, `timestamp`
- WAL mode enabled for concurrent access

## Configuration

### Hook Script Configuration
Claude Code hook mapping defined in `apps/event-capture/.claude/settings.json`:
- Maps each Claude event type to a sequence of scripts
- Configures timeouts, retry behavior, and error handling
- Environment variables for server URL and agent identification

### Environment Variables
```bash
OBSERVABILITY_SERVER_URL=http://localhost:4000  # Data processing server
SOURCE_APP=claude-agent-observability          # Agent identifier
CLAUDE_SESSION_ID=auto-generated                # Session tracking
LOG_LEVEL=INFO                                  # Logging level
```

## Development Architecture

### Inter-Agent Communication
- **HTTP/REST** - Event ingestion and API operations (`POST /events`, `GET /events/recent`)
- **WebSocket** - Real-time broadcasting (`WS /stream`)  
- **SQLite** - Persistent storage with concurrent access via WAL mode

### Error Handling Strategy
- **Graceful Degradation** - Hook scripts never break Claude Code agent execution
- **Retry Logic** - Automatic retry with exponential backoff for network failures
- **Circuit Breaker** - Connection health monitoring with automatic recovery

### Type System
Comprehensive TypeScript types in `apps/data-processing/src/types.ts`:
- `HookEvent` interface for event data structure
- `DatabaseEvent` for stored event records  
- `FilterOptions` for dynamic UI filtering
- `WebSocketMessage` for real-time communication

## Development Workflow

### Adding New Hook Types
1. Create new hook script in `apps/event-capture/hooks/`
2. Add event type to `HookEventType` union in `types.ts`
3. Update `settings.json` configuration mapping
4. Add database migration if schema changes needed

### Testing Event Pipeline
```bash
# Manual event testing
cd apps/event-capture
echo '{"test": "data"}' | python send_event.py --event-type PreToolUse

# Database verification
cd apps/data-processing  
bun run dev  # Start server
curl http://localhost:4000/events/recent  # Check stored events
```

### Performance Considerations
- SQLite WAL mode enables concurrent read/write access
- Database indexes optimize filtering by common query patterns
- Event payloads stored as JSON for flexibility
- Optional AI summary generation for event analysis
- Configurable event retention and cleanup policies

The system is designed for defensive security - hook scripts validate and can block dangerous tool usage while ensuring Claude Code agent execution never fails due to observability overhead.
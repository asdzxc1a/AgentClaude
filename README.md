# Multi-Agent Observability System

A comprehensive real-time observability system for monitoring multiple concurrent Claude Code agents through specialized distributed agents.

## Overview

This system implements a sophisticated pipeline architecture that captures, processes, and visualizes events from Claude Code agents in real-time. It provides deep insights into agent operations, tool usage patterns, performance metrics, and user interactions.

## Architecture

```
Claude Code Agents → Event Capture → Data Processing → WebSocket Broadcasting → UI Visualization
```

The system consists of 7 specialized agents:

1. **Event Capture Agent** - Python hook scripts capturing 7 event types
2. **Data Processing Agent** - Bun/TypeScript server for validation & storage  
3. **WebSocket Broadcast Agent** - Real-time event distribution
4. **UI State Management Agent** - Vue 3 reactive state synchronization
5. **Filtering Agent** - Dynamic event search and filtering
6. **Chart Rendering Agent** - Canvas-based real-time visualization
7. **Theme Management Agent** - Custom UI theme persistence

## Quick Start

### Prerequisites
- Python 3.12+ with virtual environment support
- Bun runtime for TypeScript components
- Node.js (for UI components when implemented)

### Setup Event Capture
```bash
# Set up Python environment
python3 -m venv pdf_env
source pdf_env/bin/activate
pip install -r apps/event-capture/requirements.txt

# Deploy hooks to a Claude Code project
cd apps/event-capture  
python setup.py --target-dir /path/to/your/claude/project
```

### Setup Data Processing Server
```bash
cd apps/data-processing
bun install
bun run db:init
bun run dev  # Development server on port 4000
```

## Features

### Security & Validation
- **Dangerous Command Blocking**: Prevents destructive operations (`rm -rf /`, `dd`, etc.)
- **Pattern-based Validation**: Detects and blocks pipe-to-shell attacks
- **Graceful Error Handling**: Never disrupts Claude Code agent execution

### Event Capture
- **7 Hook Event Types**: PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop, SubagentStop
- **Content Analysis**: Intelligent categorization of user prompts and tool usage
- **Performance Metrics**: Execution timing, resource usage, and error analysis
- **Chat Integration**: Optional full conversation transcript capture

### Data Processing
- **SQLite with WAL Mode**: Optimized for concurrent access from multiple agents
- **Performance Indexes**: Fast filtering by app, session, event type, timestamp
- **JSON Payload Storage**: Flexible schema for diverse event data
- **Automatic Migrations**: Backward compatibility with schema evolution

### Real-time Monitoring
- **WebSocket Broadcasting**: Live event streaming to connected clients
- **Event Filtering**: Dynamic search across all event data
- **Theme Customization**: Persistent UI themes with sharing capabilities
- **Performance Dashboards**: Real-time charts and visualizations

## Development

See `CLAUDE.md` for detailed development guidance including:
- Common development commands
- Architecture deep-dive
- Testing procedures
- Performance considerations

## Event Types

| Event Type | Description | Security Impact |
|------------|-------------|-----------------|
| PreToolUse | Tool validation before execution | Can block dangerous commands |
| PostToolUse | Tool result capture with metrics | Performance analysis |
| UserPromptSubmit | User input analysis & categorization | Content insights |
| Notification | Agent-user interaction events | User experience tracking |
| Stop | Main agent session completion | Session lifecycle |
| SubagentStop | Sub-agent task completion | Subtask monitoring |

## Security Model

The system implements **defensive security** principles:
- Hook scripts validate and filter but never break agent execution
- Network failures are handled gracefully with retry logic
- Sensitive command patterns are blocked at the pre-execution stage
- Event data is sanitized and validated before storage

## Performance

- **Concurrent Access**: SQLite WAL mode supports multiple simultaneous agents
- **Efficient Indexing**: Optimized queries for common filtering patterns
- **Event Buffering**: Local queuing during network outages
- **Configurable Retention**: Automatic cleanup of old events

## Status

- ✅ **Event Capture Agent**: Complete with all 7 hook types
- ✅ **Data Processing Foundation**: Database layer and types complete
- 🔄 **Data Processing Server**: HTTP endpoints in progress  
- 📋 **WebSocket & UI Agents**: Planned for next phase

## Contributing

This is an active development project implementing a comprehensive observability solution for multi-agent AI systems. The architecture is designed for extensibility and real-world production deployment.

## License

MIT License - See LICENSE file for details.
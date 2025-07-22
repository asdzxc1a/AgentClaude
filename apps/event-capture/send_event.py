#!/usr/bin/env python3
"""
Event Capture Agent - Universal Event Sender

This script is the core component of the Event Capture Agent, responsible for:
1. Reading hook event data from Claude Code agents
2. Augmenting events with metadata (timestamps, source info)
3. Sending events to the Data Processing Agent
4. Handling network failures gracefully (never breaking agent flow)

Usage:
    send_event.py --event-type <type> [--add-chat] [--summarize] [--source-app <name>]

The script reads JSON event data from stdin and forwards it to the observability server.
"""

import json
import sys
import argparse
import requests
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, Union
import os

# Type definitions
HookEventType = Union[
    "PreToolUse", "PostToolUse", "UserPromptSubmit", 
    "Notification", "Stop", "SubagentStop"
]

# Configuration
DEFAULT_SERVER_URL = "http://localhost:4000"
DEFAULT_SOURCE_APP = "claude-agent-observability"
DEFAULT_TIMEOUT = 10
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 1.0

class EventSender:
    """
    EventSender handles sending observability events to the Data Processing Agent.
    
    Features:
    - Automatic retry logic with exponential backoff
    - Graceful error handling (never breaks Claude agent flow)
    - Session ID tracking for multi-agent coordination
    - Support for chat data and AI summaries
    """
    
    def __init__(self, server_url: str = None, source_app: str = None, 
                 timeout: int = None, max_retries: int = None, 
                 retry_delay: float = None):
        self.server_url = server_url or os.getenv('OBSERVABILITY_SERVER_URL', DEFAULT_SERVER_URL)
        self.source_app = source_app or os.getenv('SOURCE_APP', DEFAULT_SOURCE_APP)
        self.timeout = timeout or DEFAULT_TIMEOUT
        self.max_retries = max_retries or DEFAULT_MAX_RETRIES
        self.retry_delay = retry_delay or DEFAULT_RETRY_DELAY
        self.session_id = os.getenv('CLAUDE_SESSION_ID', self._generate_session_id())
        
    def _generate_session_id(self) -> str:
        """Generate a unique session ID"""
        return str(uuid.uuid4())
        
    def _generate_timestamp(self) -> str:
        """Generate an ISO timestamp"""
        return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        
    def _validate_event_type(self, event_type: str) -> None:
        """Validate that the event type is supported"""
        valid_types = {
            "PreToolUse", "PostToolUse", "UserPromptSubmit", 
            "Notification", "Stop", "SubagentStop"
        }
        if event_type not in valid_types:
            raise ValueError(f"Invalid hook event type: {event_type}. Valid types: {valid_types}")
            
    def send_event(self, event_data_or_type: Union[Dict[str, Any], HookEventType], 
                   event_data: Optional[Dict[str, Any]] = None,
                   chat_data: Optional[list] = None, summary: Optional[str] = None) -> bool:
        """
        Send an event to the observability server.
        
        Supports two calling patterns:
        1. send_event(complete_event_dict)  # Legacy pattern  
        2. send_event(event_type, event_data, chat_data, summary)  # New pattern
        
        Returns:
            bool: True if event was sent successfully, False otherwise
        """
        try:
            # Handle both calling patterns
            if isinstance(event_data_or_type, dict) and event_data is None:
                # Legacy pattern: send_event(complete_event_dict)
                payload = event_data_or_type
                # Validate required fields
                if 'hook_event_type' in payload:
                    self._validate_event_type(payload['hook_event_type'])
            else:
                # New pattern: send_event(event_type, event_data, ...)
                event_type = event_data_or_type
                self._validate_event_type(event_type)
                
                # Construct full event payload
                payload = {
                    "source_app": self.source_app,
                    "session_id": self.session_id,
                    "hook_event_type": event_type,
                    "payload": event_data,
                    "timestamp": self._generate_timestamp()
                }
                
                # Add optional fields
                if chat_data:
                    payload["chat"] = chat_data
                if summary:
                    payload["summary"] = summary
                    
            # Attempt to send with retry logic
            return self._send_with_retry(payload)
            
        except (json.JSONEncodeError, TypeError) as e:
            print(f"Error: Failed to serialize event data: {e}", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Error: Unexpected error preparing event: {e}", file=sys.stderr)
            return False
            
    def _send_with_retry(self, payload: Dict[str, Any]) -> bool:
        """Send payload with retry logic"""
        endpoint = f"{self.server_url}/events"
        
        for attempt in range(self.max_retries + 1):
            try:
                response = requests.post(
                    endpoint,
                    data=json.dumps(payload),
                    timeout=self.timeout,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': f'EventCaptureAgent/1.0 (Claude-Code-Agent)'
                    }
                )
                
                if response.status_code in [200, 201]:
                    return True
                else:
                    print(f"Server error: {response.status_code} - {response.text[:200]}", 
                          file=sys.stderr)
                    
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                if attempt < self.max_retries:
                    print(f"Network error (attempt {attempt + 1}): {e}", file=sys.stderr)
                    time.sleep(self.retry_delay)
                    continue
                else:
                    print(f"Network error (final attempt): {e}", file=sys.stderr)
                    
            except requests.exceptions.RequestException as e:
                print(f"Request error: {e}", file=sys.stderr)
                break
                
            # Break on non-retryable errors
            if attempt >= self.max_retries:
                break
                
        return False
        
    def read_stdin_data(self) -> Dict[Any, Any]:
        """Read and parse JSON data from stdin"""
        try:
            stdin_data = sys.stdin.read().strip()
            if not stdin_data:
                return {}
            return json.loads(stdin_data)
        except json.JSONDecodeError as e:
            print(f"Warning: Invalid JSON from stdin: {e}", file=sys.stderr)
            return {}
        except Exception as e:
            print(f"Warning: Error reading stdin: {e}", file=sys.stderr)
            return {}
    
    def read_chat_file(self, chat_file_path: str) -> Optional[list]:
        """Read conversation transcript from .jsonl file"""
        try:
            chat_path = Path(chat_file_path)
            if not chat_path.exists():
                print(f"Warning: Chat file not found: {chat_file_path}", file=sys.stderr)
                return None
            
            chat_data = []
            with open(chat_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        chat_data.append(json.loads(line))
            
            print(f"Loaded {len(chat_data)} chat entries from {chat_file_path}", file=sys.stderr)
            return chat_data
            
        except Exception as e:
            print(f"Warning: Error reading chat file: {e}", file=sys.stderr)
            return None
    
    def generate_summary(self, event_data: Dict[Any, Any]) -> Optional[str]:
        """Generate AI summary of the event (placeholder for now)"""
        try:
            # In a real implementation, this would call an AI service
            # For now, generate a simple summary based on event type and content
            
            event_type = event_data.get('hook_event_type', 'Unknown')
            payload = event_data.get('payload', {})
            
            summary_parts = [f"Event: {event_type}"]
            
            if 'tool' in payload:
                summary_parts.append(f"Tool: {payload['tool']}")
            
            if 'command' in payload:
                summary_parts.append(f"Command: {payload['command']}")
            
            if 'error' in payload:
                summary_parts.append(f"Error: {payload['error']}")
            
            return " | ".join(summary_parts)
            
        except Exception as e:
            print(f"Warning: Error generating summary: {e}", file=sys.stderr)
            return None
    
    def augment_event_data(self, raw_data: Dict[Any, Any], event_type: str, 
                          add_chat: bool = False, chat_file: str = None,
                          summarize: bool = False) -> Dict[str, Any]:
        """Augment raw event data with metadata and optional enhancements"""
        
        # Base event structure
        event_data = {
            "source_app": self.source_app,
            "session_id": self.session_id,
            "hook_event_type": event_type,
            "payload": raw_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Add chat transcript if requested
        if add_chat and chat_file:
            chat_data = self.read_chat_file(chat_file)
            if chat_data:
                event_data["chat"] = chat_data
        
        # Add AI summary if requested
        if summarize:
            summary = self.generate_summary(event_data)
            if summary:
                event_data["summary"] = summary
        
        return event_data
    
    
    def handle_event(self, event_type: str, add_chat: bool = False, 
                    chat_file: str = None, summarize: bool = False) -> int:
        """Main event handling logic"""
        
        # Read raw event data from stdin
        raw_data = self.read_stdin_data()
        
        # Augment with metadata
        event_data = self.augment_event_data(
            raw_data, event_type, add_chat, chat_file, summarize
        )
        
        print(f"Processing {event_type} event with {len(json.dumps(event_data))} bytes", file=sys.stderr)
        
        # Send to server
        success = self.send_event(event_data)
        
        # Always return success (0) to avoid breaking Claude agent flow
        # Even if sending fails, the agent should continue operating
        if not success:
            print("Note: Event sending failed, but continuing agent execution", file=sys.stderr)
        
        return 0

def main():
    """Main entry point for command-line usage"""
    parser = argparse.ArgumentParser(
        description="Universal event sender for Claude Code observability",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  echo '{"tool": "bash"}' | python send_event.py --event-type PreToolUse
  echo '{"result": "success"}' | python send_event.py --event-type PostToolUse --summarize
  echo '{"prompt": "Hello"}' | python send_event.py --event-type UserPromptSubmit --add-chat chat.jsonl
        """
    )
    
    parser.add_argument(
        '--event-type', 
        required=True,
        choices=['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Notification', 'Stop', 'SubagentStop'],
        help='Type of Claude Code hook event'
    )
    
    parser.add_argument(
        '--add-chat',
        metavar='CHAT_FILE',
        help='Path to .jsonl chat file to include with event'
    )
    
    parser.add_argument(
        '--summarize',
        action='store_true',
        help='Generate AI summary for the event'
    )
    
    parser.add_argument(
        '--source-app',
        help='Override source application name'
    )
    
    parser.add_argument(
        '--server-url',
        help='Override observability server URL'
    )
    
    args = parser.parse_args()
    
    # Create event sender
    sender = EventSender(
        server_url=args.server_url,
        source_app=args.source_app
    )
    
    # Handle the event
    exit_code = sender.handle_event(
        event_type=args.event_type,
        add_chat=bool(args.add_chat),
        chat_file=args.add_chat,
        summarize=args.summarize
    )
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
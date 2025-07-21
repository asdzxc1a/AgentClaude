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
from typing import Dict, Any, Optional
import os

# Configuration
DEFAULT_SERVER_URL = "http://localhost:4000"
DEFAULT_SOURCE_APP = "claude-agent"
REQUEST_TIMEOUT = 5  # seconds
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds

class EventSender:
    def __init__(self, server_url: str = None, source_app: str = None):
        self.server_url = server_url or os.getenv('OBSERVABILITY_SERVER_URL', DEFAULT_SERVER_URL)
        self.source_app = source_app or os.getenv('SOURCE_APP', DEFAULT_SOURCE_APP)
        self.session_id = os.getenv('CLAUDE_SESSION_ID', str(uuid.uuid4()))
        
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
    
    def send_event(self, event_data: Dict[str, Any]) -> bool:
        """Send event to the Data Processing Agent with retries"""
        
        endpoint = f"{self.server_url}/events"
        
        for attempt in range(MAX_RETRIES):
            try:
                print(f"Sending event to {endpoint} (attempt {attempt + 1})", file=sys.stderr)
                
                response = requests.post(
                    endpoint,
                    json=event_data,
                    timeout=REQUEST_TIMEOUT,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': f'EventCaptureAgent/{self.source_app}'
                    }
                )
                
                if response.status_code == 200:
                    print(f"✓ Event sent successfully: {response.status_code}", file=sys.stderr)
                    return True
                else:
                    print(f"✗ Server returned error: {response.status_code} - {response.text}", file=sys.stderr)
                    
            except requests.exceptions.Timeout:
                print(f"✗ Request timeout (attempt {attempt + 1})", file=sys.stderr)
            except requests.exceptions.ConnectionError:
                print(f"✗ Connection failed (attempt {attempt + 1})", file=sys.stderr)
            except Exception as e:
                print(f"✗ Unexpected error (attempt {attempt + 1}): {e}", file=sys.stderr)
            
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
        
        print(f"✗ Failed to send event after {MAX_RETRIES} attempts", file=sys.stderr)
        return False
    
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
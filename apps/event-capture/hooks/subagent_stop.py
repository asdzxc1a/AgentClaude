#!/usr/bin/env python3
"""
Subagent Stop Hook

This hook is triggered when a sub-agent finishes its task.
Sub-agents are spawned by the main Claude Code agent for specific subtasks.
"""

import json
import sys
from typing import Dict, Any
from datetime import datetime

class SubagentStopCapture:
    def __init__(self):
        self.capture_timestamp = datetime.now().isoformat()
    
    def read_subagent_stop_data(self) -> Dict[str, Any]:
        """Read subagent stop event data from stdin"""
        try:
            stdin_data = sys.stdin.read().strip()
            if not stdin_data:
                return {}
            return json.loads(stdin_data)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON from stdin: {e}", file=sys.stderr)
            return {}
        except Exception as e:
            print(f"Error: Failed to read subagent stop data: {e}", file=sys.stderr)
            return {}
    
    def process_subagent_stop_event(self) -> int:
        """Main processing logic for subagent stop events"""
        
        # Read stop data
        stop_data = self.read_subagent_stop_data()
        
        # Prepare result
        result = {
            'capture_timestamp': self.capture_timestamp,
            'raw_data': stop_data,
            'subagent_id': stop_data.get('subagent_id', 'unknown'),
            'parent_session_id': stop_data.get('parent_session_id', ''),
            'task_completed': True,
            'exit_reason': stop_data.get('reason', 'completed'),
            'final_status': stop_data.get('status', 'success'),
            'task_type': stop_data.get('task_type', 'unknown'),
        }
        
        # Output result
        print(json.dumps(result))
        
        # Log subagent completion
        subagent_id = result['subagent_id']
        task_type = result['task_type']
        status = result['final_status']
        print(f"🤖 Subagent [{subagent_id}] completed {task_type}: {status}", file=sys.stderr)
        
        return 0

def main():
    """Main entry point"""
    capture = SubagentStopCapture()
    exit_code = capture.process_subagent_stop_event()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
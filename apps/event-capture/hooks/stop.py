#!/usr/bin/env python3
"""
Stop Hook

This hook is triggered when a Claude Code agent finishes its task.
It marks session completion and can attach a final chat log if requested.
"""

import json
import sys
from typing import Dict, Any
from datetime import datetime

class StopCapture:
    def __init__(self):
        self.capture_timestamp = datetime.now().isoformat()
    
    def read_stop_data(self) -> Dict[str, Any]:
        """Read stop event data from stdin"""
        try:
            stdin_data = sys.stdin.read().strip()
            if not stdin_data:
                return {}
            return json.loads(stdin_data)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON from stdin: {e}", file=sys.stderr)
            return {}
        except Exception as e:
            print(f"Error: Failed to read stop data: {e}", file=sys.stderr)
            return {}
    
    def process_stop_event(self) -> int:
        """Main processing logic for stop events"""
        
        # Read stop data
        stop_data = self.read_stop_data()
        
        # Prepare result
        result = {
            'capture_timestamp': self.capture_timestamp,
            'raw_data': stop_data,
            'session_completed': True,
            'exit_reason': stop_data.get('reason', 'completed'),
            'final_status': stop_data.get('status', 'success'),
        }
        
        # Output result
        print(json.dumps(result))
        
        # Log session completion
        reason = result['exit_reason']
        status = result['final_status']
        print(f"🏁 Session completed: {reason} ({status})", file=sys.stderr)
        
        return 0

def main():
    """Main entry point"""
    capture = StopCapture()
    exit_code = capture.process_stop_event()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
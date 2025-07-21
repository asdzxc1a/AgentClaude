#!/usr/bin/env python3
"""
Notification Hook

This hook runs on certain user notification events, such as when the agent
presents a message or needs user confirmation.

It captures interaction events between the agent and user.
"""

import json
import sys
from typing import Dict, Any
from datetime import datetime

NOTIFICATION_TYPES = {
    'message': 'Agent message to user',
    'confirmation': 'User confirmation request',
    'warning': 'Warning notification',
    'error': 'Error notification',
    'info': 'Information notification',
    'prompt': 'User input prompt',
}

class NotificationCapture:
    def __init__(self):
        self.capture_timestamp = datetime.now().isoformat()
    
    def read_notification_data(self) -> Dict[str, Any]:
        """Read notification data from stdin"""
        try:
            stdin_data = sys.stdin.read().strip()
            if not stdin_data:
                return {}
            return json.loads(stdin_data)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON from stdin: {e}", file=sys.stderr)
            return {}
        except Exception as e:
            print(f"Error: Failed to read notification data: {e}", file=sys.stderr)
            return {}
    
    def process_notification_event(self) -> int:
        """Main processing logic for notification events"""
        
        # Read notification data
        notification_data = self.read_notification_data()
        
        # Prepare result
        result = {
            'capture_timestamp': self.capture_timestamp,
            'raw_data': notification_data,
            'notification_type': notification_data.get('type', 'unknown'),
            'message': notification_data.get('message', ''),
            'severity': notification_data.get('severity', 'info'),
        }
        
        # Output result
        print(json.dumps(result))
        
        # Log notification
        notif_type = result['notification_type']
        message = result['message'][:100] + '...' if len(result['message']) > 100 else result['message']
        print(f"🔔 Notification [{notif_type}]: {message}", file=sys.stderr)
        
        return 0

def main():
    """Main entry point"""
    capture = NotificationCapture()
    exit_code = capture.process_notification_event()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
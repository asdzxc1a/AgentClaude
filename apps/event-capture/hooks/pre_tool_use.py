#!/usr/bin/env python3
"""
Pre-Tool Use Hook

This hook runs before Claude Code executes any tool/command.
It can validate, filter, or block dangerous tool usage and prepare event info.

The hook receives tool information via stdin and can:
1. Validate the tool command for safety
2. Block dangerous operations by exiting with non-zero status
3. Augment the event data before forwarding
4. Log tool usage patterns
"""

import json
import sys
import re
from pathlib import Path
from typing import Dict, Any, List

# Dangerous command patterns to block or warn about
DANGEROUS_PATTERNS = [
    r'rm\s+-rf\s+/',           # Dangerous rm commands
    r'dd\s+if=.*of=/dev/',     # Disk operations
    r'mkfs\.',                 # Filesystem creation
    r'fdisk',                  # Disk partitioning
    r'sudo\s+rm',              # Sudo rm operations
    r'>\s*/dev/sd[a-z]',       # Writing to disk devices
    r'curl.*\|\s*bash',        # Pipe to bash (potential malware)
    r'wget.*\|\s*sh',          # Pipe to shell
]

# Patterns that require user confirmation
WARNING_PATTERNS = [
    r'sudo',                   # Any sudo command
    r'chmod\s+777',            # Overly permissive permissions  
    r'git\s+push.*--force',    # Force push
    r'docker\s+run.*--privileged',  # Privileged containers
]

class PreToolUseValidator:
    def __init__(self):
        self.blocked_count = 0
        self.warned_count = 0
    
    def read_tool_data(self) -> Dict[str, Any]:
        """Read tool execution data from stdin"""
        try:
            stdin_data = sys.stdin.read().strip()
            if not stdin_data:
                return {}
            return json.loads(stdin_data)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON from stdin: {e}", file=sys.stderr)
            return {}
        except Exception as e:
            print(f"Error: Failed to read tool data: {e}", file=sys.stderr)
            return {}
    
    def extract_command(self, tool_data: Dict[str, Any]) -> str:
        """Extract command string from tool data"""
        # Try different possible locations for the command
        if 'command' in tool_data:
            return str(tool_data['command'])
        elif 'tool_input' in tool_data and 'command' in tool_data['tool_input']:
            return str(tool_data['tool_input']['command'])
        elif 'parameters' in tool_data and 'command' in tool_data['parameters']:
            return str(tool_data['parameters']['command'])
        else:
            # Look for any string value that might be a command
            for key, value in tool_data.items():
                if isinstance(value, str) and len(value) > 0:
                    return value
            return ""
    
    def check_dangerous_patterns(self, command: str) -> List[str]:
        """Check command against dangerous patterns"""
        dangerous_matches = []
        
        for pattern in DANGEROUS_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                dangerous_matches.append(pattern)
        
        return dangerous_matches
    
    def check_warning_patterns(self, command: str) -> List[str]:
        """Check command against warning patterns"""
        warning_matches = []
        
        for pattern in WARNING_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                warning_matches.append(pattern)
        
        return warning_matches
    
    def validate_tool_usage(self, tool_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and augment tool usage data"""
        
        command = self.extract_command(tool_data)
        tool_name = tool_data.get('tool', tool_data.get('tool_name', 'unknown'))
        
        # Initialize validation result
        validation_result = {
            'original_data': tool_data,
            'extracted_command': command,
            'tool_name': tool_name,
            'validation_status': 'approved',
            'warnings': [],
            'blocks': [],
            'metadata': {
                'validator': 'PreToolUseValidator',
                'command_length': len(command),
                'has_sudo': 'sudo' in command,
                'has_pipes': '|' in command,
                'has_redirects': any(op in command for op in ['>', '<', '>>']),
            }
        }
        
        if not command:
            validation_result['warnings'].append("No command found in tool data")
            return validation_result
        
        # Check for dangerous patterns
        dangerous_matches = self.check_dangerous_patterns(command)
        if dangerous_matches:
            validation_result['validation_status'] = 'blocked'
            validation_result['blocks'] = dangerous_matches
            self.blocked_count += 1
            print(f"🚫 BLOCKED dangerous command: {command}", file=sys.stderr)
            print(f"   Matched patterns: {dangerous_matches}", file=sys.stderr)
        
        # Check for warning patterns (if not already blocked)
        if validation_result['validation_status'] != 'blocked':
            warning_matches = self.check_warning_patterns(command)
            if warning_matches:
                validation_result['warnings'] = warning_matches
                self.warned_count += 1
                print(f"⚠️  WARNING for command: {command}", file=sys.stderr)
                print(f"   Matched patterns: {warning_matches}", file=sys.stderr)
        
        return validation_result
    
    def process_tool_event(self) -> int:
        """Main processing logic for pre-tool-use events"""
        
        # Read tool data
        tool_data = self.read_tool_data()
        
        if not tool_data:
            print("Warning: No tool data received", file=sys.stderr)
            return 0  # Don't block execution for missing data
        
        # Validate the tool usage
        validation_result = self.validate_tool_usage(tool_data)
        
        # Output validation result to stdout for send_event.py
        print(json.dumps(validation_result))
        
        # Block execution if dangerous patterns detected
        if validation_result['validation_status'] == 'blocked':
            print(f"Tool execution blocked due to dangerous patterns", file=sys.stderr)
            return 1  # Non-zero exit code blocks the tool execution
        
        # Log successful validation
        print(f"✓ Tool validated: {validation_result['tool_name']}", file=sys.stderr)
        return 0

def main():
    """Main entry point"""
    validator = PreToolUseValidator()
    exit_code = validator.process_tool_event()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
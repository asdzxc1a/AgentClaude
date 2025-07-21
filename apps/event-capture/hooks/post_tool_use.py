#!/usr/bin/env python3
"""
Post-Tool Use Hook

This hook runs after Claude Code executes a tool/command.
It captures the result, output, and any errors for logging and analysis.

The hook receives tool execution results via stdin and can:
1. Capture tool outputs and results
2. Analyze execution success/failure
3. Extract performance metrics
4. Log execution patterns and errors
"""

import json
import sys
import time
import re
from typing import Dict, Any, Optional
from datetime import datetime

class PostToolUseCapture:
    def __init__(self):
        self.capture_timestamp = datetime.now().isoformat()
    
    def read_tool_result(self) -> Dict[str, Any]:
        """Read tool execution result from stdin"""
        try:
            stdin_data = sys.stdin.read().strip()
            if not stdin_data:
                return {}
            return json.loads(stdin_data)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON from stdin: {e}", file=sys.stderr)
            return {}
        except Exception as e:
            print(f"Error: Failed to read tool result: {e}", file=sys.stderr)
            return {}
    
    def extract_execution_info(self, tool_result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract and analyze execution information"""
        
        # Initialize execution info structure
        execution_info = {
            'capture_timestamp': self.capture_timestamp,
            'raw_result': tool_result,
            'execution_status': 'unknown',
            'output_analysis': {},
            'performance_metrics': {},
            'error_analysis': {},
        }
        
        # Determine execution status
        if 'error' in tool_result:
            execution_info['execution_status'] = 'error'
        elif 'success' in tool_result and tool_result['success']:
            execution_info['execution_status'] = 'success'
        elif 'exit_code' in tool_result:
            exit_code = tool_result.get('exit_code', 0)
            execution_info['execution_status'] = 'success' if exit_code == 0 else 'error'
        elif 'output' in tool_result or 'result' in tool_result:
            execution_info['execution_status'] = 'success'
        
        # Analyze output
        execution_info['output_analysis'] = self.analyze_output(tool_result)
        
        # Extract performance metrics
        execution_info['performance_metrics'] = self.extract_performance_metrics(tool_result)
        
        # Analyze errors if present
        if execution_info['execution_status'] == 'error':
            execution_info['error_analysis'] = self.analyze_errors(tool_result)
        
        return execution_info
    
    def analyze_output(self, tool_result: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze tool output content"""
        output_analysis = {
            'has_output': False,
            'output_length': 0,
            'output_lines': 0,
            'contains_errors': False,
            'output_type': 'unknown',
        }
        
        # Find output content
        output_content = ""
        if 'output' in tool_result:
            output_content = str(tool_result['output'])
        elif 'result' in tool_result:
            output_content = str(tool_result['result'])
        elif 'stdout' in tool_result:
            output_content = str(tool_result['stdout'])
        
        if output_content:
            output_analysis['has_output'] = True
            output_analysis['output_length'] = len(output_content)
            output_analysis['output_lines'] = len(output_content.split('\n'))
            
            # Determine output type
            if output_content.strip().startswith('{') and output_content.strip().endswith('}'):
                output_analysis['output_type'] = 'json'
            elif output_content.strip().startswith('<') and output_content.strip().endswith('>'):
                output_analysis['output_type'] = 'xml'
            elif re.search(r'error|exception|traceback|failed', output_content, re.IGNORECASE):
                output_analysis['contains_errors'] = True
                output_analysis['output_type'] = 'error_log'
            elif re.search(r'success|complete|done|finished', output_content, re.IGNORECASE):
                output_analysis['output_type'] = 'success_message'
            else:
                output_analysis['output_type'] = 'text'
        
        return output_analysis
    
    def extract_performance_metrics(self, tool_result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract performance and timing metrics"""
        performance_metrics = {
            'has_timing': False,
            'execution_time': None,
            'memory_usage': None,
            'file_operations': 0,
            'network_operations': 0,
        }
        
        # Look for timing information
        if 'execution_time' in tool_result:
            performance_metrics['has_timing'] = True
            performance_metrics['execution_time'] = tool_result['execution_time']
        elif 'duration' in tool_result:
            performance_metrics['has_timing'] = True
            performance_metrics['execution_time'] = tool_result['duration']
        
        # Look for memory usage
        if 'memory_usage' in tool_result:
            performance_metrics['memory_usage'] = tool_result['memory_usage']
        
        # Estimate operations based on output content
        output_str = str(tool_result.get('output', ''))
        if re.search(r'file|directory|folder|path', output_str, re.IGNORECASE):
            performance_metrics['file_operations'] += len(re.findall(r'\b\w+\.(txt|json|py|js|md|html|css)\b', output_str))
        
        if re.search(r'http|https|api|request|response', output_str, re.IGNORECASE):
            performance_metrics['network_operations'] += len(re.findall(r'https?://\S+', output_str))
        
        return performance_metrics
    
    def analyze_errors(self, tool_result: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze error information"""
        error_analysis = {
            'error_type': 'unknown',
            'error_message': '',
            'has_traceback': False,
            'exit_code': None,
            'recoverable': True,
        }
        
        # Extract error information
        if 'error' in tool_result:
            error_info = tool_result['error']
            if isinstance(error_info, dict):
                error_analysis['error_type'] = error_info.get('type', 'unknown')
                error_analysis['error_message'] = str(error_info.get('message', ''))
            else:
                error_analysis['error_message'] = str(error_info)
        
        # Check for exit code
        if 'exit_code' in tool_result:
            error_analysis['exit_code'] = tool_result['exit_code']
        
        # Check for traceback
        error_content = error_analysis['error_message'] + str(tool_result.get('stderr', ''))
        if re.search(r'traceback|stack trace|at line \d+', error_content, re.IGNORECASE):
            error_analysis['has_traceback'] = True
        
        # Determine if error is recoverable
        fatal_patterns = [
            r'segmentation fault',
            r'out of memory',
            r'disk full',
            r'permission denied',
            r'file not found',
        ]
        
        for pattern in fatal_patterns:
            if re.search(pattern, error_content, re.IGNORECASE):
                error_analysis['recoverable'] = False
                break
        
        # Categorize error type based on content
        if re.search(r'syntax|parse', error_content, re.IGNORECASE):
            error_analysis['error_type'] = 'syntax_error'
        elif re.search(r'permission|access|denied', error_content, re.IGNORECASE):
            error_analysis['error_type'] = 'permission_error'
        elif re.search(r'network|connection|timeout', error_content, re.IGNORECASE):
            error_analysis['error_type'] = 'network_error'
        elif re.search(r'file not found|no such file', error_content, re.IGNORECASE):
            error_analysis['error_type'] = 'file_not_found'
        
        return error_analysis
    
    def process_tool_result(self) -> int:
        """Main processing logic for post-tool-use events"""
        
        # Read tool result data
        tool_result = self.read_tool_result()
        
        if not tool_result:
            print("Warning: No tool result data received", file=sys.stderr)
            # Still output empty result for consistency
            print(json.dumps({'capture_timestamp': self.capture_timestamp, 'raw_result': {}}))
            return 0
        
        # Extract and analyze execution information
        execution_info = self.extract_execution_info(tool_result)
        
        # Output analysis result to stdout for send_event.py
        print(json.dumps(execution_info))
        
        # Log execution status
        status = execution_info['execution_status']
        if status == 'success':
            print(f"✓ Tool execution completed successfully", file=sys.stderr)
        elif status == 'error':
            error_msg = execution_info.get('error_analysis', {}).get('error_message', 'Unknown error')
            print(f"✗ Tool execution failed: {error_msg}", file=sys.stderr)
        else:
            print(f"? Tool execution status unclear", file=sys.stderr)
        
        return 0

def main():
    """Main entry point"""
    capture = PostToolUseCapture()
    exit_code = capture.process_tool_result()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
User Prompt Submit Hook

This hook runs when a user submits a prompt to the Claude Code agent.
It captures the user input and can enforce input validation.

Available since Claude v1.0.54, this captures the raw user prompt text
so it can be displayed in the observability UI.
"""

import json
import sys
import re
import hashlib
from typing import Dict, Any, List
from datetime import datetime

# Input validation patterns
SUSPICIOUS_PATTERNS = [
    r'<script[^>]*>.*?</script>',  # Script injection
    r'javascript:',                # JavaScript URLs
    r'data:text/html',            # Data URLs with HTML
    r'eval\s*\(',                 # Eval calls
    r'exec\s*\(',                 # Exec calls
]

# Content analysis patterns
CONTENT_PATTERNS = {
    'code_request': [
        r'write.*code',
        r'implement.*function',
        r'create.*script',
        r'build.*application',
    ],
    'file_operation': [
        r'read.*file',
        r'write.*file',
        r'delete.*file',
        r'create.*file',
    ],
    'system_command': [
        r'run.*command',
        r'execute.*bash',
        r'install.*package',
        r'sudo.*',
    ],
    'question': [
        r'\?',
        r'what.*',
        r'how.*',
        r'why.*',
        r'explain.*',
    ],
}

class UserPromptCapture:
    def __init__(self):
        self.capture_timestamp = datetime.now().isoformat()
    
    def read_prompt_data(self) -> Dict[str, Any]:
        """Read user prompt data from stdin"""
        try:
            stdin_data = sys.stdin.read().strip()
            if not stdin_data:
                return {}
            return json.loads(stdin_data)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON from stdin: {e}", file=sys.stderr)
            return {}
        except Exception as e:
            print(f"Error: Failed to read prompt data: {e}", file=sys.stderr)
            return {}
    
    def extract_prompt_text(self, prompt_data: Dict[str, Any]) -> str:
        """Extract prompt text from various possible locations"""
        
        # Try common field names for the prompt
        prompt_fields = ['prompt', 'text', 'message', 'input', 'user_input', 'content']
        
        for field in prompt_fields:
            if field in prompt_data:
                return str(prompt_data[field])
        
        # If no specific field, look for string values
        for key, value in prompt_data.items():
            if isinstance(value, str) and len(value) > 0:
                return value
        
        return ""
    
    def validate_prompt(self, prompt_text: str) -> Dict[str, Any]:
        """Validate prompt for suspicious content"""
        validation_result = {
            'is_safe': True,
            'suspicious_patterns': [],
            'warnings': [],
        }
        
        # Check for suspicious patterns
        for pattern in SUSPICIOUS_PATTERNS:
            if re.search(pattern, prompt_text, re.IGNORECASE | re.DOTALL):
                validation_result['is_safe'] = False
                validation_result['suspicious_patterns'].append(pattern)
        
        # Additional validation checks
        if len(prompt_text) > 50000:  # Very long prompts
            validation_result['warnings'].append('Unusually long prompt (>50k chars)')
        
        if re.search(r'[^\x00-\x7F]', prompt_text):  # Non-ASCII characters
            non_ascii_count = len(re.findall(r'[^\x00-\x7F]', prompt_text))
            if non_ascii_count > 100:
                validation_result['warnings'].append(f'High non-ASCII character count: {non_ascii_count}')
        
        return validation_result
    
    def analyze_prompt_content(self, prompt_text: str) -> Dict[str, Any]:
        """Analyze prompt content and categorize the request type"""
        content_analysis = {
            'length': len(prompt_text),
            'word_count': len(prompt_text.split()),
            'line_count': len(prompt_text.split('\n')),
            'categories': [],
            'complexity_score': 0,
            'contains_code': False,
            'language_hints': [],
        }
        
        # Categorize content based on patterns
        for category, patterns in CONTENT_PATTERNS.items():
            matches = 0
            for pattern in patterns:
                matches += len(re.findall(pattern, prompt_text, re.IGNORECASE))
            
            if matches > 0:
                content_analysis['categories'].append({
                    'category': category,
                    'confidence': min(matches / len(patterns), 1.0)
                })
        
        # Check for code content
        code_indicators = [
            r'```',           # Code blocks
            r'def\s+\w+\(',   # Python functions
            r'function\s+\w+', # JavaScript functions
            r'class\s+\w+',   # Class definitions
            r'import\s+\w+',  # Import statements
            r'#include\s*<',  # C/C++ includes
        ]
        
        for indicator in code_indicators:
            if re.search(indicator, prompt_text):
                content_analysis['contains_code'] = True
                break
        
        # Detect programming languages mentioned
        languages = [
            'python', 'javascript', 'typescript', 'java', 'cpp', 'c\+\+',
            'rust', 'go', 'php', 'ruby', 'swift', 'kotlin', 'scala',
            'html', 'css', 'sql', 'bash', 'shell', 'powershell'
        ]
        
        for lang in languages:
            if re.search(rf'\b{lang}\b', prompt_text, re.IGNORECASE):
                content_analysis['language_hints'].append(lang)
        
        # Calculate complexity score
        complexity_factors = [
            len(prompt_text) / 1000,  # Length factor
            len(content_analysis['categories']) * 0.5,  # Multi-category requests
            1 if content_analysis['contains_code'] else 0,  # Code presence
            len(content_analysis['language_hints']) * 0.3,  # Multiple languages
        ]
        
        content_analysis['complexity_score'] = min(sum(complexity_factors), 10.0)
        
        return content_analysis
    
    def generate_prompt_hash(self, prompt_text: str) -> str:
        """Generate a hash for the prompt (for deduplication without storing full text)"""
        return hashlib.sha256(prompt_text.encode('utf-8')).hexdigest()[:16]
    
    def process_prompt_event(self) -> int:
        """Main processing logic for user prompt submission events"""
        
        # Read prompt data
        prompt_data = self.read_prompt_data()
        
        if not prompt_data:
            print("Warning: No prompt data received", file=sys.stderr)
            empty_result = {
                'capture_timestamp': self.capture_timestamp,
                'raw_data': {},
                'prompt_text': '',
                'validation': {'is_safe': True, 'suspicious_patterns': [], 'warnings': []},
                'content_analysis': {'length': 0, 'categories': []},
                'prompt_hash': '',
            }
            print(json.dumps(empty_result))
            return 0
        
        # Extract prompt text
        prompt_text = self.extract_prompt_text(prompt_data)
        
        # Validate prompt
        validation = self.validate_prompt(prompt_text)
        
        # Analyze content
        content_analysis = self.analyze_prompt_content(prompt_text)
        
        # Generate hash
        prompt_hash = self.generate_prompt_hash(prompt_text)
        
        # Prepare result (with privacy considerations)
        result = {
            'capture_timestamp': self.capture_timestamp,
            'raw_data': prompt_data,
            'prompt_text': prompt_text,  # Full text - consider privacy implications
            'validation': validation,
            'content_analysis': content_analysis,
            'prompt_hash': prompt_hash,
            'privacy_note': 'Full prompt text is captured for observability - consider data retention policies'
        }
        
        # Output result to stdout for send_event.py
        print(json.dumps(result))
        
        # Log validation status
        if not validation['is_safe']:
            print(f"⚠️  Suspicious prompt detected: {validation['suspicious_patterns']}", file=sys.stderr)
        
        if validation['warnings']:
            print(f"⚠️  Prompt warnings: {validation['warnings']}", file=sys.stderr)
        
        # Log content analysis
        categories = [cat['category'] for cat in content_analysis['categories']]
        print(f"📝 Prompt captured: {content_analysis['length']} chars, categories: {categories}", file=sys.stderr)
        
        # Don't block execution even for suspicious prompts (just log)
        return 0

def main():
    """Main entry point"""
    capture = UserPromptCapture()
    exit_code = capture.process_prompt_event()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
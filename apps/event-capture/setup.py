#!/usr/bin/env python3
"""
Event Capture Agent Setup Script

This script sets up the Event Capture Agent for Claude Code hook integration.
"""

import os
import sys
import shutil
import stat
from pathlib import Path
import json
import argparse

class EventCaptureSetup:
    def __init__(self, target_dir: str = None):
        self.target_dir = Path(target_dir) if target_dir else Path.cwd()
        self.claude_dir = self.target_dir / '.claude'
        self.hooks_dir = self.claude_dir / 'hooks'
        self.current_dir = Path(__file__).parent
    
    def create_directories(self):
        """Create necessary directories"""
        print(f"Creating directories in {self.target_dir}")
        
        self.claude_dir.mkdir(exist_ok=True)
        self.hooks_dir.mkdir(exist_ok=True)
        
        print(f"✓ Created {self.claude_dir}")
        print(f"✓ Created {self.hooks_dir}")
    
    def copy_hook_scripts(self):
        """Copy hook scripts and make them executable"""
        print("Copying hook scripts...")
        
        hook_files = [
            'send_event.py',
            'hooks/pre_tool_use.py',
            'hooks/post_tool_use.py',
            'hooks/user_prompt_submit.py',
            'hooks/notification.py',
            'hooks/stop.py',
            'hooks/subagent_stop.py',
        ]
        
        for hook_file in hook_files:
            src_path = self.current_dir / hook_file
            
            if hook_file.startswith('hooks/'):
                dst_path = self.hooks_dir / Path(hook_file).name
            else:
                dst_path = self.claude_dir / hook_file
            
            if src_path.exists():
                shutil.copy2(src_path, dst_path)
                
                # Make executable
                current_permissions = dst_path.stat().st_mode
                dst_path.chmod(current_permissions | stat.S_IEXEC)
                
                print(f"✓ Copied and made executable: {dst_path}")
            else:
                print(f"✗ Warning: Source file not found: {src_path}")
    
    def copy_settings(self):
        """Copy settings configuration"""
        print("Copying settings configuration...")
        
        src_settings = self.current_dir / '.claude' / 'settings.json'
        dst_settings = self.claude_dir / 'settings.json'
        
        if src_settings.exists():
            shutil.copy2(src_settings, dst_settings)
            print(f"✓ Copied settings: {dst_settings}")
        else:
            print(f"✗ Warning: Settings file not found: {src_settings}")
    
    def create_environment_file(self):
        """Create environment configuration file"""
        env_file = self.claude_dir / 'environment.env'
        
        env_content = """# Multi-Agent Observability System Environment Configuration

# Server Configuration
OBSERVABILITY_SERVER_URL=http://localhost:4000

# Agent Configuration
SOURCE_APP=claude-agent-observability
CLAUDE_SESSION_ID=auto-generated

# API Keys (optional, for enhanced features)
# OPENAI_API_KEY=your_openai_key_here
# ANTHROPIC_API_KEY=your_anthropic_key_here

# Logging
LOG_LEVEL=INFO
DEBUG_HOOKS=false

# Performance
HOOK_TIMEOUT=30
MAX_RETRIES=3
"""
        
        with open(env_file, 'w') as f:
            f.write(env_content)
        
        print(f"✓ Created environment file: {env_file}")
    
    def create_readme(self):
        """Create setup README"""
        readme_file = self.claude_dir / 'README.md'
        
        readme_content = """# Multi-Agent Observability System - Event Capture Agent

This directory contains the Event Capture Agent configuration for Claude Code hook integration.

## Files

- `settings.json` - Hook configuration mapping events to scripts
- `send_event.py` - Universal event sender script
- `hooks/` - Directory containing event-specific hook scripts
- `environment.env` - Environment variable configuration

## Usage

1. Ensure the observability server is running on port 4000
2. Set environment variables in `environment.env` if needed
3. Claude Code will automatically use these hooks when running in this directory

## Hook Scripts

- `pre_tool_use.py` - Validates tools before execution
- `post_tool_use.py` - Captures tool execution results
- `user_prompt_submit.py` - Captures user input
- `notification.py` - Captures agent notifications
- `stop.py` - Captures session completion
- `subagent_stop.py` - Captures subagent completion

## Configuration

Edit `settings.json` to customize hook behavior:
- Enable/disable specific hooks
- Modify timeouts and retry settings
- Configure environment variables
- Adjust security settings

## Troubleshooting

- Check that hook scripts are executable: `chmod +x hooks/*.py send_event.py`
- Verify server connectivity: `curl http://localhost:4000/events/filter-options`
- Check logs in Claude Code output for hook execution details
"""
        
        with open(readme_file, 'w') as f:
            f.write(readme_content)
        
        print(f"✓ Created README: {readme_file}")
    
    def verify_setup(self):
        """Verify the setup is correct"""
        print("Verifying setup...")
        
        required_files = [
            self.claude_dir / 'settings.json',
            self.claude_dir / 'send_event.py',
            self.hooks_dir / 'pre_tool_use.py',
            self.hooks_dir / 'post_tool_use.py',
        ]
        
        all_good = True
        for file_path in required_files:
            if file_path.exists():
                print(f"✓ {file_path}")
            else:
                print(f"✗ Missing: {file_path}")
                all_good = False
        
        if all_good:
            print("✅ Setup verification successful!")
        else:
            print("❌ Setup verification failed - some files are missing")
            return False
        
        return True
    
    def setup(self):
        """Run complete setup"""
        print("Setting up Event Capture Agent for Multi-Agent Observability System")
        print(f"Target directory: {self.target_dir}")
        print("-" * 60)
        
        self.create_directories()
        self.copy_hook_scripts()
        self.copy_settings()
        self.create_environment_file()
        self.create_readme()
        
        print("-" * 60)
        if self.verify_setup():
            print("🎉 Event Capture Agent setup completed successfully!")
            print(f"Claude Code projects in {self.target_dir} will now use observability hooks.")
            print("\nNext steps:")
            print("1. Start the observability server: cd ../data-processing && bun start")
            print("2. Run Claude Code in this directory")
            print("3. Check the dashboard for real-time agent monitoring")
        else:
            print("❌ Setup completed with errors. Please check the missing files.")
            return 1
        
        return 0

def main():
    parser = argparse.ArgumentParser(
        description="Setup Event Capture Agent for Claude Code observability"
    )
    
    parser.add_argument(
        '--target-dir',
        help='Target directory for Claude Code project (default: current directory)',
        default='.'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Overwrite existing files'
    )
    
    args = parser.parse_args()
    
    # Setup
    setup = EventCaptureSetup(args.target_dir)
    exit_code = setup.setup()
    
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
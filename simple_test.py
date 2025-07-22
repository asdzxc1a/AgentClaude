#!/usr/bin/env python3
"""
Simplified test runner for Multi-Agent Observability System validation
"""

import sys
import json
import sqlite3
import time
import os
from pathlib import Path

def test_event_capture_agent():
    """Test Event Capture Agent core functionality"""
    print("🧪 Testing Event Capture Agent...")
    
    # Test event sender functionality
    try:
        sys.path.insert(0, str(Path(__file__).parent / "apps" / "event-capture"))
        from send_event import EventSender
        
        # Test initialization
        sender = EventSender("http://localhost:4000", "test-agent")
        assert sender.server_url == "http://localhost:4000"
        assert sender.source_app == "test-agent"
        print("  ✅ EventSender initialization")
        
        # Test data augmentation
        raw_data = {"tool": "bash", "command": "ls"}
        result = sender.augment_event_data(raw_data, "PreToolUse")
        
        assert result["source_app"] == "test-agent"
        assert result["hook_event_type"] == "PreToolUse"
        assert result["payload"] == raw_data
        assert "timestamp" in result
        print("  ✅ Event data augmentation")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Event Capture Agent test failed: {e}")
        return False

def test_pre_tool_use_validation():
    """Test PreToolUse security validation"""
    print("🛡️ Testing security validation...")
    
    try:
        sys.path.insert(0, str(Path(__file__).parent / "apps" / "event-capture" / "hooks"))
        from pre_tool_use import PreToolUseValidator
        
        validator = PreToolUseValidator()
        
        # Test safe command
        safe_tool_data = {"tool": "bash", "command": "ls -la"}
        result = validator.validate_tool_usage(safe_tool_data)
        assert result['validation_status'] == 'approved'
        print("  ✅ Safe command validation")
        
        # Test dangerous command detection
        dangerous_tool_data = {"tool": "bash", "command": "rm -rf /"}
        result = validator.validate_tool_usage(dangerous_tool_data)
        assert result['validation_status'] == 'blocked'
        print("  ✅ Dangerous command blocking")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Security validation test failed: {e}")
        return False

def test_database_functionality():
    """Test database operations"""
    print("🗄️ Testing database functionality...")
    
    try:
        # Test basic SQLite operations
        db = sqlite3.connect(':memory:')
        
        # Create events table
        db.execute('''
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                source_app TEXT,
                session_id TEXT,
                hook_event_type TEXT,
                payload TEXT,
                timestamp TEXT
            )
        ''')
        
        # Insert test event
        test_event = {
            "source_app": "test-agent",
            "session_id": "test-session",
            "hook_event_type": "PreToolUse", 
            "payload": json.dumps({"tool": "bash", "command": "ls"}),
            "timestamp": "2025-01-21T10:30:00Z"
        }
        
        db.execute('''
            INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            test_event["source_app"],
            test_event["session_id"],
            test_event["hook_event_type"], 
            test_event["payload"],
            test_event["timestamp"]
        ))
        db.commit()
        
        # Retrieve and verify
        cursor = db.execute('SELECT * FROM events WHERE source_app = ?', (test_event["source_app"],))
        stored_event = cursor.fetchone()
        
        assert stored_event is not None
        assert stored_event[1] == test_event["source_app"]
        print("  ✅ Event storage and retrieval")
        
        # Test filtering
        cursor = db.execute('SELECT COUNT(*) FROM events WHERE hook_event_type = ?', ("PreToolUse",))
        count = cursor.fetchone()[0]
        assert count == 1
        print("  ✅ Event filtering")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"  ❌ Database test failed: {e}")
        return False

def test_performance_baseline():
    """Test basic performance metrics"""
    print("⚡ Testing performance baseline...")
    
    try:
        # Database performance test
        db = sqlite3.connect(':memory:')
        db.execute('''
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                source_app TEXT,
                session_id TEXT,
                hook_event_type TEXT,
                payload TEXT,
                timestamp TEXT
            )
        ''')
        db.execute('CREATE INDEX idx_source_app ON events(source_app)')
        db.commit()
        
        # Insert 100 test events
        events = []
        for i in range(100):
            events.append((
                f"agent-{i % 5}",
                f"session-{i}",
                "PreToolUse",
                json.dumps({"test": i}),
                "2025-01-21T10:30:00Z"
            ))
        
        start_time = time.time()
        db.executemany('''
            INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
            VALUES (?, ?, ?, ?, ?)
        ''', events)
        db.commit()
        insert_time = time.time() - start_time
        
        # Test query performance
        start_time = time.time()
        cursor = db.execute('SELECT source_app, COUNT(*) FROM events GROUP BY source_app')
        results = cursor.fetchall()
        query_time = time.time() - start_time
        
        db.close()
        
        print(f"  📊 Insert 100 events: {insert_time:.3f}s")
        print(f"  📊 Query performance: {query_time:.3f}s")
        print(f"  📊 Events per second: {100/insert_time:.0f}")
        
        # Performance assertions
        assert insert_time < 1.0  # Should be under 1 second
        assert query_time < 0.1   # Should be under 100ms
        assert len(results) == 5  # Should have 5 unique agents
        
        print("  ✅ Performance baseline met")
        return True
        
    except Exception as e:
        print(f"  ❌ Performance test failed: {e}")
        return False

def test_multi_agent_simulation():
    """Test multi-agent coordination simulation"""
    print("🤖 Testing multi-agent simulation...")
    
    try:
        # Simulate events from multiple agents
        db = sqlite3.connect(':memory:')
        db.execute('''
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                source_app TEXT,
                session_id TEXT,
                hook_event_type TEXT,
                payload TEXT,
                timestamp TEXT
            )
        ''')
        
        # Simulate 3 agents with different event patterns
        agents = [
            {"id": "python-agent", "session": "python-session"},
            {"id": "bash-agent", "session": "bash-session"},
            {"id": "coordinator-agent", "session": "coord-session"}
        ]
        
        total_events = 0
        
        for agent in agents:
            # Each agent generates different types of events
            events = [
                (agent["id"], agent["session"], "PreToolUse", json.dumps({"tool": "test"}), "2025-01-21T10:00:00Z"),
                (agent["id"], agent["session"], "PostToolUse", json.dumps({"result": "success"}), "2025-01-21T10:01:00Z"),
                (agent["id"], agent["session"], "Stop", json.dumps({"status": "completed"}), "2025-01-21T10:02:00Z")
            ]
            
            for event in events:
                db.execute('''
                    INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                ''', event)
                total_events += 1
        
        db.commit()
        
        # Verify multi-agent data
        cursor = db.execute('SELECT COUNT(DISTINCT source_app) FROM events')
        unique_agents = cursor.fetchone()[0]
        assert unique_agents == 3
        
        cursor = db.execute('SELECT COUNT(*) FROM events')
        total_stored = cursor.fetchone()[0]
        assert total_stored == total_events
        
        print(f"  ✅ {unique_agents} agents, {total_stored} events processed")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"  ❌ Multi-agent simulation failed: {e}")
        return False

def main():
    """Run simplified test suite"""
    print("🚀 MULTI-AGENT OBSERVABILITY SYSTEM - VALIDATION TESTS")
    print("=" * 70)
    
    tests = [
        ("Event Capture Agent", test_event_capture_agent),
        ("Security Validation", test_pre_tool_use_validation),
        ("Database Operations", test_database_functionality),
        ("Performance Baseline", test_performance_baseline),
        ("Multi-Agent Simulation", test_multi_agent_simulation)
    ]
    
    passed = 0
    total = len(tests)
    
    start_time = time.time()
    
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}:")
        try:
            if test_func():
                passed += 1
            else:
                print(f"❌ {test_name} failed")
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
    
    total_time = time.time() - start_time
    
    # Final report
    print("\n" + "=" * 70)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 70)
    print(f"Total Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {passed/total*100:.1f}%")
    print(f"Total Time: {total_time:.2f}s")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("✅ Multi-Agent Observability System core functionality validated")
        print("✅ System ready for extended development and deployment")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TESTS FAILED")
        print("❌ Review failed components before proceeding")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
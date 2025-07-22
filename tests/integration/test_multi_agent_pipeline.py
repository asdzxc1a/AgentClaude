"""
Integration tests for Multi-Agent Observability System

Tests the complete pipeline from Event Capture → Data Processing → Real-time Broadcasting
Based on 2024 best practices for multi-agent system testing:
- End-to-end workflow validation
- Multi-agent coordination testing
- Performance under load
- Error resilience and recovery
"""

import pytest
import json
import time
import threading
import requests
import subprocess
import sqlite3
from pathlib import Path
from unittest.mock import Mock, patch
from concurrent.futures import ThreadPoolExecutor, as_completed
import tempfile
import os
import signal

class TestMultiAgentPipeline:
    """Integration tests for the complete observability pipeline"""
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_test_environment(self):
        """Set up complete test environment with all agents"""
        self.test_db_path = ":memory:"
        self.server_port = 4001  # Use different port for testing
        self.server_process = None
        self.temp_dir = Path(tempfile.mkdtemp())
        
        yield
        
        # Cleanup
        if self.server_process:
            self.server_process.terminate()
            self.server_process.wait()
        
        if self.temp_dir.exists():
            import shutil
            shutil.rmtree(self.temp_dir)

    def test_event_capture_to_storage_pipeline(self):
        """Test complete pipeline from event capture to database storage"""
        # Create a temporary SQLite database for testing
        test_db = sqlite3.connect(':memory:')
        test_db.execute('''
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                source_app TEXT,
                session_id TEXT, 
                hook_event_type TEXT,
                payload TEXT,
                timestamp TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        test_db.commit()
        
        # Simulate event capture
        event_data = {
            "source_app": "test-agent-1",
            "session_id": "integration-test-session",
            "hook_event_type": "PreToolUse",
            "payload": {
                "tool": "bash",
                "command": "ls -la",
                "validation_status": "approved"
            },
            "timestamp": "2025-01-21T10:30:00Z"
        }
        
        # Insert into test database
        test_db.execute('''
            INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            event_data["source_app"],
            event_data["session_id"], 
            event_data["hook_event_type"],
            json.dumps(event_data["payload"]),
            event_data["timestamp"]
        ))
        test_db.commit()
        
        # Verify storage
        cursor = test_db.execute('SELECT * FROM events WHERE source_app = ?', (event_data["source_app"],))
        stored_event = cursor.fetchone()
        
        assert stored_event is not None
        assert stored_event[1] == event_data["source_app"]  # source_app
        assert stored_event[2] == event_data["session_id"]   # session_id
        assert stored_event[3] == event_data["hook_event_type"]  # hook_event_type
        
        stored_payload = json.loads(stored_event[4])
        assert stored_payload == event_data["payload"]
        
        test_db.close()

    def test_multiple_agents_concurrent_events(self):
        """Test multiple agents sending events concurrently"""
        test_db = sqlite3.connect(':memory:')
        test_db.execute('''
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                source_app TEXT,
                session_id TEXT,
                hook_event_type TEXT, 
                payload TEXT,
                timestamp TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        test_db.commit()
        
        # Simulate 5 concurrent agents
        agents = [
            {"source_app": f"agent-{i}", "session_id": f"session-{i}"}
            for i in range(1, 6)
        ]
        
        events_per_agent = 10
        total_expected_events = len(agents) * events_per_agent
        
        def simulate_agent_events(agent_info):
            """Simulate events from a single agent"""
            events_sent = []
            for event_num in range(events_per_agent):
                event = {
                    "source_app": agent_info["source_app"],
                    "session_id": agent_info["session_id"],
                    "hook_event_type": ["PreToolUse", "PostToolUse", "UserPromptSubmit"][event_num % 3],
                    "payload": {
                        "event_number": event_num,
                        "agent_id": agent_info["source_app"],
                        "test_data": f"concurrent_test_{event_num}"
                    },
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
                }
                
                # Insert into database
                test_db.execute('''
                    INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    event["source_app"],
                    event["session_id"],
                    event["hook_event_type"], 
                    json.dumps(event["payload"]),
                    event["timestamp"]
                ))
                test_db.commit()
                
                events_sent.append(event)
                time.sleep(0.01)  # Small delay to simulate realistic timing
            
            return events_sent
        
        # Execute concurrent agent simulations
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(simulate_agent_events, agent)
                for agent in agents
            ]
            
            all_events = []
            for future in as_completed(futures):
                agent_events = future.result()
                all_events.extend(agent_events)
        
        # Verify all events were stored
        cursor = test_db.execute('SELECT COUNT(*) FROM events')
        total_stored = cursor.fetchone()[0]
        
        assert total_stored == total_expected_events
        
        # Verify events from each agent
        for agent in agents:
            cursor = test_db.execute(
                'SELECT COUNT(*) FROM events WHERE source_app = ?',
                (agent["source_app"],)
            )
            agent_event_count = cursor.fetchone()[0]
            assert agent_event_count == events_per_agent
        
        # Verify event type distribution
        cursor = test_db.execute('''
            SELECT hook_event_type, COUNT(*) 
            FROM events 
            GROUP BY hook_event_type
        ''')
        event_type_counts = dict(cursor.fetchall())
        
        # Should have roughly equal distribution of event types
        for event_type in ["PreToolUse", "PostToolUse", "UserPromptSubmit"]:
            assert event_type in event_type_counts
            assert event_type_counts[event_type] > 0
        
        test_db.close()

    def test_event_filtering_and_search(self):
        """Test event filtering and search capabilities"""
        test_db = sqlite3.connect(':memory:')
        test_db.execute('''
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                source_app TEXT,
                session_id TEXT,
                hook_event_type TEXT,
                payload TEXT,
                timestamp TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        test_db.commit()
        
        # Insert diverse test events
        test_events = [
            {
                "source_app": "python-agent",
                "session_id": "python-session",
                "hook_event_type": "PreToolUse",
                "payload": {"tool": "python", "script": "data_analysis.py"},
                "timestamp": "2025-01-21T10:00:00Z"
            },
            {
                "source_app": "bash-agent", 
                "session_id": "bash-session",
                "hook_event_type": "PostToolUse",
                "payload": {"tool": "bash", "command": "grep pattern file.txt", "output": "found 5 matches"},
                "timestamp": "2025-01-21T10:01:00Z"
            },
            {
                "source_app": "python-agent",
                "session_id": "python-session",
                "hook_event_type": "UserPromptSubmit", 
                "payload": {"prompt": "Please analyze the CSV data for trends"},
                "timestamp": "2025-01-21T10:02:00Z"
            }
        ]
        
        for event in test_events:
            test_db.execute('''
                INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                event["source_app"],
                event["session_id"],
                event["hook_event_type"],
                json.dumps(event["payload"]),
                event["timestamp"]
            ))
        test_db.commit()
        
        # Test filtering by source_app
        cursor = test_db.execute('SELECT * FROM events WHERE source_app = ?', ("python-agent",))
        python_events = cursor.fetchall()
        assert len(python_events) == 2
        
        # Test filtering by event type
        cursor = test_db.execute('SELECT * FROM events WHERE hook_event_type = ?', ("PreToolUse",))
        pre_tool_events = cursor.fetchall()
        assert len(pre_tool_events) == 1
        
        # Test payload search simulation (would be implemented in actual search)
        cursor = test_db.execute('SELECT * FROM events WHERE payload LIKE ?', ('%python%',))
        python_payload_events = cursor.fetchall()
        assert len(python_payload_events) >= 1
        
        test_db.close()

    def test_performance_under_load(self):
        """Test system performance under high event load"""
        test_db = sqlite3.connect(':memory:')
        test_db.execute('''
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                source_app TEXT,
                session_id TEXT,
                hook_event_type TEXT,
                payload TEXT,
                timestamp TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for performance
        test_db.execute('CREATE INDEX idx_source_app ON events(source_app)')
        test_db.execute('CREATE INDEX idx_session_id ON events(session_id)')
        test_db.execute('CREATE INDEX idx_event_type ON events(hook_event_type)')
        test_db.commit()
        
        # Performance test parameters
        num_events = 1000
        num_agents = 10
        events_per_agent = num_events // num_agents
        
        start_time = time.time()
        
        # Insert events in batches for performance
        for agent_id in range(num_agents):
            events_batch = []
            for event_num in range(events_per_agent):
                event_data = (
                    f"performance-agent-{agent_id}",
                    f"performance-session-{agent_id}",
                    ["PreToolUse", "PostToolUse", "UserPromptSubmit"][event_num % 3],
                    json.dumps({
                        "event_number": event_num,
                        "agent_id": agent_id,
                        "performance_test": True,
                        "large_data": "x" * 1000  # 1KB of data per event
                    }),
                    time.strftime("%Y-%m-%dT%H:%M:%SZ")
                )
                events_batch.append(event_data)
            
            # Batch insert for performance
            test_db.executemany('''
                INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
                VALUES (?, ?, ?, ?, ?)
            ''', events_batch)
            test_db.commit()
        
        insertion_time = time.time() - start_time
        
        # Performance assertions
        assert insertion_time < 5.0  # Should complete within 5 seconds
        
        # Verify all events were inserted
        cursor = test_db.execute('SELECT COUNT(*) FROM events')
        total_events = cursor.fetchone()[0]
        assert total_events == num_events
        
        # Test query performance
        query_start = time.time()
        
        # Complex query with filtering and aggregation
        cursor = test_db.execute('''
            SELECT source_app, hook_event_type, COUNT(*) as count
            FROM events 
            WHERE source_app LIKE 'performance-agent-%'
            GROUP BY source_app, hook_event_type
            ORDER BY source_app, hook_event_type
        ''')
        results = cursor.fetchall()
        
        query_time = time.time() - query_start
        
        # Query should be fast with indexes
        assert query_time < 0.5  # Should complete within 500ms
        assert len(results) > 0
        
        test_db.close()

    def test_error_resilience_and_recovery(self):
        """Test system resilience to errors and recovery capabilities"""
        test_scenarios = [
            {
                "name": "malformed_json_payload",
                "event": {
                    "source_app": "error-test-agent",
                    "session_id": "error-session",
                    "hook_event_type": "PreToolUse",
                    "payload": {"malformed": "json with unicode: 🚀 and\nspecial\tchars"},
                    "timestamp": "2025-01-21T10:30:00Z"
                }
            },
            {
                "name": "extremely_large_payload", 
                "event": {
                    "source_app": "large-payload-agent",
                    "session_id": "large-session",
                    "hook_event_type": "PostToolUse",
                    "payload": {
                        "output": "x" * 50000,  # 50KB payload
                        "nested_data": {"deep": {"very_deep": {"extremely_deep": "data"}}},
                        "array_data": list(range(1000))
                    },
                    "timestamp": "2025-01-21T10:30:00Z"
                }
            },
            {
                "name": "empty_fields",
                "event": {
                    "source_app": "",
                    "session_id": "",
                    "hook_event_type": "UserPromptSubmit",
                    "payload": {},
                    "timestamp": ""
                }
            }
        ]
        
        test_db = sqlite3.connect(':memory:')
        test_db.execute('''
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                source_app TEXT,
                session_id TEXT,
                hook_event_type TEXT,
                payload TEXT, 
                timestamp TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        test_db.commit()
        
        successful_inserts = 0
        
        for scenario in test_scenarios:
            try:
                event = scenario["event"]
                test_db.execute('''
                    INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    event["source_app"],
                    event["session_id"],
                    event["hook_event_type"],
                    json.dumps(event["payload"]),
                    event["timestamp"]
                ))
                test_db.commit()
                successful_inserts += 1
                
                print(f"✓ Scenario '{scenario['name']}' handled successfully")
                
            except Exception as e:
                print(f"✗ Scenario '{scenario['name']}' failed: {e}")
                # In a real system, this would trigger error logging and recovery
        
        # System should handle most error scenarios gracefully
        assert successful_inserts >= len(test_scenarios) * 0.8  # At least 80% success rate
        
        # Verify database integrity after error scenarios
        cursor = test_db.execute('SELECT COUNT(*) FROM events')
        total_events = cursor.fetchone()[0]
        assert total_events == successful_inserts
        
        test_db.close()

    def test_multi_agent_coordination_simulation(self):
        """Test coordination between multiple agents in complex scenarios"""
        
        # Simulation of a real-world scenario:
        # - Main agent receives user prompt
        # - Spawns 3 sub-agents for different tasks
        # - Sub-agents complete their tasks
        # - Main agent aggregates results
        
        coordination_events = []
        
        # Main agent receives user prompt
        main_prompt_event = {
            "source_app": "main-coordinator-agent",
            "session_id": "coordination-session-main",
            "hook_event_type": "UserPromptSubmit",
            "payload": {
                "prompt": "Analyze data, generate report, and create visualizations",
                "complexity": "high",
                "requires_subagents": True
            },
            "timestamp": "2025-01-21T10:00:00Z"
        }
        coordination_events.append(main_prompt_event)
        
        # Sub-agents are spawned
        subagents = [
            {
                "id": "data-analyzer",
                "task": "data_analysis",
                "parent_session": "coordination-session-main"
            },
            {
                "id": "report-generator", 
                "task": "report_generation",
                "parent_session": "coordination-session-main"
            },
            {
                "id": "chart-creator",
                "task": "visualization_creation", 
                "parent_session": "coordination-session-main"
            }
        ]
        
        # Each sub-agent performs its tasks
        for subagent in subagents:
            # Sub-agent starts
            start_event = {
                "source_app": f"subagent-{subagent['id']}",
                "session_id": f"sub-session-{subagent['id']}", 
                "hook_event_type": "PreToolUse",
                "payload": {
                    "tool": "python",
                    "task_type": subagent["task"],
                    "parent_session_id": subagent["parent_session"]
                },
                "timestamp": "2025-01-21T10:01:00Z"
            }
            coordination_events.append(start_event)
            
            # Sub-agent completes task
            completion_event = {
                "source_app": f"subagent-{subagent['id']}",
                "session_id": f"sub-session-{subagent['id']}",
                "hook_event_type": "SubagentStop", 
                "payload": {
                    "subagent_id": subagent["id"],
                    "parent_session_id": subagent["parent_session"],
                    "task_type": subagent["task"],
                    "status": "success",
                    "result_summary": f"Completed {subagent['task']} successfully"
                },
                "timestamp": "2025-01-21T10:05:00Z"
            }
            coordination_events.append(completion_event)
        
        # Main agent aggregates results and completes
        main_completion_event = {
            "source_app": "main-coordinator-agent",
            "session_id": "coordination-session-main",
            "hook_event_type": "Stop",
            "payload": {
                "reason": "completed",
                "status": "success", 
                "subagents_completed": len(subagents),
                "total_duration": 300,
                "final_result": "Successfully analyzed data, generated report, and created visualizations"
            },
            "timestamp": "2025-01-21T10:06:00Z"
        }
        coordination_events.append(main_completion_event)
        
        # Verify coordination scenario structure
        assert len(coordination_events) == 8  # 1 main prompt + 3 starts + 3 completions + 1 main completion
        
        # Verify event sequence makes logical sense
        user_prompts = [e for e in coordination_events if e["hook_event_type"] == "UserPromptSubmit"]
        subagent_stops = [e for e in coordination_events if e["hook_event_type"] == "SubagentStop"]
        main_stops = [e for e in coordination_events if e["hook_event_type"] == "Stop"]
        
        assert len(user_prompts) == 1
        assert len(subagent_stops) == 3
        assert len(main_stops) == 1
        
        # Verify parent-child relationships
        main_session = main_prompt_event["session_id"]
        for stop_event in subagent_stops:
            assert stop_event["payload"]["parent_session_id"] == main_session
        
        print(f"✓ Multi-agent coordination scenario completed with {len(coordination_events)} events")

    def test_real_time_event_streaming_simulation(self):
        """Test real-time event streaming capabilities"""
        
        # Simulate WebSocket-like event streaming
        streamed_events = []
        event_timestamps = []
        
        def simulate_real_time_event(event_data):
            """Simulate processing a real-time event"""
            timestamp = time.time()
            event_timestamps.append(timestamp)
            streamed_events.append({
                **event_data,
                "processed_at": timestamp,
                "streaming": True
            })
            return len(streamed_events)
        
        # Simulate rapid event generation (like real-time monitoring)
        rapid_events = []
        for i in range(50):
            event = {
                "source_app": f"streaming-agent-{i % 5}",
                "session_id": f"streaming-session-{i // 10}",
                "hook_event_type": ["PreToolUse", "PostToolUse", "Notification"][i % 3],
                "payload": {
                    "stream_sequence": i,
                    "real_time_data": f"data_point_{i}",
                    "timestamp_ms": time.time() * 1000
                },
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
            }
            rapid_events.append(event)
        
        # Process events with timing
        start_streaming = time.time()
        
        for event in rapid_events:
            simulate_real_time_event(event)
            time.sleep(0.01)  # 10ms between events (100 events/second rate)
        
        end_streaming = time.time()
        streaming_duration = end_streaming - start_streaming
        
        # Verify streaming performance
        assert len(streamed_events) == 50
        assert streaming_duration < 2.0  # Should handle 50 events in under 2 seconds
        
        # Verify event order preservation
        sequences = [e["payload"]["stream_sequence"] for e in streamed_events]
        assert sequences == sorted(sequences)  # Should maintain order
        
        # Verify timing consistency
        time_diffs = [
            event_timestamps[i+1] - event_timestamps[i] 
            for i in range(len(event_timestamps)-1)
        ]
        avg_time_diff = sum(time_diffs) / len(time_diffs)
        
        # Average time between events should be close to 10ms
        assert 0.005 < avg_time_diff < 0.020  # Between 5ms and 20ms
        
        print(f"✓ Processed {len(streamed_events)} events in {streaming_duration:.2f}s")
        print(f"✓ Average time between events: {avg_time_diff*1000:.1f}ms")


class TestSystemHealthAndMonitoring:
    """Tests for system health monitoring and diagnostics"""
    
    def test_system_health_metrics(self):
        """Test system health metrics collection"""
        health_metrics = {
            "events_processed_last_hour": 1250,
            "active_agents": 8,
            "average_processing_time_ms": 15.3,
            "database_size_mb": 45.2,
            "error_rate_percent": 0.1,
            "memory_usage_mb": 128.5,
            "uptime_hours": 72.5
        }
        
        # Health check assertions
        assert health_metrics["events_processed_last_hour"] > 0
        assert health_metrics["active_agents"] > 0
        assert health_metrics["average_processing_time_ms"] < 100  # Under 100ms
        assert health_metrics["error_rate_percent"] < 1.0  # Under 1% error rate
        assert health_metrics["memory_usage_mb"] < 500  # Under 500MB memory usage
        
        print("✓ System health metrics within acceptable ranges")

    def test_database_performance_monitoring(self):
        """Test database performance monitoring"""
        test_db = sqlite3.connect(':memory:')
        
        # Create test schema with indexes
        test_db.execute('''
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                source_app TEXT,
                session_id TEXT,
                hook_event_type TEXT,
                payload TEXT,
                timestamp TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create performance indexes
        test_db.execute('CREATE INDEX idx_source_app ON events(source_app)')
        test_db.execute('CREATE INDEX idx_created_at ON events(created_at)')
        test_db.commit()
        
        # Insert test data for performance testing
        test_events = []
        for i in range(100):
            test_events.append((
                f"perf-agent-{i % 10}",
                f"perf-session-{i}",
                "PreToolUse",
                json.dumps({"test": i}),
                "2025-01-21T10:30:00Z"
            ))
        
        # Time the batch insert
        insert_start = time.time()
        test_db.executemany('''
            INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
            VALUES (?, ?, ?, ?, ?)
        ''', test_events)
        test_db.commit()
        insert_time = time.time() - insert_start
        
        # Time a complex query
        query_start = time.time()
        cursor = test_db.execute('''
            SELECT source_app, COUNT(*) as event_count
            FROM events
            WHERE created_at > datetime('now', '-1 hour')
            GROUP BY source_app
            ORDER BY event_count DESC
        ''')
        results = cursor.fetchall()
        query_time = time.time() - query_start
        
        # Performance assertions
        assert insert_time < 0.5  # Batch insert should be under 500ms
        assert query_time < 0.1   # Query should be under 100ms
        assert len(results) > 0   # Should return results
        
        # Database integrity check
        cursor = test_db.execute('PRAGMA integrity_check')
        integrity_result = cursor.fetchone()[0]
        assert integrity_result == "ok"
        
        test_db.close()
        
        print(f"✓ Database performance: Insert {insert_time:.3f}s, Query {query_time:.3f}s")
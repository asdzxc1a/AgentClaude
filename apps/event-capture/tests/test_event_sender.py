"""
Unit tests for EventSender class
Tests HTTP event sending with comprehensive error handling and performance validation
"""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock
import requests
from requests.exceptions import ConnectionError, Timeout, HTTPError, RequestException
import time

# Import the module we're testing
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from send_event import EventSender, HookEventType


class TestEventSender:
    """Test suite for EventSender class"""
    
    def test_initialization_with_defaults(self):
        """Test EventSender initialization with default values"""
        sender = EventSender()
        
        assert sender.server_url == "http://localhost:4000"
        assert sender.source_app == "claude-agent-observability"
        assert sender.timeout == 10
        assert sender.max_retries == 3
        assert sender.retry_delay == 1.0

    def test_initialization_with_custom_values(self):
        """Test EventSender initialization with custom values"""
        sender = EventSender(
            server_url="https://api.example.com",
            source_app="custom-agent",
            timeout=30,
            max_retries=5,
            retry_delay=2.0
        )
        
        assert sender.server_url == "https://api.example.com"
        assert sender.source_app == "custom-agent"
        assert sender.timeout == 30
        assert sender.max_retries == 5
        assert sender.retry_delay == 2.0

    def test_initialization_from_environment(self, monkeypatch):
        """Test EventSender initialization from environment variables"""
        monkeypatch.setenv("OBSERVABILITY_SERVER_URL", "http://env.example.com")
        monkeypatch.setenv("SOURCE_APP", "env-agent")
        
        sender = EventSender()
        
        assert sender.server_url == "http://env.example.com"
        assert sender.source_app == "env-agent"

    @patch('requests.post')
    def test_send_event_success(self, mock_post):
        """Test successful event sending"""
        # Setup mock response
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"success": True, "id": 123}
        mock_post.return_value = mock_response
        
        sender = EventSender()
        event_data = {
            "tool": "bash",
            "command": "ls -la",
            "parameters": {"working_dir": "/tmp"}
        }
        
        result = sender.send_event("PreToolUse", event_data)
        
        assert result is True
        mock_post.assert_called_once()
        
        # Verify the request was made correctly
        call_args = mock_post.call_args
        assert call_args[0][0] == "http://localhost:4000/events"  # First positional arg is URL
        assert call_args[1]['timeout'] == 10
        
        # Check the JSON payload
        sent_data = json.loads(call_args[1]['data'])
        assert sent_data['hook_event_type'] == "PreToolUse"
        assert sent_data['source_app'] == "claude-agent-observability"
        assert sent_data['payload'] == event_data
        assert 'timestamp' in sent_data
        assert 'session_id' in sent_data

    @patch('requests.post')
    def test_send_event_with_chat_data(self, mock_post):
        """Test sending event with chat conversation data"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response
        
        sender = EventSender()
        event_data = {"tool": "python", "script": "hello.py"}
        chat_data = [
            {"role": "user", "content": "Run hello.py"},
            {"role": "assistant", "content": "I'll run the Python script for you."}
        ]
        
        result = sender.send_event("PreToolUse", event_data, chat_data=chat_data)
        
        assert result is True
        
        # Check that chat data was included
        sent_data = json.loads(mock_post.call_args[1]['data'])
        assert sent_data['chat'] == chat_data

    @patch('requests.post')
    def test_send_event_with_summary(self, mock_post):
        """Test sending event with AI-generated summary"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response
        
        sender = EventSender()
        event_data = {"tool": "git", "command": "status"}
        summary = "User requested git repository status check"
        
        result = sender.send_event("PreToolUse", event_data, summary=summary)
        
        assert result is True
        
        # Check that summary was included
        sent_data = json.loads(mock_post.call_args[1]['data'])
        assert sent_data['summary'] == summary

    @patch('requests.post')
    def test_send_event_server_error_without_retry(self, mock_post):
        """Test handling of server errors"""
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_post.return_value = mock_response
        
        sender = EventSender(max_retries=0)  # No retries for this test
        result = sender.send_event("PreToolUse", {"test": "data"})
        
        assert result is False

    @patch('requests.post')
    def test_send_event_connection_error_with_retry(self, mock_post):
        """Test retry logic on connection errors"""
        # First two calls fail, third succeeds
        mock_post.side_effect = [
            ConnectionError("Connection failed"),
            Timeout("Request timed out"),
            Mock(status_code=201, json=lambda: {"success": True})
        ]
        
        sender = EventSender(max_retries=3, retry_delay=0.1)  # Fast retry for testing
        result = sender.send_event("PreToolUse", {"test": "data"})
        
        assert result is True
        assert mock_post.call_count == 3

    @patch('requests.post')
    def test_send_event_max_retries_exceeded(self, mock_post):
        """Test behavior when max retries are exceeded"""
        mock_post.side_effect = ConnectionError("Connection failed")
        
        sender = EventSender(max_retries=2, retry_delay=0.1)
        result = sender.send_event("PreToolUse", {"test": "data"})
        
        assert result is False
        assert mock_post.call_count == 3  # Initial + 2 retries

    @patch('requests.post')
    @patch('time.sleep')
    def test_retry_delay_timing(self, mock_sleep, mock_post):
        """Test that retry delays are properly implemented"""
        mock_post.side_effect = [
            ConnectionError("Connection failed"),
            Mock(status_code=201, json=lambda: {"success": True})
        ]
        
        sender = EventSender(max_retries=1, retry_delay=2.5)
        result = sender.send_event("PreToolUse", {"test": "data"})
        
        assert result is True
        mock_sleep.assert_called_once_with(2.5)

    def test_generate_session_id_uniqueness(self):
        """Test that session IDs are unique"""
        sender = EventSender()
        
        session_ids = set()
        for _ in range(1000):
            session_id = sender._generate_session_id()
            assert session_id not in session_ids
            session_ids.add(session_id)
            assert len(session_id) > 10  # Reasonable length check

    def test_generate_timestamp_format(self):
        """Test timestamp generation format"""
        sender = EventSender()
        timestamp = sender._generate_timestamp()
        
        # Should be valid ISO format
        from datetime import datetime
        parsed_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        assert parsed_time is not None

    @patch('requests.post')
    def test_send_event_invalid_event_type(self, mock_post):
        """Test handling of invalid event types"""
        sender = EventSender()
        
        with pytest.raises(ValueError, match="Invalid hook event type"):
            sender.send_event("InvalidEventType", {"test": "data"})

    @patch('requests.post')  
    def test_send_event_large_payload(self, mock_post):
        """Test sending large payloads"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response
        
        sender = EventSender()
        large_payload = {
            "large_data": "x" * 100000,  # 100KB of data
            "nested_data": {"array": list(range(1000))}
        }
        
        result = sender.send_event("PreToolUse", large_payload)
        
        assert result is True
        
        # Verify large payload was sent
        sent_data = json.loads(mock_post.call_args[1]['data'])
        assert len(sent_data['payload']['large_data']) == 100000

    @patch('requests.post')
    def test_send_event_unicode_data(self, mock_post):
        """Test sending events with Unicode data"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response
        
        sender = EventSender()
        unicode_data = {
            "text": "Hello 世界! 🚀 ñáéíóú",
            "emoji": "🔥💯✨🎉🚀",
            "accents": "àáâãäåæçèéêë"
        }
        
        result = sender.send_event("UserPromptSubmit", unicode_data)
        
        assert result is True
        
        # Verify Unicode data was preserved
        sent_data = json.loads(mock_post.call_args[1]['data'])
        assert sent_data['payload'] == unicode_data

    @patch('requests.post')
    def test_send_event_json_serialization_error(self, mock_post):
        """Test handling of JSON serialization errors"""
        sender = EventSender()
        
        # Create data that can't be JSON serialized
        class NonSerializable:
            pass
        
        bad_data = {"object": NonSerializable()}
        
        result = sender.send_event("PreToolUse", bad_data)
        
        assert result is False
        mock_post.assert_not_called()

    @pytest.mark.performance
    @patch('requests.post')
    def test_send_event_performance(self, mock_post):
        """Test event sending performance"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response
        
        sender = EventSender()
        event_data = {"tool": "test", "performance": "benchmark"}
        
        # Measure time for 100 event sends
        start_time = time.time()
        for _ in range(100):
            sender.send_event("PreToolUse", event_data)
        end_time = time.time()
        
        # Should complete in reasonable time (less than 1 second for mocked calls)
        total_time = end_time - start_time
        assert total_time < 1.0
        
        # All events should be sent
        assert mock_post.call_count == 100

    def test_event_type_validation(self):
        """Test validation of all valid event types"""
        sender = EventSender()
        
        valid_types = [
            "PreToolUse", "PostToolUse", "UserPromptSubmit",
            "Notification", "Stop", "SubagentStop"
        ]
        
        for event_type in valid_types:
            # Should not raise exception
            sender._validate_event_type(event_type)
        
        # Test invalid type
        with pytest.raises(ValueError):
            sender._validate_event_type("InvalidType")

    @patch('requests.post')
    def test_send_event_with_custom_headers(self, mock_post):
        """Test that custom headers are sent correctly"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"success": True}
        mock_post.return_value = mock_response
        
        sender = EventSender()
        result = sender.send_event("PreToolUse", {"test": "data"})
        
        assert result is True
        
        # Check that correct headers were sent
        call_kwargs = mock_post.call_args[1]
        headers = call_kwargs['headers']
        assert headers['Content-Type'] == 'application/json'
        assert 'User-Agent' in headers
        assert 'claude-agent' in headers['User-Agent'].lower()

    @patch('requests.post')
    def test_network_timeout_handling(self, mock_post):
        """Test handling of network timeouts"""
        mock_post.side_effect = Timeout("Request timed out")
        
        sender = EventSender(max_retries=1)
        result = sender.send_event("PreToolUse", {"test": "data"})
        
        assert result is False
        assert mock_post.call_count == 2  # Initial + 1 retry

    @patch('requests.post')
    def test_http_error_codes(self, mock_post):
        """Test handling of various HTTP error codes"""
        error_codes = [400, 401, 403, 404, 500, 502, 503]
        
        for error_code in error_codes:
            mock_response = Mock()
            mock_response.status_code = error_code
            mock_response.text = f"Error {error_code}"
            mock_post.return_value = mock_response
            
            sender = EventSender(max_retries=0)
            result = sender.send_event("PreToolUse", {"test": f"error_{error_code}"})
            
            assert result is False

    @patch('requests.post')
    def test_malformed_response_handling(self, mock_post):
        """Test handling of malformed server responses"""
        mock_response = Mock()
        mock_response.status_code = 201
        mock_response.json.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)
        mock_post.return_value = mock_response
        
        sender = EventSender()
        result = sender.send_event("PreToolUse", {"test": "data"})
        
        # Should still return True for successful status code
        assert result is True
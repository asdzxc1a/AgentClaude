"""
Unit tests for the universal event sender

Tests based on 2024 best practices for multi-agent system testing:
- Communication and coordination testing
- Load and performance testing  
- Error handling and resilience testing
"""

import pytest
import json
import time
from unittest.mock import Mock, patch, call
import requests
from send_event import EventSender

class TestEventSender:
    """Test suite for EventSender class"""
    
    def test_initialization_with_defaults(self):
        """Test EventSender initialization with default values"""
        sender = EventSender()
        assert sender.server_url == "http://localhost:4000"
        assert sender.source_app == "claude-agent"
        assert sender.session_id is not None
    
    def test_initialization_with_custom_values(self):
        """Test EventSender initialization with custom values"""
        sender = EventSender(
            server_url="http://custom-server:8080",
            source_app="custom-agent"
        )
        assert sender.server_url == "http://custom-server:8080"
        assert sender.source_app == "custom-agent"
    
    def test_initialization_with_environment_variables(self, mock_environment_variables):
        """Test initialization using environment variables"""
        sender = EventSender()
        assert sender.server_url == "http://localhost:4000"
        assert sender.source_app == "test-agent"

    def test_read_stdin_data_valid_json(self, mock_stdin):
        """Test reading valid JSON from stdin"""
        test_data = {"tool": "bash", "command": "ls"}
        mock_stdin(test_data)
        
        sender = EventSender()
        result = sender.read_stdin_data()
        
        assert result == test_data

    def test_read_stdin_data_invalid_json(self):
        """Test handling invalid JSON from stdin"""
        with patch('sys.stdin') as mock_stdin_obj:
            mock_stdin_obj.read.return_value = "invalid json {"
            
            sender = EventSender()
            result = sender.read_stdin_data()
            
            assert result == {}

    def test_read_stdin_data_empty_input(self):
        """Test handling empty stdin input"""
        with patch('sys.stdin') as mock_stdin_obj:
            mock_stdin_obj.read.return_value = ""
            
            sender = EventSender()
            result = sender.read_stdin_data()
            
            assert result == {}

    def test_read_chat_file_valid_jsonl(self, mock_chat_file):
        """Test reading valid JSONL chat file"""
        sender = EventSender()
        result = sender.read_chat_file(str(mock_chat_file))
        
        assert isinstance(result, list)
        assert len(result) == 3
        assert result[0]["role"] == "user"
        assert result[1]["role"] == "assistant"

    def test_read_chat_file_nonexistent(self, temp_directory):
        """Test handling nonexistent chat file"""
        nonexistent_file = temp_directory / "nonexistent.jsonl"
        
        sender = EventSender()
        result = sender.read_chat_file(str(nonexistent_file))
        
        assert result is None

    def test_generate_summary_basic(self):
        """Test basic summary generation"""
        sender = EventSender()
        event_data = {
            "hook_event_type": "PreToolUse",
            "payload": {
                "tool": "bash",
                "command": "ls -la"
            }
        }
        
        summary = sender.generate_summary(event_data)
        
        assert summary is not None
        assert "PreToolUse" in summary
        assert "bash" in summary

    def test_augment_event_data_basic(self):
        """Test basic event data augmentation"""
        sender = EventSender()
        raw_data = {"tool": "bash", "command": "ls"}
        
        result = sender.augment_event_data(raw_data, "PreToolUse")
        
        assert result["source_app"] == sender.source_app
        assert result["session_id"] == sender.session_id
        assert result["hook_event_type"] == "PreToolUse"
        assert result["payload"] == raw_data
        assert "timestamp" in result

    def test_augment_event_data_with_chat(self, mock_chat_file):
        """Test event data augmentation with chat file"""
        sender = EventSender()
        raw_data = {"tool": "bash"}
        
        result = sender.augment_event_data(
            raw_data, "PreToolUse", add_chat=True, chat_file=str(mock_chat_file)
        )
        
        assert "chat" in result
        assert len(result["chat"]) == 3

    def test_augment_event_data_with_summary(self):
        """Test event data augmentation with AI summary"""
        sender = EventSender()
        raw_data = {"tool": "bash", "command": "ls"}
        
        result = sender.augment_event_data(
            raw_data, "PreToolUse", summarize=True
        )
        
        assert "summary" in result
        assert result["summary"] is not None

    def test_send_event_success(self, mock_server):
        """Test successful event sending"""
        sender = EventSender()
        event_data = {
            "source_app": "test",
            "session_id": "123",
            "hook_event_type": "PreToolUse",
            "payload": {"test": "data"}
        }
        
        result = sender.send_event(event_data)
        
        assert result is True
        mock_server.assert_called_once()

    def test_send_event_server_error(self):
        """Test handling server error responses"""
        with patch('requests.post') as mock_post:
            mock_response = Mock()
            mock_response.status_code = 500
            mock_response.text = "Internal Server Error"
            mock_post.return_value = mock_response
            
            sender = EventSender()
            event_data = {"test": "data"}
            
            result = sender.send_event(event_data)
            
            assert result is False

    def test_send_event_network_timeout(self):
        """Test handling network timeout"""
        with patch('requests.post', side_effect=requests.exceptions.Timeout):
            sender = EventSender()
            event_data = {"test": "data"}
            
            result = sender.send_event(event_data)
            
            assert result is False

    def test_send_event_connection_error(self):
        """Test handling connection errors"""
        with patch('requests.post', side_effect=requests.exceptions.ConnectionError):
            sender = EventSender()
            event_data = {"test": "data"}
            
            result = sender.send_event(event_data)
            
            assert result is False

    def test_send_event_retry_logic(self):
        """Test retry logic on failures"""
        with patch('requests.post', side_effect=requests.exceptions.Timeout):
            with patch('time.sleep') as mock_sleep:
                sender = EventSender()
                event_data = {"test": "data"}
                
                result = sender.send_event(event_data)
                
                assert result is False
                # Should retry 3 times total, so 2 sleep calls between retries
                assert mock_sleep.call_count == 2

    def test_handle_event_graceful_return(self, mock_stdin, mock_server):
        """Test that handle_event always returns 0 (graceful degradation)"""
        test_data = {"tool": "bash", "command": "ls"}
        mock_stdin(test_data)
        
        sender = EventSender()
        result = sender.handle_event("PreToolUse")
        
        # Should always return 0 to not break Claude agent execution
        assert result == 0

    def test_handle_event_with_failed_sending(self, mock_stdin):
        """Test handle_event when sending fails"""
        test_data = {"tool": "bash", "command": "ls"}
        mock_stdin(test_data)
        
        with patch('requests.post', side_effect=requests.exceptions.ConnectionError):
            sender = EventSender()
            result = sender.handle_event("PreToolUse")
            
            # Should still return 0 even when sending fails
            assert result == 0


class TestEventSenderIntegration:
    """Integration tests for EventSender"""
    
    def test_full_pipeline_pretooluse(self, mock_stdin, mock_server, sample_hook_data):
        """Test full pipeline for PreToolUse event"""
        test_data = sample_hook_data["PreToolUse"]
        mock_stdin(test_data)
        
        sender = EventSender()
        result = sender.handle_event("PreToolUse", summarize=True)
        
        assert result == 0
        mock_server.assert_called_once()
        
        # Verify the sent data structure
        call_args = mock_server.call_args
        sent_data = call_args[1]['json']
        
        assert sent_data['hook_event_type'] == "PreToolUse"
        assert sent_data['payload'] == test_data
        assert 'timestamp' in sent_data
        assert 'summary' in sent_data

    def test_full_pipeline_with_chat(self, mock_stdin, mock_server, mock_chat_file, sample_hook_data):
        """Test full pipeline with chat file inclusion"""
        test_data = sample_hook_data["UserPromptSubmit"]
        mock_stdin(test_data)
        
        sender = EventSender()
        result = sender.handle_event(
            "UserPromptSubmit", 
            add_chat=True, 
            chat_file=str(mock_chat_file)
        )
        
        assert result == 0
        
        # Verify chat data was included
        call_args = mock_server.call_args
        sent_data = call_args[1]['json']
        
        assert 'chat' in sent_data
        assert len(sent_data['chat']) == 3


class TestEventSenderPerformance:
    """Performance tests for EventSender"""
    
    def test_event_processing_speed(self, mock_stdin, mock_server):
        """Test event processing performance"""
        test_data = {"tool": "bash", "command": "ls"}
        mock_stdin(test_data)
        
        sender = EventSender()
        
        start_time = time.time()
        sender.handle_event("PreToolUse")
        end_time = time.time()
        
        processing_time = end_time - start_time
        
        # Should process event in under 100ms
        assert processing_time < 0.1

    def test_concurrent_event_handling(self, mock_server):
        """Test handling multiple events concurrently (simulation)"""
        import threading
        
        results = []
        
        def send_event(event_id):
            with patch('sys.stdin') as mock_stdin_obj:
                mock_stdin_obj.read.return_value = json.dumps({
                    "tool": f"test-{event_id}",
                    "command": f"command-{event_id}"
                })
                
                sender = EventSender()
                result = sender.handle_event("PreToolUse")
                results.append(result)
        
        # Simulate 10 concurrent events
        threads = []
        for i in range(10):
            thread = threading.Thread(target=send_event, args=(i,))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        # All should complete successfully
        assert len(results) == 10
        assert all(result == 0 for result in results)
        
        # Should have made 10 server calls
        assert mock_server.call_count == 10
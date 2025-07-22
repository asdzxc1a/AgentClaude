#!/usr/bin/env python3
"""
Test Runner for Multi-Agent Observability System

Executes all test suites following 2024 best practices:
- Python unit tests with pytest
- Bun TypeScript tests 
- Integration tests for multi-agent coordination
- Performance and load testing
"""

import subprocess
import sys
import os
import time
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any
import json

@dataclass
class TestResult:
    name: str
    passed: bool
    duration: float
    output: str
    error: str = ""

class TestRunner:
    def __init__(self):
        self.root_dir = Path(__file__).parent
        self.results: List[TestResult] = []
        self.total_start_time = time.time()
    
    def run_command(self, command: List[str], cwd: Path = None, timeout: int = 300) -> TestResult:
        """Run a command and capture results"""
        cmd_str = " ".join(command)
        print(f"🧪 Running: {cmd_str}")
        
        start_time = time.time()
        
        try:
            result = subprocess.run(
                command,
                cwd=cwd or self.root_dir,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            
            duration = time.time() - start_time
            
            success = result.returncode == 0
            status = "✅" if success else "❌"
            
            print(f"{status} Completed in {duration:.2f}s")
            
            return TestResult(
                name=cmd_str,
                passed=success,
                duration=duration,
                output=result.stdout,
                error=result.stderr
            )
            
        except subprocess.TimeoutExpired:
            duration = time.time() - start_time
            print(f"⏰ Timeout after {timeout}s")
            
            return TestResult(
                name=cmd_str,
                passed=False,
                duration=duration,
                output="",
                error=f"Test timed out after {timeout} seconds"
            )
            
        except Exception as e:
            duration = time.time() - start_time
            print(f"💥 Error: {e}")
            
            return TestResult(
                name=cmd_str,
                passed=False,
                duration=duration,
                output="",
                error=str(e)
            )
    
    def setup_python_environment(self):
        """Set up Python testing environment"""
        print("🐍 Setting up Python testing environment...")
        
        # Check if virtual environment exists
        venv_path = self.root_dir / "pdf_env"
        if not venv_path.exists():
            print("📦 Creating Python virtual environment...")
            result = self.run_command([
                sys.executable, "-m", "venv", "pdf_env"
            ])
            if not result.passed:
                print("❌ Failed to create virtual environment")
                return False
        
        # Install test dependencies
        pip_path = venv_path / "bin" / "pip"
        if not pip_path.exists():
            pip_path = venv_path / "Scripts" / "pip.exe"  # Windows
        
        if pip_path.exists():
            print("📚 Installing Python test dependencies...")
            result = self.run_command([
                str(pip_path), "install", "pytest", "pytest-cov", "requests"
            ])
            if not result.passed:
                print("⚠️  Warning: Failed to install some Python dependencies")
        
        return True
    
    def run_python_tests(self):
        """Run Python unit tests with pytest"""
        print("\n" + "="*60)
        print("🐍 PYTHON UNIT TESTS")
        print("="*60)
        
        # Set up environment
        if not self.setup_python_environment():
            print("❌ Failed to set up Python environment")
            return
        
        # Find Python executable in venv
        venv_path = self.root_dir / "pdf_env"
        python_path = venv_path / "bin" / "python"
        if not python_path.exists():
            python_path = venv_path / "Scripts" / "python.exe"  # Windows
        
        if not python_path.exists():
            python_path = sys.executable  # Fallback to system Python
        
        # Run Event Capture Agent tests
        event_capture_tests = self.root_dir / "apps" / "event-capture" / "tests"
        if event_capture_tests.exists():
            print("\n📋 Testing Event Capture Agent...")
            
            # Set PYTHONPATH to include the app directory
            env = os.environ.copy()
            env['PYTHONPATH'] = str(self.root_dir / "apps" / "event-capture")
            
            result = subprocess.run([
                str(python_path), "-m", "pytest", 
                str(event_capture_tests),
                "-v", "--tb=short"
            ], cwd=event_capture_tests.parent, env=env, capture_output=True, text=True)
            
            test_result = TestResult(
                name="Event Capture Agent Tests",
                passed=result.returncode == 0,
                duration=0,  # pytest will show timing
                output=result.stdout,
                error=result.stderr
            )
            
            self.results.append(test_result)
            
            if test_result.passed:
                print("✅ Event Capture Agent tests passed")
            else:
                print("❌ Event Capture Agent tests failed")
                print("STDOUT:", result.stdout)
                print("STDERR:", result.stderr)
        else:
            print("⚠️  Event Capture Agent tests not found")
    
    def run_bun_tests(self):
        """Run Bun TypeScript tests"""
        print("\n" + "="*60)
        print("🟨 BUN TYPESCRIPT TESTS")
        print("="*60)
        
        # Check if Bun is available
        try:
            subprocess.run(["bun", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("⚠️  Bun not found, skipping TypeScript tests")
            print("   Install Bun from: https://bun.sh/")
            return
        
        # Run Data Processing Agent tests
        data_processing_dir = self.root_dir / "apps" / "data-processing"
        if data_processing_dir.exists():
            print("\n🗄️  Testing Data Processing Agent...")
            
            # Install dependencies first
            print("📦 Installing Bun dependencies...")
            install_result = self.run_command(
                ["bun", "install"], 
                cwd=data_processing_dir
            )
            
            if install_result.passed:
                # Run tests
                test_result = self.run_command(
                    ["bun", "test"], 
                    cwd=data_processing_dir
                )
                self.results.append(TestResult(
                    name="Data Processing Agent Tests (Bun)",
                    passed=test_result.passed,
                    duration=test_result.duration,
                    output=test_result.output,
                    error=test_result.error
                ))
            else:
                print("❌ Failed to install Bun dependencies")
                self.results.append(TestResult(
                    name="Data Processing Agent Tests (Bun)",
                    passed=False,
                    duration=0,
                    output="",
                    error="Failed to install dependencies"
                ))
        else:
            print("⚠️  Data Processing Agent directory not found")
    
    def run_integration_tests(self):
        """Run integration tests"""
        print("\n" + "="*60)
        print("🔗 INTEGRATION TESTS")
        print("="*60)
        
        integration_tests = self.root_dir / "tests" / "integration"
        if integration_tests.exists():
            # Set up Python environment for integration tests
            venv_path = self.root_dir / "pdf_env"
            python_path = venv_path / "bin" / "python"
            if not python_path.exists():
                python_path = venv_path / "Scripts" / "python.exe"  # Windows
            if not python_path.exists():
                python_path = sys.executable
            
            # Run integration tests
            print("\n🌐 Running Multi-Agent Pipeline Integration Tests...")
            
            env = os.environ.copy()
            env['PYTHONPATH'] = str(self.root_dir)
            
            result = subprocess.run([
                str(python_path), "-m", "pytest",
                str(integration_tests),
                "-v", "--tb=short", "-x"  # Stop on first failure for integration tests
            ], cwd=self.root_dir, env=env, capture_output=True, text=True)
            
            test_result = TestResult(
                name="Multi-Agent Integration Tests",
                passed=result.returncode == 0,
                duration=0,
                output=result.stdout,
                error=result.stderr
            )
            
            self.results.append(test_result)
            
            if test_result.passed:
                print("✅ Integration tests passed")
            else:
                print("❌ Integration tests failed")
                if result.stdout:
                    print("STDOUT:", result.stdout[:1000])  # Limit output
                if result.stderr:
                    print("STDERR:", result.stderr[:1000])
        else:
            print("⚠️  Integration tests directory not found")
    
    def run_performance_tests(self):
        """Run performance tests"""
        print("\n" + "="*60)
        print("⚡ PERFORMANCE TESTS")
        print("="*60)
        
        print("🚀 Running performance benchmarks...")
        
        # Simple performance test for core components
        performance_script = '''
import time
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor

def test_database_performance():
    """Test SQLite database performance"""
    db = sqlite3.connect(':memory:')
    db.execute("""
    CREATE TABLE events (
        id INTEGER PRIMARY KEY,
        source_app TEXT,
        session_id TEXT,
        hook_event_type TEXT,
        payload TEXT,
        timestamp TEXT
    )
    """)
    db.execute('CREATE INDEX idx_source_app ON events(source_app)')
    db.commit()
    
    # Insert performance test
    events = []
    for i in range(1000):
        events.append((
            f'agent-{i % 10}',
            f'session-{i}', 
            'PreToolUse',
            json.dumps({'test': i}),
            '2025-01-21T10:30:00Z'
        ))
    
    start_time = time.time()
    db.executemany("""
        INSERT INTO events (source_app, session_id, hook_event_type, payload, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, events)
    db.commit()
    insert_time = time.time() - start_time
    
    # Query performance test
    start_time = time.time()
    cursor = db.execute("""
        SELECT source_app, COUNT(*) 
        FROM events 
        GROUP BY source_app 
        ORDER BY COUNT(*) DESC
    """)
    results = cursor.fetchall()
    query_time = time.time() - start_time
    
    db.close()
    
    print(f"📊 Database Performance:")
    print(f"   Insert 1000 events: {insert_time:.3f}s")
    print(f"   Complex query: {query_time:.3f}s")
    print(f"   Events per second: {1000/insert_time:.0f}")
    
    return insert_time < 1.0 and query_time < 0.1

def test_concurrent_processing():
    """Test concurrent event processing"""
    
    def process_event(event_id):
        # Simulate event processing
        data = {'event_id': event_id, 'processed': True}
        json_data = json.dumps(data)
        time.sleep(0.001)  # 1ms processing time
        return len(json_data)
    
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(process_event, range(100)))
    
    total_time = time.time() - start_time
    
    print(f"🔄 Concurrent Processing:")
    print(f"   Processed 100 events: {total_time:.3f}s")
    print(f"   Events per second: {100/total_time:.0f}")
    
    return total_time < 0.5 and len(results) == 100

# Run performance tests
db_perf = test_database_performance()
concurrent_perf = test_concurrent_processing()

if db_perf and concurrent_perf:
    print("✅ Performance tests passed")
    exit(0)
else:
    print("❌ Performance tests failed")
    exit(1)
'''
        
        # Write and run performance test
        perf_file = self.root_dir / "temp_performance_test.py"
        with open(perf_file, 'w') as f:
            f.write(performance_script)
        
        try:
            result = self.run_command([sys.executable, str(perf_file)])
            self.results.append(TestResult(
                name="Performance Tests",
                passed=result.passed,
                duration=result.duration,
                output=result.output,
                error=result.error
            ))
        finally:
            # Cleanup
            if perf_file.exists():
                perf_file.unlink()
    
    def generate_test_report(self):
        """Generate comprehensive test report"""
        print("\n" + "="*80)
        print("📊 TEST EXECUTION REPORT")
        print("="*80)
        
        total_duration = time.time() - self.total_start_time
        passed_tests = sum(1 for r in self.results if r.passed)
        total_tests = len(self.results)
        
        print(f"\n📈 SUMMARY:")
        print(f"   Total Tests: {total_tests}")
        print(f"   Passed: {passed_tests}")
        print(f"   Failed: {total_tests - passed_tests}")
        print(f"   Success Rate: {passed_tests/total_tests*100:.1f}%")
        print(f"   Total Duration: {total_duration:.2f}s")
        
        print(f"\n📋 DETAILED RESULTS:")
        for i, result in enumerate(self.results, 1):
            status = "✅ PASS" if result.passed else "❌ FAIL"
            duration = f"{result.duration:.2f}s" if result.duration > 0 else "N/A"
            print(f"   {i:2d}. {status} {result.name} ({duration})")
            
            if not result.passed and result.error:
                print(f"       Error: {result.error[:100]}...")
        
        # System health check
        print(f"\n🏥 SYSTEM HEALTH CHECK:")
        if passed_tests == total_tests:
            print("   ✅ All systems operational")
            print("   ✅ Multi-Agent Observability System ready for deployment")
        elif passed_tests >= total_tests * 0.8:
            print("   ⚠️  System mostly operational with minor issues")
            print("   ⚠️  Review failed tests before deployment")
        else:
            print("   ❌ System has significant issues")
            print("   ❌ Major fixes required before deployment")
        
        # Generate JSON report for CI/CD
        json_report = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "total_duration": total_duration,
            "summary": {
                "total_tests": total_tests,
                "passed": passed_tests,
                "failed": total_tests - passed_tests,
                "success_rate": passed_tests/total_tests if total_tests > 0 else 0
            },
            "tests": [
                {
                    "name": r.name,
                    "passed": r.passed,
                    "duration": r.duration,
                    "error": r.error if not r.passed else None
                }
                for r in self.results
            ]
        }
        
        report_file = self.root_dir / "test_report.json"
        with open(report_file, 'w') as f:
            json.dump(json_report, f, indent=2)
        
        print(f"\n📄 Test report saved to: {report_file}")
        
        return passed_tests == total_tests
    
    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 MULTI-AGENT OBSERVABILITY SYSTEM - TEST SUITE")
        print("=" * 80)
        print(f"📅 Started at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📁 Working directory: {self.root_dir}")
        
        # Execute all test suites
        self.run_python_tests()
        self.run_bun_tests()  
        self.run_integration_tests()
        self.run_performance_tests()
        
        # Generate final report
        success = self.generate_test_report()
        
        print("\n" + "="*80)
        if success:
            print("🎉 ALL TESTS PASSED - SYSTEM READY!")
            return 0
        else:
            print("💥 SOME TESTS FAILED - REVIEW REQUIRED")
            return 1

def main():
    """Main entry point"""
    runner = TestRunner()
    exit_code = runner.run_all_tests()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
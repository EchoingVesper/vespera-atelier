#!/usr/bin/env python3
"""
V2 Task Tree Template System Test

Tests the complete V1 to V2 meta-PRP conversion using the template system.
Validates that V1 patterns are preserved while adding V2 hook automation.
"""

import sys
import asyncio
import tempfile
import shutil
import yaml
from pathlib import Path
from typing import Dict, Any

# Add the parent directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from templates.core.manager import TemplateManager
from hooks import HookEngine, HookRegistry


class V2TaskTreeTemplateSystemTester:
    """Test V1 to V2 meta-PRP conversion via template system"""
    
    def __init__(self):
        self.test_dir = None
        self.template_manager = None
        self.test_results = []
    
    async def setup(self):
        """Set up test environment"""
        print("🔧 Setting up V2 task tree template system test...")
        
        # Create temporary test directory
        self.test_dir = Path(tempfile.mkdtemp(prefix="v2_task_tree_test_"))
        print(f"📁 Test directory: {self.test_dir}")
        
        # Initialize template manager
        self.template_manager = TemplateManager()
        
        print("✅ Test environment setup complete")
    
    async def cleanup(self):
        """Clean up test environment"""
        print("🧹 Cleaning up test environment...")
        
        if self.test_dir and self.test_dir.exists():
            shutil.rmtree(self.test_dir)
        
        print("✅ Cleanup complete")
    
    async def run_all_tests(self):
        """Run comprehensive V2 task tree template tests"""
        print("🚀 Starting V2 task tree template system tests...")
        print("=" * 70)
        
        try:
            await self.setup()
            
            # Test template system
            await self.test_template_discovery()
            await self.test_simple_project_generation()
            await self.test_complex_project_generation()
            await self.test_hook_integration()
            await self.test_executive_dysfunction_support()
            await self.test_v1_to_v2_migration_patterns()
            
            # Report results
            await self._report_results()
            
        finally:
            await self.cleanup()
    
    async def test_template_discovery(self):
        """Test template discovery and validation"""
        print("\n📋 Testing Template Discovery...")
        
        try:
            # Discover V2 task tree templates
            templates = self.template_manager.list_templates()
            v2_templates = [t for t in templates if 'v2-task-trees' in str(t['path'])]
            
            assert len(v2_templates) > 0, "No V2 task tree templates found"
            
            # Find meta-development-project template
            meta_template = None
            for template in v2_templates:
                if 'meta-development-project' in str(template['path']):
                    meta_template = template
                    break
            
            assert meta_template is not None, "meta-development-project template not found"
            
            # Validate template structure
            template_path = Path(meta_template['path'])
            required_files = ['copier.yml', 'README.md.jinja', 'hooks-config.yml.jinja']
            
            for required_file in required_files:
                file_path = template_path / required_file
                assert file_path.exists(), f"Required template file missing: {required_file}"
            
            self._record_test_result("Template Discovery", True, 
                                   f"Found {len(v2_templates)} V2 templates, meta-development-project validated")
            print("✅ Template Discovery tests passed")
            
        except Exception as e:
            self._record_test_result("Template Discovery", False, str(e))
            print(f"❌ Template Discovery tests failed: {e}")
    
    async def test_simple_project_generation(self):
        """Test simple project task tree generation"""
        print("\n🏗️ Testing Simple Project Generation...")
        
        try:
            # Template variables for simple project
            variables = {
                'project_name': 'simple-auth-system',
                'project_description': 'Simple user authentication system',
                'complexity_level': 'simple',
                'primary_technologies': 'Python, FastAPI, SQLite',
                'target_roles': 'developer, tester',
                'enable_git_hooks': True,
                'enable_testing_hooks': True,
                'enable_documentation_hooks': False,
                'enable_security_hooks': True,
                'include_research_phase': True,
                'include_design_phase': True,
                'include_implementation_phase': True,
                'include_validation_phase': False,
                'use_feature_branch': True,
                'preserve_executive_dysfunction_support': True
            }
            
            # Generate project
            output_dir = self.test_dir / "simple_project"
            success = self.template_manager.create_from_template(
                template_name="meta-development-project",
                output_path=output_dir,
                variables=variables
            )
            
            assert success, "Project generation failed"
            
            # Validate generated files
            expected_files = [
                "simple-auth-system-task-tree.yml",
                "hooks-config.yml", 
                "README.md"
            ]
            
            for expected_file in expected_files:
                file_path = output_dir / expected_file
                assert file_path.exists(), f"Expected generated file missing: {expected_file}"
            
            # Validate task tree structure
            task_tree_file = output_dir / "simple-auth-system-task-tree.yml"
            with open(task_tree_file, 'r') as f:
                task_tree = yaml.safe_load(f)
            
            assert task_tree['root_task']['id'] == 'simple-auth-system-root', "Root task ID incorrect"
            assert len(task_tree['task_hierarchy']) >= 3, "Insufficient task hierarchy depth"
            
            # Validate executive dysfunction support
            assert task_tree['executive_dysfunction_support']['pre_structured_tasks'], \
                   "Executive dysfunction support not preserved"
            
            self._record_test_result("Simple Project Generation", True, 
                                   "Successfully generated simple project with executive dysfunction support")
            print("✅ Simple Project Generation tests passed")
            
        except Exception as e:
            self._record_test_result("Simple Project Generation", False, str(e))
            print(f"❌ Simple Project Generation tests failed: {e}")
    
    async def test_complex_project_generation(self):
        """Test complex project with all features enabled"""
        print("\n🏗️ Testing Complex Project Generation...")
        
        try:
            # Template variables for complex project (mirrors V1 comprehensive meta-PRP)
            variables = {
                'project_name': 'enterprise-dashboard-v2',
                'project_description': 'Enterprise analytics dashboard with real-time data processing',
                'complexity_level': 'comprehensive',
                'primary_technologies': 'Python, FastAPI, React, PostgreSQL, Redis, Docker',
                'target_roles': 'architect, developer, frontend_developer, tester, security_auditor, technical_writer',
                'enable_git_hooks': True,
                'enable_testing_hooks': True,
                'enable_documentation_hooks': True,
                'enable_security_hooks': True,
                'include_research_phase': True,
                'include_design_phase': True,
                'include_implementation_phase': True,
                'include_validation_phase': True,
                'use_feature_branch': True,
                'max_task_depth': 4,
                'hook_reminder_frequency': 'detailed',
                'preserve_executive_dysfunction_support': True
            }
            
            # Generate complex project
            output_dir = self.test_dir / "complex_project"
            success = self.template_manager.create_from_template(
                template_name="meta-development-project",
                output_path=output_dir,
                variables=variables
            )
            
            assert success, "Complex project generation failed"
            
            # Validate comprehensive task tree
            task_tree_file = output_dir / "enterprise-dashboard-v2-task-tree.yml"
            with open(task_tree_file, 'r') as f:
                task_tree = yaml.safe_load(f)
            
            # Should have all 4 phases
            phases = [task for task in task_tree['task_hierarchy'] 
                     if task['parent_id'] == 'enterprise-dashboard-v2-root']
            assert len(phases) >= 4, f"Expected 4+ phases, got {len(phases)}"
            
            # Validate V1 meta-PRP pattern preservation
            migration_notes = task_tree.get('migration_notes', '')
            assert 'V1 meta-PRP patterns' in migration_notes, "V1 migration notes missing"
            assert 'Executive dysfunction support' in migration_notes, "Executive dysfunction notes missing"
            
            # Validate hook integration
            hooks_file = output_dir / "hooks-config.yml"
            with open(hooks_file, 'r') as f:
                hooks_config = yaml.safe_load(f)
            
            # Should have multiple hook types enabled
            hook_types = set()
            for hook in hooks_config['hooks']:
                for action in hook['actions']:
                    hook_types.add(action['type'])
            
            assert 'PROGRAMMATIC' in hook_types, "Programmatic hooks missing"
            
            self._record_test_result("Complex Project Generation", True,
                                   f"Generated comprehensive project with {len(phases)} phases and hook automation")
            print("✅ Complex Project Generation tests passed")
            
        except Exception as e:
            self._record_test_result("Complex Project Generation", False, str(e))
            print(f"❌ Complex Project Generation tests failed: {e}")
    
    async def test_hook_integration(self):
        """Test hook system integration in generated projects"""
        print("\n🎣 Testing Hook Integration...")
        
        try:
            # Generate project with comprehensive hooks
            variables = {
                'project_name': 'hook-integration-test',
                'project_description': 'Test project for hook integration',
                'complexity_level': 'moderate',
                'enable_git_hooks': True,
                'enable_testing_hooks': True,
                'enable_security_hooks': True,
                'enable_documentation_hooks': True,
                'hook_reminder_frequency': 'detailed'
            }
            
            output_dir = self.test_dir / "hook_integration_test"
            success = self.template_manager.create_from_template(
                template_name="meta-development-project",
                output_path=output_dir,
                variables=variables
            )
            
            assert success, "Hook integration project generation failed"
            
            # Load and validate hooks configuration
            hooks_file = output_dir / "hooks-config.yml"
            with open(hooks_file, 'r') as f:
                hooks_config = yaml.safe_load(f)
            
            # Validate hook structure
            assert 'hooks' in hooks_config, "Hooks section missing from config"
            assert len(hooks_config['hooks']) > 0, "No hooks defined"
            
            # Validate V1 agent replacement patterns
            agent_replacements = []
            for hook in hooks_config['hooks']:
                for action in hook['actions']:
                    if 'replacement_for' in action:
                        agent_replacements.append(action['replacement_for'])
            
            assert len(agent_replacements) > 0, "No V1 agent replacements found"
            
            # Check for key V1 agent types being replaced
            expected_replacements = [
                'V1 git_operations_agent',
                'V1 testing_implementation_agent',
                'V1 security_validation_agent'
            ]
            
            found_replacements = []
            for replacement in agent_replacements:
                for expected in expected_replacements:
                    if expected in replacement:
                        found_replacements.append(expected)
            
            assert len(found_replacements) >= 2, f"Insufficient V1 agent replacements: {found_replacements}"
            
            # Validate hook priorities
            priorities = []
            for hook in hooks_config['hooks']:
                if 'priority' in hook:
                    priorities.append(hook['priority'])
            
            assert 'CRITICAL' in priorities, "Critical priority hooks missing"
            assert 'HIGH' in priorities, "High priority hooks missing"
            
            self._record_test_result("Hook Integration", True,
                                   f"Validated {len(hooks_config['hooks'])} hooks with V1 agent replacements")
            print("✅ Hook Integration tests passed")
            
        except Exception as e:
            self._record_test_result("Hook Integration", False, str(e))
            print(f"❌ Hook Integration tests failed: {e}")
    
    async def test_executive_dysfunction_support(self):
        """Test preservation of V1 executive dysfunction support patterns"""
        print("\n🧠 Testing Executive Dysfunction Support...")
        
        try:
            # Generate project with executive dysfunction support enabled
            variables = {
                'project_name': 'dysfunction-support-test',
                'project_description': 'Test executive dysfunction support patterns',
                'complexity_level': 'comprehensive',
                'preserve_executive_dysfunction_support': True,
                'max_task_depth': 3,
                'hook_reminder_frequency': 'detailed'
            }
            
            output_dir = self.test_dir / "dysfunction_support_test"
            success = self.template_manager.create_from_template(
                template_name="meta-development-project",
                output_path=output_dir,
                variables=variables
            )
            
            assert success, "Executive dysfunction support project generation failed"
            
            # Load task tree and validate support patterns
            task_tree_file = output_dir / "dysfunction-support-test-task-tree.yml"
            with open(task_tree_file, 'r') as f:
                task_tree = yaml.safe_load(f)
            
            # Validate executive dysfunction support metadata
            ed_support = task_tree.get('executive_dysfunction_support', {})
            assert ed_support.get('pre_structured_tasks'), "Pre-structured tasks not enabled"
            assert ed_support.get('clear_numbering'), "Clear numbering not enabled"
            assert ed_support.get('decision_reduction'), "Decision reduction not documented"
            
            # Validate task structure supports executive dysfunction patterns
            root_task = task_tree.get('root_task', {})
            assert 'Pre-structured task breakdown eliminates decision paralysis' in root_task.get('description', ''),\
                   "Executive dysfunction support not mentioned in root task"
            
            # Validate numbered task progression
            tasks = task_tree.get('task_hierarchy', [])
            has_ordered_tasks = any(task.get('order') is not None for task in tasks)
            assert has_ordered_tasks, "Tasks missing order numbers for clear progression"
            
            # Validate hook-based automation for decision reduction
            hooks_file = output_dir / "hooks-config.yml" 
            with open(hooks_file, 'r') as f:
                hooks_config = yaml.safe_load(f)
            
            engine_config = hooks_config.get('engine_config', {})
            ed_hook_support = engine_config.get('executive_dysfunction_support', {})
            assert ed_hook_support.get('enable_automated_reminders'), "Automated reminders not enabled"
            assert ed_hook_support.get('enable_decision_reduction'), "Hook decision reduction not enabled"
            
            self._record_test_result("Executive Dysfunction Support", True,
                                   "All V1 executive dysfunction patterns preserved in V2")
            print("✅ Executive Dysfunction Support tests passed")
            
        except Exception as e:
            self._record_test_result("Executive Dysfunction Support", False, str(e))
            print(f"❌ Executive Dysfunction Support tests failed: {e}")
    
    async def test_v1_to_v2_migration_patterns(self):
        """Test V1 to V2 migration pattern preservation"""
        print("\n🔄 Testing V1 to V2 Migration Patterns...")
        
        try:
            # Generate project to test migration patterns
            variables = {
                'project_name': 'migration-pattern-test',
                'project_description': 'Test V1 to V2 migration pattern preservation',
                'complexity_level': 'comprehensive',
                'include_research_phase': True,
                'include_design_phase': True,
                'include_implementation_phase': True,
                'include_validation_phase': True
            }
            
            output_dir = self.test_dir / "migration_test"
            success = self.template_manager.create_from_template(
                template_name="meta-development-project",
                output_path=output_dir,
                variables=variables
            )
            
            assert success, "Migration pattern test project generation failed"
            
            # Load and analyze generated files for V1 pattern preservation
            task_tree_file = output_dir / "migration-pattern-test-task-tree.yml"
            with open(task_tree_file, 'r') as f:
                task_tree = yaml.safe_load(f)
            
            # Validate V1 multi-phase approach preservation
            phases = task_tree.get('task_hierarchy', [])
            phase_names = [task.get('title', '') for task in phases if task.get('parent_id') == 'migration-pattern-test-root']
            
            expected_phases = ['Research', 'Design', 'Implementation', 'Validation']
            found_phases = []
            for expected in expected_phases:
                if any(expected.lower() in name.lower() for name in phase_names):
                    found_phases.append(expected)
            
            assert len(found_phases) >= 3, f"V1 multi-phase approach not preserved: {found_phases}"
            
            # Validate systematic approach integration
            research_phase = next((task for task in phases if 'research' in task.get('title', '').lower()), None)
            assert research_phase is not None, "Research phase missing"
            
            research_desc = research_phase.get('description', '')
            assert 'systematic methodology' in research_desc.lower(), "V1 systematic methodology not preserved"
            assert 'research-first' in research_desc.lower(), "V1 research-first approach not preserved"
            
            # Validate hook integration awareness
            hooks_file = output_dir / "hooks-config.yml"
            with open(hooks_file, 'r') as f:
                hooks_config = yaml.safe_load(f)
            
            migration_summary = hooks_config.get('migration_summary', '')
            assert 'V1 Agent Type' in migration_summary, "V1 to V2 agent mapping not documented"
            assert 'V2 Hook Replacement' in migration_summary, "V2 hook replacements not documented"
            
            # Validate V1 pattern preservation checklist
            v1_patterns = [
                'Executive dysfunction support',
                'Systematic approach', 
                'Hook-based problem prevention',
                'Multi-phase workflow coordination'
            ]
            
            found_patterns = []
            for pattern in v1_patterns:
                if pattern.lower() in migration_summary.lower():
                    found_patterns.append(pattern)
            
            assert len(found_patterns) >= 3, f"V1 patterns not adequately preserved: {found_patterns}"
            
            self._record_test_result("V1 to V2 Migration Patterns", True,
                                   f"Preserved {len(found_patterns)}/4 key V1 patterns with {len(found_phases)} phases")
            print("✅ V1 to V2 Migration Patterns tests passed")
            
        except Exception as e:
            self._record_test_result("V1 to V2 Migration Patterns", False, str(e))
            print(f"❌ V1 to V2 Migration Patterns tests failed: {e}")
    
    def _record_test_result(self, test_name: str, success: bool, details: str):
        """Record test result"""
        self.test_results.append({
            "test_name": test_name,
            "success": success,
            "details": details,
            "timestamp": asyncio.get_event_loop().time()
        })
    
    async def _report_results(self):
        """Report test results"""
        print("\n" + "=" * 70)
        print("📊 V2 TASK TREE TEMPLATE SYSTEM TEST RESULTS")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  • {result['test_name']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"  • {result['test_name']}: {result['details']}")
        
        print("\n" + "=" * 70)
        if failed_tests == 0:
            print("🎉 ALL V2 TASK TREE TEMPLATE TESTS PASSED!")
            print("✅ V1 to V2 migration patterns successfully validated")
            print("✅ Executive dysfunction support patterns preserved")
            print("✅ Hook system integration working correctly") 
            print("✅ Template system generating valid task trees")
        else:
            print(f"⚠️  {failed_tests} TEST(S) FAILED")
        print("=" * 70)


async def main():
    """Run V2 task tree template system tests"""
    tester = V2TaskTreeTemplateSystemTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
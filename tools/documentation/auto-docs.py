#!/usr/bin/env python3
"""
Vespera Atelier Documentation Automation

Automatically maintains and validates documentation across the monorepo.
Handles markdown validation, link checking, content updates, and generation.
"""

import asyncio
import json
import re
import subprocess
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Set, Tuple
import argparse
import logging
import sys
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DocumentationManager:
    """Manages documentation maintenance and validation."""
    
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self.docs_config = self.load_docs_config()
        self.cache_file = repo_root / ".docs-cache.json"
        self.cache = self.load_cache()
    
    def load_docs_config(self) -> Dict[str, Any]:
        """Load documentation configuration."""
        config_file = self.repo_root / "docs-config.json"
        
        if config_file.exists():
            try:
                with open(config_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError) as e:
                logger.error(f"Failed to load docs config: {e}")
                return self.get_default_config()
        else:
            config = self.get_default_config()
            self.save_docs_config(config)
            return config
    
    def get_default_config(self) -> Dict[str, Any]:
        """Get default documentation configuration."""
        return {
            "docs_paths": [
                "README.md",
                "docs/",
                "packages/vespera-scriptorium/README.md",
                "packages/vespera-scriptorium/CLAUDE.md",
                "packages/vespera-scriptorium/docs/",
                "vespera-utilities/README.md",
                "plugins/Obsidian/Vespera-Scriptorium/README.md",
                "plugins/Obsidian/Vespera-Scriptorium/docs/"
            ],
            "ignore_patterns": [
                "node_modules/**",
                ".git/**",
                "**/__pycache__/**",
                "**/dist/**",
                "**/build/**",
                "**/*.pyc"
            ],
            "link_check": {
                "enabled": True,
                "timeout": 10,
                "retry_count": 3,
                "check_external": True,
                "cache_duration_hours": 24
            },
            "markdown_lint": {
                "enabled": True,
                "config_file": ".markdownlint.json",
                "auto_fix": True
            },
            "auto_update": {
                "enabled": True,
                "update_timestamps": True,
                "update_toc": True,
                "update_badges": True
            },
            "generation": {
                "api_docs": True,
                "changelog": True,
                "index_pages": True
            }
        }
    
    def save_docs_config(self, config: Dict[str, Any]):
        """Save documentation configuration."""
        config_file = self.repo_root / "docs-config.json"
        try:
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
        except IOError as e:
            logger.error(f"Failed to save docs config: {e}")
    
    def load_cache(self) -> Dict[str, Any]:
        """Load documentation cache."""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return {}
        return {}
    
    def save_cache(self):
        """Save documentation cache."""
        try:
            with open(self.cache_file, 'w') as f:
                json.dump(self.cache, f, indent=2)
        except IOError as e:
            logger.error(f"Failed to save cache: {e}")
    
    def find_markdown_files(self) -> List[Path]:
        """Find all markdown files in configured paths."""
        markdown_files = []
        ignore_patterns = self.docs_config.get('ignore_patterns', [])
        
        for docs_path in self.docs_config.get('docs_paths', []):
            path = self.repo_root / docs_path
            
            if path.is_file() and path.suffix == '.md':
                if not any(path.match(pattern) for pattern in ignore_patterns):
                    markdown_files.append(path)
            elif path.is_dir():
                for md_file in path.rglob('*.md'):
                    if not any(md_file.match(pattern) for pattern in ignore_patterns):
                        markdown_files.append(md_file)
        
        return sorted(set(markdown_files))
    
    def validate_markdown(self, files: List[Path] = None) -> Dict[str, Any]:
        """Validate markdown files using markdownlint."""
        if files is None:
            files = self.find_markdown_files()
        
        lint_config = self.docs_config.get('markdown_lint', {})
        if not lint_config.get('enabled', True):
            return {'status': 'skipped', 'files_checked': 0}
        
        config_file = lint_config.get('config_file', '.markdownlint.json')
        config_path = self.repo_root / config_file
        
        # Create default config if it doesn't exist
        if not config_path.exists():
            default_config = {
                "MD013": {"line_length": 120},
                "MD041": False,  # Allow first line to not be h1
                "MD033": False,  # Allow inline HTML
                "MD034": False,  # Allow bare URLs
                "MD036": False   # Allow emphasis for headers
            }
            with open(config_path, 'w') as f:
                json.dump(default_config, f, indent=2)
        
        results = {
            'status': 'completed',
            'files_checked': len(files),
            'files_with_issues': 0,
            'total_issues': 0,
            'issues': {}
        }
        
        for md_file in files:
            try:
                # Run markdownlint on the file
                cmd = f"markdownlint --config {config_path} --json {md_file}"
                result = subprocess.run(
                    cmd, shell=True, capture_output=True, text=True, timeout=30
                )
                
                if result.stdout.strip():
                    try:
                        file_issues = json.loads(result.stdout)
                        if file_issues:
                            results['files_with_issues'] += 1
                            results['total_issues'] += len(file_issues)
                            results['issues'][str(md_file)] = file_issues
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse markdownlint output for {md_file}")
            
            except subprocess.TimeoutExpired:
                logger.error(f"Markdownlint timeout for {md_file}")
            except Exception as e:
                logger.error(f"Error linting {md_file}: {e}")
        
        return results
    
    def check_links(self, files: List[Path] = None, check_external: bool = None) -> Dict[str, Any]:
        """Check all links in markdown files."""
        if files is None:
            files = self.find_markdown_files()
        
        link_config = self.docs_config.get('link_check', {})
        if not link_config.get('enabled', True):
            return {'status': 'skipped', 'files_checked': 0}
        
        if check_external is None:
            check_external = link_config.get('check_external', True)
        
        results = {
            'status': 'completed',
            'files_checked': len(files),
            'total_links': 0,
            'broken_links': 0,
            'issues': {}
        }
        
        all_files = set()
        for root, dirs, files_in_dir in self.repo_root.rglob('*'):
            if '.git' not in str(root) and 'node_modules' not in str(root):
                for file in files_in_dir:
                    all_files.add(str((root / file).relative_to(self.repo_root)))
        
        for md_file in files:
            try:
                with open(md_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Extract all links
                links = re.findall(r'\[.*?\]\(([^)]+)\)', content)
                results['total_links'] += len(links)
                
                broken = []
                for link in links:
                    # Skip anchors and email links
                    if link.startswith('#') or link.startswith('mailto:'):
                        continue
                    
                    # Check external links
                    if link.startswith('http'):
                        if check_external:
                            if not self.check_external_link(link):
                                broken.append(link)
                        continue
                    
                    # Check internal links
                    if not self.check_internal_link(link, md_file, all_files):
                        broken.append(link)
                
                if broken:
                    results['broken_links'] += len(broken)
                    results['issues'][str(md_file)] = broken
            
            except Exception as e:
                logger.error(f"Error checking links in {md_file}: {e}")
        
        return results
    
    def check_internal_link(self, link: str, source_file: Path, all_files: Set[str]) -> bool:
        """Check if an internal link is valid."""
        try:
            # Handle relative paths
            if link.startswith('./') or not link.startswith('/'):
                target_path = (source_file.parent / link).resolve()
            else:
                target_path = (self.repo_root / link.lstrip('/')).resolve()
            
            # Check if target exists
            if target_path.exists():
                return True
            
            # Check relative to repo root
            relative_path = str(target_path.relative_to(self.repo_root))
            return relative_path in all_files
        
        except Exception:
            return False
    
    def check_external_link(self, url: str) -> bool:
        """Check if an external link is accessible."""
        # Use cache to avoid repeated checks
        cache_key = f"link_{hashlib.md5(url.encode()).hexdigest()}"
        cache_duration = self.docs_config.get('link_check', {}).get('cache_duration_hours', 24)
        
        if cache_key in self.cache:
            cached_time = datetime.fromisoformat(self.cache[cache_key]['timestamp'])
            if datetime.now() - cached_time < timedelta(hours=cache_duration):
                return self.cache[cache_key]['accessible']
        
        # Check the link
        try:
            import requests
            response = requests.head(url, timeout=10, allow_redirects=True)
            accessible = response.status_code < 400
        except Exception:
            accessible = False
        
        # Cache the result
        self.cache[cache_key] = {
            'timestamp': datetime.now().isoformat(),
            'accessible': accessible
        }
        
        return accessible
    
    def update_documentation(self, files: List[Path] = None) -> Dict[str, Any]:
        """Update documentation with automated content."""
        if files is None:
            files = self.find_markdown_files()
        
        update_config = self.docs_config.get('auto_update', {})
        if not update_config.get('enabled', True):
            return {'status': 'skipped', 'files_updated': 0}
        
        results = {
            'status': 'completed',
            'files_updated': 0,
            'updates': {}
        }
        
        for md_file in files:
            try:
                with open(md_file, 'r', encoding='utf-8') as f:
                    original_content = f.read()
                
                updated_content = original_content
                file_updates = []
                
                # Update timestamps
                if update_config.get('update_timestamps', True):
                    if 'Last updated:' in updated_content:
                        updated_content = re.sub(
                            r'Last updated: [\d-]+',
                            f'Last updated: {datetime.now().strftime("%Y-%m-%d")}',
                            updated_content
                        )
                        file_updates.append('timestamp')
                
                # Update table of contents
                if update_config.get('update_toc', True):
                    updated_content = self.update_table_of_contents(updated_content)
                    if updated_content != original_content:
                        file_updates.append('toc')
                
                # Update badges
                if update_config.get('update_badges', True):
                    updated_content = self.update_badges(updated_content, md_file)
                    if updated_content != original_content and 'toc' not in file_updates:
                        file_updates.append('badges')
                
                # Write back if changed
                if updated_content != original_content:
                    with open(md_file, 'w', encoding='utf-8') as f:
                        f.write(updated_content)
                    
                    results['files_updated'] += 1
                    results['updates'][str(md_file)] = file_updates
            
            except Exception as e:
                logger.error(f"Error updating {md_file}: {e}")
        
        return results
    
    def update_table_of_contents(self, content: str) -> str:
        """Update table of contents in markdown content."""
        # Look for TOC markers
        toc_pattern = r'<!-- TOC START -->(.*?)<!-- TOC END -->'
        
        if '<!-- TOC START -->' not in content:
            return content
        
        # Extract headers
        headers = re.findall(r'^(#{1,6})\s+(.+)$', content, re.MULTILINE)
        
        if not headers:
            return content
        
        # Generate TOC
        toc_lines = []
        for level, title in headers:
            # Skip TOC section itself
            if 'table of contents' in title.lower():
                continue
            
            indent = '  ' * (len(level) - 1)
            anchor = title.lower().replace(' ', '-').replace('/', '').replace('?', '').replace('!', '')
            anchor = re.sub(r'[^\w\-]', '', anchor)
            toc_lines.append(f"{indent}- [{title}](#{anchor})")
        
        new_toc = '\n'.join(toc_lines)
        
        # Replace existing TOC
        return re.sub(
            toc_pattern,
            f'<!-- TOC START -->\n{new_toc}\n<!-- TOC END -->',
            content,
            flags=re.DOTALL
        )
    
    def update_badges(self, content: str, md_file: Path) -> str:
        """Update status badges in markdown content."""
        # This is a simple implementation - in practice, you'd want more sophisticated badge updating
        current_date = datetime.now().strftime("%Y-%m-%d")
        
        # Update "last updated" badges
        content = re.sub(
            r'!\[Last Updated\]\([^)]*\)',
            f'![Last Updated](https://img.shields.io/badge/Last%20Updated-{current_date}-blue)',
            content
        )
        
        return content
    
    def generate_index_pages(self) -> Dict[str, Any]:
        """Generate index pages for documentation directories."""
        generation_config = self.docs_config.get('generation', {})
        if not generation_config.get('index_pages', True):
            return {'status': 'skipped', 'pages_generated': 0}
        
        results = {
            'status': 'completed',
            'pages_generated': 0,
            'generated': []
        }
        
        # Find documentation directories without index files
        for docs_path in self.docs_config.get('docs_paths', []):
            path = self.repo_root / docs_path
            
            if path.is_dir() and not (path / 'README.md').exists() and not (path / 'index.md').exists():
                # Generate index page
                index_content = self.generate_directory_index(path)
                index_file = path / 'README.md'
                
                try:
                    with open(index_file, 'w', encoding='utf-8') as f:
                        f.write(index_content)
                    
                    results['pages_generated'] += 1
                    results['generated'].append(str(index_file))
                
                except Exception as e:
                    logger.error(f"Error generating index for {path}: {e}")
        
        return results
    
    def generate_directory_index(self, directory: Path) -> str:
        """Generate index content for a documentation directory."""
        dir_name = directory.name
        relative_path = directory.relative_to(self.repo_root)
        
        content = f"# {dir_name.title()} Documentation\n\n"
        content += f"This directory contains documentation for {relative_path}.\n\n"
        content += f"*Last updated: {datetime.now().strftime('%Y-%m-%d')}*\n\n"
        content += "## Contents\n\n"
        
        # List markdown files
        md_files = sorted(directory.glob('*.md'))
        if md_files:
            for md_file in md_files:
                if md_file.name not in ['README.md', 'index.md']:
                    # Try to extract title from file
                    try:
                        with open(md_file, 'r', encoding='utf-8') as f:
                            first_line = f.readline().strip()
                            if first_line.startswith('#'):
                                title = first_line.lstrip('#').strip()
                            else:
                                title = md_file.stem.replace('-', ' ').replace('_', ' ').title()
                    except Exception:
                        title = md_file.stem.replace('-', ' ').replace('_', ' ').title()
                    
                    content += f"- [{title}]({md_file.name})\n"
        
        # List subdirectories
        subdirs = sorted([d for d in directory.iterdir() if d.is_dir() and not d.name.startswith('.')])
        if subdirs:
            content += "\n## Subdirectories\n\n"
            for subdir in subdirs:
                content += f"- [{subdir.name.title()}]({subdir.name}/)\n"
        
        content += "\n---\n\n"
        content += "*This index was automatically generated.*\n"
        
        return content
    
    def run_comprehensive_check(self) -> Dict[str, Any]:
        """Run comprehensive documentation check and maintenance."""
        logger.info("Starting comprehensive documentation check...")
        
        start_time = time.time()
        files = self.find_markdown_files()
        
        results = {
            'timestamp': datetime.now().isoformat(),
            'duration': 0,
            'files_total': len(files),
            'markdown_validation': {},
            'link_check': {},
            'auto_update': {},
            'index_generation': {},
            'summary': {}
        }
        
        # Run all checks
        try:
            logger.info(f"Found {len(files)} markdown files to check")
            
            # Markdown validation
            logger.info("Running markdown validation...")
            results['markdown_validation'] = self.validate_markdown(files)
            
            # Link checking
            logger.info("Checking links...")
            results['link_check'] = self.check_links(files)
            
            # Auto-update documentation
            logger.info("Updating documentation...")
            results['auto_update'] = self.update_documentation(files)
            
            # Generate index pages
            logger.info("Generating index pages...")
            results['index_generation'] = self.generate_index_pages()
            
        except Exception as e:
            logger.error(f"Error during comprehensive check: {e}")
            results['error'] = str(e)
        
        # Calculate summary
        results['duration'] = time.time() - start_time
        results['summary'] = {
            'markdown_issues': results['markdown_validation'].get('total_issues', 0),
            'broken_links': results['link_check'].get('broken_links', 0),
            'files_updated': results['auto_update'].get('files_updated', 0),
            'pages_generated': results['index_generation'].get('pages_generated', 0),
            'overall_status': 'pass' if (
                results['markdown_validation'].get('total_issues', 0) == 0 and
                results['link_check'].get('broken_links', 0) == 0
            ) else 'issues_found'
        }
        
        # Save cache
        self.save_cache()
        
        logger.info(f"Documentation check completed in {results['duration']:.2f}s")
        return results

def main():
    """Main entry point for documentation automation."""
    parser = argparse.ArgumentParser(description="Vespera Atelier Documentation Automation")
    parser.add_argument("--repo-root", "-r", type=str,
                       help="Repository root path")
    parser.add_argument("--validate", "-v", action="store_true",
                       help="Validate markdown files")
    parser.add_argument("--check-links", "-l", action="store_true",
                       help="Check all links in documentation")
    parser.add_argument("--update", "-u", action="store_true",
                       help="Update documentation content")
    parser.add_argument("--generate", "-g", action="store_true",
                       help="Generate missing index pages")
    parser.add_argument("--comprehensive", "-c", action="store_true",
                       help="Run comprehensive check and maintenance")
    parser.add_argument("--fix", "-f", action="store_true",
                       help="Auto-fix issues where possible")
    parser.add_argument("--output", "-o", type=str,
                       help="Output results to JSON file")
    parser.add_argument("--quiet", "-q", action="store_true",
                       help="Quiet output (errors only)")
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.ERROR)
    
    # Determine repository root
    if args.repo_root:
        repo_root = Path(args.repo_root).resolve()
    else:
        current = Path.cwd()
        repo_root = None
        
        for parent in [current] + list(current.parents):
            if (parent / ".git").exists() or (parent / "package.json").exists():
                repo_root = parent
                break
        
        if not repo_root:
            print("❌ Could not find repository root")
            return 1
    
    # Create documentation manager
    docs_manager = DocumentationManager(repo_root)
    
    try:
        if args.comprehensive:
            results = docs_manager.run_comprehensive_check()
            
            if not args.quiet:
                summary = results['summary']
                print(f"📚 Documentation Check Results:")
                print(f"  Files checked: {results['files_total']}")
                print(f"  Markdown issues: {summary['markdown_issues']}")
                print(f"  Broken links: {summary['broken_links']}")
                print(f"  Files updated: {summary['files_updated']}")
                print(f"  Pages generated: {summary['pages_generated']}")
                print(f"  Duration: {results['duration']:.2f}s")
                print(f"  Status: {summary['overall_status']}")
            
            if args.output:
                with open(args.output, 'w') as f:
                    json.dump(results, f, indent=2)
                print(f"📄 Results saved to: {args.output}")
            
            return 0 if summary['overall_status'] == 'pass' else 1
        
        else:
            results = {}
            
            if args.validate:
                results['markdown_validation'] = docs_manager.validate_markdown()
                if not args.quiet:
                    mv = results['markdown_validation']
                    print(f"📝 Markdown validation: {mv['total_issues']} issues in {mv['files_with_issues']} files")
            
            if args.check_links:
                results['link_check'] = docs_manager.check_links()
                if not args.quiet:
                    lc = results['link_check']
                    print(f"🔗 Link check: {lc['broken_links']} broken links found")
            
            if args.update:
                results['auto_update'] = docs_manager.update_documentation()
                if not args.quiet:
                    au = results['auto_update']
                    print(f"🔄 Auto-update: {au['files_updated']} files updated")
            
            if args.generate:
                results['index_generation'] = docs_manager.generate_index_pages()
                if not args.quiet:
                    ig = results['index_generation']
                    print(f"📄 Index generation: {ig['pages_generated']} pages generated")
            
            if args.output and results:
                with open(args.output, 'w') as f:
                    json.dump(results, f, indent=2)
                print(f"📄 Results saved to: {args.output}")
            
            # Check for errors
            has_errors = any(
                result.get('total_issues', 0) > 0 or result.get('broken_links', 0) > 0
                for result in results.values()
                if isinstance(result, dict)
            )
            
            return 1 if has_errors else 0
    
    except KeyboardInterrupt:
        print("\n👋 Documentation automation stopped")
        return 0
    except Exception as e:
        logger.error(f"Documentation automation error: {e}")
        return 1

if __name__ == "__main__":
    exit(main())
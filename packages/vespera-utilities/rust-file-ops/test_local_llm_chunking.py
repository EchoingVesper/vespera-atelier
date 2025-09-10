#!/usr/bin/env python3
"""
Local LLM-based Discord chunking and analysis
Uses Ollama or similar local LLM for processing sensitive content
"""

import os
import sys
import json
import asyncio
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import argparse
import subprocess

# Try to import Ollama client (install with: pip install ollama)
try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    print("Warning: ollama package not found. Install with: pip install ollama")

# Import the Rust chunking library
sys.path.insert(0, './target/release')
try:
    import vespera_file_ops as vfo
except ImportError:
    print("Error: vespera_file_ops not found. Please build first with: maturin develop --release")
    sys.exit(1)

class LocalLLMProcessor:
    """Process Discord chunks using local LLM"""
    
    def __init__(self, model_name: str = "llama2:7b", debug: bool = False):
        """
        Initialize with a local model
        Common options: llama2:7b, mistral:7b, mixtral:8x7b, codellama:7b
        """
        self.model_name = model_name
        self.debug = debug
        self.ollama_available = OLLAMA_AVAILABLE
        
        if self.ollama_available:
            # Check if Ollama is running
            try:
                ollama.list()
                print(f"✓ Ollama is running, using model: {model_name}")
            except Exception as e:
                print(f"⚠ Ollama not running. Start with: ollama serve")
                self.ollama_available = False
    
    def check_ollama_model(self) -> bool:
        """Check if the specified model is available"""
        if not self.ollama_available:
            return False
            
        try:
            models_response = ollama.list()
            # Debug: show what we got
            if hasattr(self, 'debug') and self.debug:
                print(f"Debug: models_response type: {type(models_response)}")
                # Don't print the full response as it's very verbose
            
            # Handle ListResponse object from ollama library
            if hasattr(models_response, 'models'):
                # It's a ListResponse object with a models attribute
                models_list = models_response.models
            elif isinstance(models_response, dict) and 'models' in models_response:
                models_list = models_response['models']
            elif isinstance(models_response, list):
                models_list = models_response
            else:
                # If response format is unexpected, try to continue anyway
                if self.debug:
                    print(f"Warning: Unexpected models response format, attempting to use {self.model_name}")
                return True
            
            # Extract model names - handle different formats
            model_names = []
            for m in models_list:
                if hasattr(m, 'model'):
                    # It's a Model object from ollama library
                    name = m.model
                elif isinstance(m, dict):
                    # Try different possible keys
                    name = m.get('name') or m.get('model') or str(m)
                else:
                    name = str(m)
                model_names.append(name)
            
            # Check if our model is available (handle :latest suffix)
            model_found = any(
                self.model_name in name or 
                f"{self.model_name}:latest" in name or
                name.startswith(self.model_name.split(':')[0])
                for name in model_names
            )
            
            if not model_found and model_names:
                print(f"Model {self.model_name} not found. Available models: {model_names}")
                print(f"Pull model with: ollama pull {self.model_name}")
                return False
            return True
        except Exception as e:
            print(f"Error checking models: {e}")
            # Try to continue anyway - model might still work
            return True
    
    async def analyze_chunk_for_story(self, chunk: Dict) -> Dict:
        """
        Analyze a chunk for story-related content using local LLM
        Returns extracted story elements
        """
        if not self.ollama_available or not self.check_ollama_model():
            return self._fallback_analysis(chunk)
        
        # Prepare the messages for analysis
        messages_text = self._format_messages_for_llm(chunk['messages'])
        
        prompt = f"""Analyze this conversation for story/fiction development content.
Extract and categorize any discussions about:
- Characters (names, traits, backgrounds)
- Plot points and story events
- World-building elements
- Writing craft discussions
- Themes and motifs

Conversation:
{messages_text}

Provide a JSON response with these fields:
- is_story_related: boolean
- characters_mentioned: list of character names/descriptions
- plot_points: list of plot developments discussed
- world_building: list of world/setting elements
- themes: list of themes discussed
- summary: brief summary if story-related
- relevance_score: 0-10 for story relevance
"""
        
        try:
            response = ollama.generate(
                model=self.model_name,
                prompt=prompt,
                format='json',
                options={
                    'temperature': 0.3,  # Lower temperature for more consistent analysis
                    'top_p': 0.9,
                    'max_tokens': 500
                }
            )
            
            # Parse the response
            try:
                result = json.loads(response['response'])
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                result = {
                    'is_story_related': True,
                    'summary': response['response'][:200],
                    'relevance_score': 5
                }
            
            return result
            
        except Exception as e:
            print(f"LLM analysis error: {e}")
            return self._fallback_analysis(chunk)
    
    def _format_messages_for_llm(self, messages: List[Dict], max_messages: int = 20) -> str:
        """Format messages for LLM consumption"""
        formatted = []
        for msg in messages[:max_messages]:
            author = msg.get('author', 'Unknown')
            content = msg.get('content', '')[:500]  # Limit message length
            formatted.append(f"{author}: {content}")
        
        if len(messages) > max_messages:
            formatted.append(f"... and {len(messages) - max_messages} more messages")
        
        return "\n".join(formatted)
    
    def _fallback_analysis(self, chunk: Dict) -> Dict:
        """Keyword-based fallback when LLM is not available"""
        story_keywords = {
            'character', 'protagonist', 'antagonist', 'hero', 'villain',
            'plot', 'story', 'chapter', 'scene', 'act', 'narrative',
            'world', 'setting', 'magic', 'system', 'lore',
            'theme', 'arc', 'development', 'backstory', 'motivation'
        }
        
        relevance_score = 0
        found_keywords = set()
        
        for msg in chunk.get('messages', []):
            content = msg.get('content', '').lower()
            for keyword in story_keywords:
                if keyword in content:
                    relevance_score += 1
                    found_keywords.add(keyword)
        
        return {
            'is_story_related': relevance_score > 3,
            'relevance_score': min(10, relevance_score),
            'keywords_found': list(found_keywords),
            'method': 'keyword_fallback'
        }

class StoryExtractor:
    """Extract and organize story development from Discord logs"""
    
    def __init__(self, llm_processor: LocalLLMProcessor):
        self.llm = llm_processor
        self.story_elements = {
            'characters': {},
            'plot_timeline': [],
            'world_building': {},
            'themes': set(),
            'chapters_discussed': []
        }
    
    async def process_file(self, file_path: str, output_dir: Optional[Path] = None) -> Dict:
        """Process a Discord export file and extract story elements"""
        print(f"\n{'='*60}")
        print(f"Processing: {Path(file_path).name}")
        print(f"{'='*60}")
        
        # Parse the file
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Get basic info
            chat_log = vfo.py_parse_discord_html(file_path)
            print(f"Total messages: {chat_log['total_messages']}")
            print(f"Participants: {', '.join(chat_log['participants'])}")
            
        except Exception as e:
            print(f"Error parsing file: {e}")
            return None
        
        # Chunk the content
        chunks = vfo.py_chunk_discord_html(
            html_content,
            preserve_conversations=True,
            max_tokens_per_chunk=2000
        )
        print(f"Created {len(chunks)} chunks for analysis")
        
        # Analyze each chunk
        story_chunks = []
        for i, chunk in enumerate(chunks):
            print(f"\rAnalyzing chunk {i+1}/{len(chunks)}...", end='')
            
            analysis = await self.llm.analyze_chunk_for_story(chunk)
            
            if analysis.get('is_story_related', False):
                chunk_data = {
                    'chunk_index': i,
                    'analysis': analysis,
                    'messages': chunk['messages'][:5],  # Sample messages
                    'message_count': len(chunk['messages'])
                }
                story_chunks.append(chunk_data)
                
                # Update story elements
                self._update_story_elements(analysis)
        
        print(f"\n✓ Found {len(story_chunks)} story-related chunks")
        
        # Save results if output directory specified
        if output_dir:
            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Save the analysis
            output_file = output_dir / f"{Path(file_path).stem}_analysis.json"
            with open(output_file, 'w') as f:
                json.dump({
                    'file': Path(file_path).name,
                    'total_chunks': len(chunks),
                    'story_chunks': len(story_chunks),
                    'story_elements': self._serialize_story_elements(),
                    'chunks': story_chunks
                }, f, indent=2)
            
            print(f"✓ Saved analysis to: {output_file}")
            
            # Create a markdown summary
            self._create_markdown_summary(output_dir / f"{Path(file_path).stem}_summary.md")
        
        return {
            'story_chunks': story_chunks,
            'story_elements': self._serialize_story_elements()
        }
    
    def _update_story_elements(self, analysis: Dict):
        """Update the accumulated story elements from chunk analysis"""
        # Characters
        for char in analysis.get('characters_mentioned', []):
            if isinstance(char, str) and char:
                self.story_elements['characters'][char] = \
                    self.story_elements['characters'].get(char, 0) + 1
        
        # Themes
        for theme in analysis.get('themes', []):
            if isinstance(theme, str) and theme:
                self.story_elements['themes'].add(theme)
        
        # Plot points
        for plot in analysis.get('plot_points', []):
            if isinstance(plot, str) and plot:
                self.story_elements['plot_timeline'].append(plot)
        
        # World building
        for element in analysis.get('world_building', []):
            if isinstance(element, str) and element:
                category = 'general'  # Could be enhanced with categorization
                if category not in self.story_elements['world_building']:
                    self.story_elements['world_building'][category] = []
                self.story_elements['world_building'][category].append(element)
    
    def _serialize_story_elements(self) -> Dict:
        """Convert story elements to JSON-serializable format"""
        return {
            'characters': self.story_elements['characters'],
            'plot_timeline': self.story_elements['plot_timeline'],
            'world_building': self.story_elements['world_building'],
            'themes': list(self.story_elements['themes'])
        }
    
    def _create_markdown_summary(self, output_path: Path):
        """Create a readable markdown summary of extracted story elements"""
        with open(output_path, 'w') as f:
            f.write("# Story Development Summary\n\n")
            
            # Characters
            f.write("## Characters\n\n")
            if self.story_elements['characters']:
                for char, count in sorted(self.story_elements['characters'].items(), 
                                         key=lambda x: x[1], reverse=True):
                    f.write(f"- **{char}** (mentioned {count} times)\n")
            else:
                f.write("*No characters identified*\n")
            
            # Plot Timeline
            f.write("\n## Plot Development\n\n")
            if self.story_elements['plot_timeline']:
                for i, plot in enumerate(self.story_elements['plot_timeline'], 1):
                    f.write(f"{i}. {plot}\n")
            else:
                f.write("*No plot points identified*\n")
            
            # World Building
            f.write("\n## World Building\n\n")
            if self.story_elements['world_building']:
                for category, elements in self.story_elements['world_building'].items():
                    f.write(f"### {category.title()}\n\n")
                    for element in elements:
                        f.write(f"- {element}\n")
            else:
                f.write("*No world building elements identified*\n")
            
            # Themes
            f.write("\n## Themes\n\n")
            if self.story_elements['themes']:
                for theme in sorted(self.story_elements['themes']):
                    f.write(f"- {theme}\n")
            else:
                f.write("*No themes identified*\n")
        
        print(f"✓ Created summary: {output_path}")

async def main():
    parser = argparse.ArgumentParser(
        description='Extract story development from Discord logs using local LLM'
    )
    parser.add_argument('--file', default='tests/mock_discord_export.html',
                       help='Discord HTML export file to process')
    parser.add_argument('--model', default='llama2:7b',
                       help='Local LLM model to use (requires Ollama)')
    parser.add_argument('--output', default='story_extraction',
                       help='Output directory for results')
    parser.add_argument('--no-llm', action='store_true',
                       help='Use keyword-based analysis only (no LLM)')
    parser.add_argument('--debug', action='store_true',
                       help='Show debug information')
    args = parser.parse_args()
    
    # Initialize processor
    if args.no_llm:
        print("Using keyword-based analysis (no LLM)")
        processor = LocalLLMProcessor(model_name=None, debug=args.debug)
        processor.ollama_available = False
    else:
        processor = LocalLLMProcessor(model_name=args.model, debug=args.debug)
    
    # Initialize extractor
    extractor = StoryExtractor(processor)
    
    # Process the file
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"Error: File not found: {file_path}")
        # Try the mock file
        mock_path = Path("tests/mock_discord_export.html")
        if mock_path.exists():
            print(f"Using mock file: {mock_path}")
            file_path = mock_path
        else:
            return
    
    # Run extraction
    results = await extractor.process_file(
        str(file_path),
        output_dir=Path(args.output)
    )
    
    if results:
        print(f"\n{'='*60}")
        print("Extraction complete!")
        print(f"Found {len(results['story_chunks'])} story-related sections")
        print(f"Check the '{args.output}' directory for detailed results")

if __name__ == "__main__":
    asyncio.run(main())
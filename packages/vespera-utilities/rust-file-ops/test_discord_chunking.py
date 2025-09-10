#!/usr/bin/env python3
"""
Test script for Discord HTML chunking
This script tests the chunking functionality on real Discord exports
"""

import os
import sys
import json
from pathlib import Path
from typing import List, Dict
import argparse

# Add the Rust library to path (after building with maturin)
# You may need to adjust this path based on your setup
sys.path.insert(0, './target/release')

try:
    import vespera_file_ops as vfo
except ImportError:
    print("Error: vespera_file_ops not found. Please build the library first:")
    print("  maturin develop --release")
    sys.exit(1)

def analyze_discord_file(file_path: str, max_tokens: int = 2000) -> Dict:
    """Analyze a Discord HTML export file"""
    print(f"\n{'='*60}")
    print(f"Analyzing: {Path(file_path).name}")
    print(f"File size: {os.path.getsize(file_path) / 1024 / 1024:.2f} MB")
    print(f"{'='*60}")
    
    # Read the HTML content
    with open(file_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Parse the Discord HTML to get basic info
    try:
        chat_log = vfo.py_parse_discord_html(file_path)
        print(f"\nBasic Statistics:")
        print(f"  Total messages: {chat_log['total_messages']}")
        print(f"  Participants: {', '.join(chat_log['participants'])}")
        print(f"  Message IDs: {len(chat_log['messages'])} messages parsed")
    except Exception as e:
        print(f"Error parsing as Discord HTML: {e}")
        return None
    
    # Chunk the content with conversation preservation
    print(f"\nChunking with max {max_tokens} tokens per chunk...")
    chunks = vfo.py_chunk_discord_html(
        html_content,
        preserve_conversations=True,
        max_tokens_per_chunk=max_tokens
    )
    
    print(f"Created {len(chunks)} chunks")
    
    # Analyze chunks
    results = {
        'file': Path(file_path).name,
        'total_messages': chat_log['total_messages'],
        'participants': chat_log['participants'],
        'num_chunks': len(chunks),
        'chunks': []
    }
    
    for i, chunk in enumerate(chunks):
        num_messages = len(chunk['messages'])
        participants = chunk.get('participants', [])
        topics = chunk.get('topics', ['General'])
        
        # Get first and last message for time range
        if chunk['messages']:
            first_msg = chunk['messages'][0]
            last_msg = chunk['messages'][-1]
            
            print(f"\nChunk {i+1}/{len(chunks)}:")
            print(f"  Messages: {num_messages}")
            print(f"  Participants: {', '.join(participants)}")
            print(f"  Topics: {', '.join(topics)}")
            print(f"  First message: {first_msg.get('author', 'Unknown')}: {first_msg.get('content', '')[:50]}...")
            print(f"  Last message: {last_msg.get('author', 'Unknown')}: {last_msg.get('content', '')[:50]}...")
            
            # Calculate approximate token usage
            total_content = sum(len(msg.get('content', '')) for msg in chunk['messages'])
            approx_tokens = total_content // 4  # Rough estimate
            print(f"  Approx tokens: {approx_tokens}")
            
            results['chunks'].append({
                'index': i,
                'num_messages': num_messages,
                'participants': participants,
                'topics': topics,
                'approx_tokens': approx_tokens,
                'first_msg_preview': first_msg.get('content', '')[:100],
                'last_msg_preview': last_msg.get('content', '')[:100]
            })
    
    return results

def find_fiction_discussions(chunks: List[Dict]) -> List[int]:
    """Identify chunks that likely contain fiction/story discussions"""
    fiction_keywords = [
        'character', 'story', 'plot', 'scene', 'chapter', 'writing',
        'fiction', 'novel', 'protagonist', 'antagonist', 'dialogue',
        'narrative', 'world-building', 'worldbuilding', 'setting',
        'magic', 'fantasy', 'sci-fi', 'genre'
    ]
    
    fiction_chunks = []
    for i, chunk in enumerate(chunks):
        # Check messages for fiction keywords
        fiction_score = 0
        for msg in chunk.get('messages', []):
            content = msg.get('content', '').lower()
            for keyword in fiction_keywords:
                if keyword in content:
                    fiction_score += 1
        
        if fiction_score > 3:  # Threshold for considering it fiction-related
            fiction_chunks.append(i)
    
    return fiction_chunks

def main():
    parser = argparse.ArgumentParser(description='Test Discord HTML chunking')
    parser.add_argument('--dir', default='~/Projects/discord-chat-logs',
                      help='Directory containing Discord HTML exports')
    parser.add_argument('--file', help='Specific file to test')
    parser.add_argument('--max-tokens', type=int, default=2000,
                      help='Maximum tokens per chunk')
    parser.add_argument('--output', help='Save results to JSON file')
    args = parser.parse_args()
    
    # Expand home directory
    log_dir = Path(args.dir).expanduser()
    
    if not log_dir.exists():
        print(f"Error: Directory {log_dir} not found")
        return
    
    # Get files to process
    if args.file:
        files = [log_dir / args.file]
    else:
        # Find all HTML files, sorted by size (smaller first)
        files = sorted(log_dir.glob('*.html'), key=lambda f: f.stat().st_size)
        print(f"Found {len(files)} HTML files in {log_dir}")
        
        # Start with smaller files
        print("\nFiles by size:")
        for f in files[:5]:  # Show first 5
            size_mb = f.stat().st_size / 1024 / 1024
            print(f"  {f.name}: {size_mb:.2f} MB")
    
    # Process files
    all_results = []
    for file_path in files[:3]:  # Process first 3 files for testing
        try:
            result = analyze_discord_file(str(file_path), args.max_tokens)
            if result:
                all_results.append(result)
                
                # Look for fiction discussions
                fiction_chunks = find_fiction_discussions(result['chunks'])
                if fiction_chunks:
                    print(f"\n🎯 Found {len(fiction_chunks)} chunks with fiction discussions!")
                    print(f"   Chunk indices: {fiction_chunks}")
        except Exception as e:
            print(f"Error processing {file_path.name}: {e}")
            import traceback
            traceback.print_exc()
    
    # Save results if requested
    if args.output and all_results:
        output_path = Path(args.output)
        with open(output_path, 'w') as f:
            json.dump(all_results, f, indent=2)
        print(f"\nResults saved to {output_path}")
    
    print("\n" + "="*60)
    print("Testing complete!")
    print(f"Processed {len(all_results)} files successfully")

if __name__ == "__main__":
    main()
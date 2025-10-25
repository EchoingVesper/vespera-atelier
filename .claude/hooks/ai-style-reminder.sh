#!/bin/bash
# AI Style Guide Reminder Hook
# Triggers when editing .md files to remind about documentation standards

set -euo pipefail

# Read JSON input from stdin
input=$(cat)

# Extract tool name and file path
tool_name=$(echo "$input" | jq -r '.toolName // empty')
file_path=$(echo "$input" | jq -r '.parameters.file_path // empty')

# Only trigger for markdown files
if [[ ! "$file_path" =~ \.md$ ]]; then
    exit 0
fi

# Check if it's a Write or Edit operation
if [[ "$tool_name" != "Write" ]] && [[ "$tool_name" != "Edit" ]]; then
    exit 0
fi

# Construct reminder message
reminder="📝 **AI Style Guide Reminder**: You're editing a Markdown file.

Please review [docs/contributing/AI_STYLE_GUIDE.md](docs/contributing/AI_STYLE_GUIDE.md) for:
- ✅ Grounded, realistic language (no hype)
- ✅ Honest about implementation status
- ✅ Personal/humble tone
- ✅ Vision without promises

**Quick Checklist**:
- [ ] No marketing hype or overselling
- [ ] Clear about what exists vs. planned
- [ ] Realistic expectations
- [ ] Appropriate status warnings"

# Return success with reminder message
echo "$reminder"
exit 0

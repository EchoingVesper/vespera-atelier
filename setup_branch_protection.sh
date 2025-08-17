#!/bin/bash

# Setup Branch Protection for vespera-atelier repository
# This script applies the JSON configuration to protect the main branch

set -e

echo "Setting up branch protection for main branch..."

# Apply branch protection using GitHub CLI
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/EchoingVesper/vespera-atelier/branches/main/protection" \
  --input branch_protection_config.json

echo "Branch protection configuration applied successfully!"
echo "Main branch is now protected with:"
echo "- Required PR reviews (1 approval minimum)"
echo "- Status checks enforced"
echo "- Admin enforcement enabled"
echo "- Force pushes blocked"
echo "- Branch deletions blocked"
echo "- Conversation resolution required"
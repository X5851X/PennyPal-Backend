#!/bin/bash

echo "========================================"
echo "   PennyPal Backend Deployment Script"
echo "========================================"
echo

# Check if git is initialized
if [ ! -d .git ]; then
    echo "Initializing Git repository..."
    git init
    git remote add origin https://github.com/Core-KADA-2025/PennyPal.git
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)

if [ "$CURRENT_BRANCH" != "Backend" ]; then
    echo "Switching to Backend branch..."
    git checkout -b Backend 2>/dev/null || git checkout Backend
fi

echo "Current branch: Backend"
echo

# Add all files
echo "Adding files to git..."
git add .

# Commit with timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
git commit -m "deploy: Docker setup and backend updates - $TIMESTAMP"

# Push to GitHub
echo "Pushing to GitHub..."
git push -u origin Backend

echo
echo "========================================"
echo "   Deployment Complete!"
echo "========================================"
echo
echo "GitHub Actions will now build and push the Docker image."
echo "Check the Actions tab at: https://github.com/Core-KADA-2025/PennyPal/actions"
echo
echo "Docker image will be available at:"
echo "ghcr.io/core-kada-2025/pennypal:latest"
echo
#!/bin/bash

# Elevare Setup Script (Linux/macOS)

echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)

if [ "$NODE_VERSION" -lt 18 ]; then
    echo "Error: Node.js version must be 18 or higher. Found $(node -v)"
    exit 1
fi

echo "Installing Backend Dependencies..."
cd backend || exit
npm install
if [ $? -ne 0 ]; then
    echo "Backend install failed"
    exit 1
fi
cd ..

echo "Installing Frontend Dependencies..."
cd frontend || exit
npm install
if [ $? -ne 0 ]; then
    echo "Frontend install failed"
    exit 1
fi
cd ..

echo "--------------------------------------------------"
echo "SUCCESS! Project setup complete."
echo "--------------------------------------------------"
echo "To run the project locally (without Docker):"
echo "1. Start Backend: cd backend && npm run dev"
echo "2. Start Frontend: cd frontend && npm run dev"
echo ""
echo "Ensure you have MongoDB running locally or configured in .env"

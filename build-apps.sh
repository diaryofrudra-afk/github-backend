#!/bin/bash

# Build both React apps for AWS deployment
# This script builds the owner/fleet app at / and the operator app at /operator/

set -e

echo "=========================================="
echo "Building Suprwise Apps for AWS Deployment"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build owner/fleet app (reactcodewebapp-main)
echo -e "${BLUE}[1/2] Building owner/fleet app...${NC}"
cd reactcodewebapp-main
npm install
npm run build
echo -e "${GREEN}✓ Owner/fleet app built${NC}"
cd ..

# Build operator app (suprwise-operator-app)
echo -e "${BLUE}[2/2] Building operator app...${NC}"
cd suprwise-operator-app
npm install
npm run build
echo -e "${GREEN}✓ Operator app built${NC}"
cd ..

# Create deployment directory structure
echo -e "${BLUE}[3/3] Preparing deployment structure...${NC}"
mkdir -p deploy
rm -rf deploy/*

# Copy owner app to deploy root
cp -r reactcodewebapp-main/dist/* deploy/
echo -e "${GREEN}✓ Owner app copied to deploy/${NC}"

# Copy operator app to deploy/operator/
mkdir -p deploy/operator
cp -r suprwise-operator-app/dist/* deploy/operator/
echo -e "${GREEN}✓ Operator app copied to deploy/operator/${NC}"

echo ""
echo -e "${GREEN}=========================================="
echo "Build complete! Ready for AWS deployment"
echo "==========================================${NC}"
echo ""
echo "Deployment structure:"
echo "  deploy/"
echo "  ├── index.html (owner app entry)"
echo "  ├── assets/ (owner app assets)"
echo "  └── operator/"
echo "      ├── index.html (operator app entry)"
echo "      └── assets/ (operator app assets)"
echo ""
echo "Next steps:"
echo "  1. Upload deploy/ to S3 bucket"
echo "  2. Configure CloudFront to serve both paths"
echo "  3. Set up SPA routing for both /index.html and /operator/index.html"

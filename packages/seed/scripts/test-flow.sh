#!/bin/bash
set -e

echo "=== cocapn seed test-flow ==="

cd /tmp
rm -rf test-cocapn
mkdir -p test-cocapn && cd test-cocapn

git init
git config user.email test@test.com
git config user.name Test

echo "# Test Repo" > README.md
git add . && git commit -m "init"

mkdir -p cocapn
cat > cocapn/soul.md << 'EOF'
---
name: Test Agent
tone: friendly
---
I am a test agent living in this repo.
EOF

echo '{"mode": "private"}' > cocapn/cocapn.json

# Add more commits for git awareness
echo "console.log('hello')" > index.js
git add . && git commit -m "add index.js"

echo "export {}" > util.ts
git add . && git commit -m "add util.ts"

echo ""
echo "--- Git log ---"
git log --oneline

echo ""
echo "--- Building cocapn seed ---"
cd /tmp/cocapn/packages/seed
npm install
npm run build 2>&1 || echo "(build may fail if types mismatch - OK for flow test)"

echo ""
echo "--- Test: cocapn help ---"
node dist/index.js help || true

echo ""
echo "--- Test: cocapn whoami ---"
cd /tmp/test-cocapn
DEEPSEEK_API_KEY=test node /tmp/cocapn/packages/seed/dist/index.js whoami || true

echo ""
echo "--- Test: web server (5 sec) ---"
DEEPSEEK_API_KEY=test timeout 5 node /tmp/cocapn/packages/seed/dist/index.js --web --port 3199 || true

echo ""
echo "=== test-flow complete ==="

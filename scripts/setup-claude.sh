#!/bin/bash
# One-command setup helper for Claude Code

set -e

MCP_DIR="$HOME/mcp-servers/teacherville-mcp"
SETTINGS_FILE="$HOME/.claude/settings.json"

echo "🚀 티처몰 MCP Claude Code 등록 도우미"
echo ""

# Check if built
if [ ! -f "$MCP_DIR/dist/index.js" ]; then
  echo "❌ 빌드된 파일이 없습니다. 먼저 다음 명령어를 실행하세요:"
  echo "   cd $MCP_DIR && npm install && npm run build"
  exit 1
fi

# Backup settings
if [ -f "$SETTINGS_FILE" ]; then
  cp "$SETTINGS_FILE" "$SETTINGS_FILE.backup.$(date +%Y%m%d-%H%M%S)"
  echo "✅ 기존 settings.json 백업 완료"
fi

# Add or update the teacherville entry
node -e '
const fs = require("fs");
const path = require("path");

const settingsPath = process.argv[1];
const mcpPath = process.argv[2];

let settings = {};
if (fs.existsSync(settingsPath)) {
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
}

if (!settings.mcpServers) settings.mcpServers = {};

settings.mcpServers.teacherville = {
  command: "node",
  args: [mcpPath],
  description: "티처몰 상품 검색 — 학급운영, 교구, 스티커, 준비물 (개인용 고품질 MCP)"
};

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
console.log("✅ ~/.claude/settings.json에 teacherville MCP가 등록되었습니다.");
' "$SETTINGS_FILE" "$MCP_DIR/dist/index.js"

echo ""
echo "🎉 완료! 이제 Claude Code를 완전히 재시작하세요."
echo ""
echo "테스트 예시:"
echo "  \"티처몰에서 스티커 검색해줘\""
echo "  \"이번 학기 보상 스티커로 뭐가 인기 있어?\""
echo ""

#!/usr/bin/env bash
# Register this MCP server with Claude Code and Codex.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_INDEX="$PROJECT_DIR/dist/index.js"
CLAUDE_MCP_FILE="${CLAUDE_MCP_FILE:-$HOME/.claude/mcp.json}"
CODEX_CONFIG_FILE="${CODEX_CONFIG_FILE:-$HOME/.codex/config.toml}"
CLAUDE_COMMANDS_DIR="${CLAUDE_COMMANDS_DIR:-$HOME/.claude/commands}"

echo "Teachermall MCP setup"
echo "Project: $PROJECT_DIR"

if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  npm --prefix "$PROJECT_DIR" install
fi

if [ ! -f "$DIST_INDEX" ]; then
  echo "Building dist..."
  npm --prefix "$PROJECT_DIR" run build
fi

mkdir -p "$(dirname "$CLAUDE_MCP_FILE")" "$(dirname "$CODEX_CONFIG_FILE")" "$CLAUDE_COMMANDS_DIR"

if [ -f "$CLAUDE_MCP_FILE" ]; then
  cp "$CLAUDE_MCP_FILE" "$CLAUDE_MCP_FILE.backup.$(date +%Y%m%d-%H%M%S)"
fi

if [ -f "$CODEX_CONFIG_FILE" ]; then
  cp "$CODEX_CONFIG_FILE" "$CODEX_CONFIG_FILE.backup.$(date +%Y%m%d-%H%M%S)"
fi

node - "$CLAUDE_MCP_FILE" "$CODEX_CONFIG_FILE" "$DIST_INDEX" <<'NODE'
const fs = require('node:fs');
const claudePath = process.argv[2];
const codexPath = process.argv[3];
const serverPath = process.argv[4];

let claude = {};
if (fs.existsSync(claudePath)) {
  claude = JSON.parse(fs.readFileSync(claudePath, 'utf8'));
}

claude.mcpServers ??= {};
claude.mcpServers.teachermall = {
  command: 'node',
  args: [serverPath],
  description: '티처몰 상품 검색 및 교사용 준비물 추천 MCP',
};

fs.writeFileSync(claudePath, `${JSON.stringify(claude, null, 2)}\n`);

const block = `[mcp_servers.teachermall]
command = "node"
args = ["${serverPath.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"]
startup_timeout_sec = 30.0
tool_timeout_sec = 120.0
`;

let codex = fs.existsSync(codexPath) ? fs.readFileSync(codexPath, 'utf8') : '';
codex = codex.replace(/(?:^|\n)\[mcp_servers\.teachermall\]\n[\s\S]*?(?=\n\[|\s*$)/m, '\n').trimEnd();
fs.writeFileSync(codexPath, `${codex}\n\n${block}`);
NODE

cp "$PROJECT_DIR/commands/tcv.md" "$CLAUDE_COMMANDS_DIR/tcv.md"

echo "Registered Claude Code MCP: $CLAUDE_MCP_FILE"
echo "Registered Codex MCP: $CODEX_CONFIG_FILE"
echo "Installed Claude slash command: $CLAUDE_COMMANDS_DIR/tcv.md"
echo "Restart Claude Code and Codex to load the server."

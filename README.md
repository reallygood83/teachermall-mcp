# Teachermall MCP (티처몰 MCP)

Claude Code와 Codex에서 **자연어로** 티처몰(shop.teacherville.co.kr)의 상품을 검색하고, 학급운영·수업 준비물을 추천받을 수 있는 MCP 서버 + Claude Code 슬래시 명령어입니다.

**GitHub**: https://github.com/reallygood83/teachermall-mcp

> **주요 대상**: 초등/유치원 교사, 학급 운영과 수업 준비물을 자주 구매하는 분들

## 주요 기능

### 고수준 스마트 도구 (강력 추천)
- `/tcv` 또는 자연어로 사용 가능
- `recommend_for_lesson` — 수업 주제/단원 기반 준비물 추천 (가격 필터, 제외 키워드 지원)
- `build_classroom_kit` — 학급운영/보상 키트 자동 구성 + 예산 내 최적 조합
- `generate_semester_preparation_list` — 이번 학기 전체 준비물 리스트 자동 생성 (Notion 친화적 출력)
- `optimize_within_budget` — 여러 필요 항목 + 예산으로 최적 조합 탐색
- `create_shopping_list_from_text` — 수업 계획/교안 텍스트를 붙여넣으면 필요한 물품 자동 추출

### 기본 도구
- 상품 검색, 인기 상품, 상세 정보 조회

## 설치 방법 (5분 컷)

### 1. 레포 클론

```bash
git clone https://github.com/reallygood83/teachermall-mcp.git
cd teachermall-mcp
```

### 2. 의존성 설치 및 빌드

```bash
npm install
npm run build
```

### 3. Claude Code + Codex MCP 등록

가장 쉬운 방법은 제공 스크립트를 실행하는 것입니다. 현재 레포 경로를 자동으로 감지해 `dist/index.js`를 Claude Code와 Codex 양쪽에 등록합니다.

```bash
./scripts/setup-claude.sh
```

스크립트가 하는 일:
- `~/.claude/mcp.json`에 `teachermall` MCP 서버 등록
- `~/.codex/config.toml`에 `[mcp_servers.teachermall]` 등록
- `commands/tcv.md`를 `~/.claude/commands/tcv.md`로 설치
- `skills/tcv/SKILL.md`를 `~/.codex/skills/tcv/SKILL.md`로 설치
- 기존 설정 파일은 타임스탬프 백업 생성

수동 등록이 필요하면 아래 예시를 사용하세요.

Claude Code:

```json
{
  "mcpServers": {
    "teachermall": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/teachermall-mcp/dist/index.js"],
      "description": "티처몰(Teacherville) 학급운영·수업 준비물 추천 MCP"
    }
  }
}
```

Codex:

```toml
[mcp_servers.teachermall]
command = "node"
args = ["/ABSOLUTE/PATH/teachermall-mcp/dist/index.js"]
startup_timeout_sec = 30.0
tool_timeout_sec = 120.0
```

> `args`의 경로는 본인 환경에 맞게 수정해주세요.

### 4. Claude Code와 Codex 완전 재시작

설치 후 Claude Code와 Codex를 완전히 종료하고 다시 실행하세요.

### 5. 검증

```bash
npm run typecheck
npm test
npm run build
npm run smoke:mcp
```

`smoke:mcp`는 빌드된 MCP 서버가 9개 도구를 정상 노출하는지 확인합니다.

## 사용 방법

### 추천 방식: /tcv 명령어 사용

```bash
/tcv 2학년 1학기 전체 준비물 리스트, 보상과 과학 중점으로 총 8만원 예산으로 짜줘

/tcv 3학년 화산 수업에 필요한 준비물, 2만원 이하로 추천해줘

/tcv [수업 계획이나 단원 설명 텍스트를 길게 붙여넣기]
이 수업에 필요한 물품 리스트 만들어줘
```

### Codex에서 사용

Codex에서는 설치 후 다음처럼 호출하세요:

```bash
$tcv 3학년 화산 실험 준비물 2만원 이하로 추천해줘

tcv 2학년 보상체계 키트 3만원, 간식 제외
```

Codex skill은 Claude Code와 달리 `$tcv`/`tcv` 형태로 트리거됩니다.

### 자연어로 직접 사용

Claude Code에서 그냥 이렇게 말해도 됩니다:
- "티처몰에서 1학년 보상 스티커 인기순으로 찾아줘"
- "이번 학기 학급운영 키트 예산 3만원으로 만들어줘"

## 주의사항

- 이 MCP는 티처몰 공식 API가 아닌 내부 엔드포인트를 사용합니다.
- 사이트 구조 변경 시 일부 기능이 동작하지 않을 수 있습니다.
- 과도한 요청은 자제해주세요 (기본 캐싱 적용됨).
- 추천 로직은 관련도 하한을 적용하지만, 구매 전에는 실제 상세 페이지의 옵션과 배송 조건을 확인하세요.

## 로드맵

- npm 패키지 배포
- 더 정교한 추천 로직
- 실제 교사 피드백 기반 개선

## 기여

버그 제보, 기능 제안, Pull Request 모두 환영합니다!

---

**Made for teachers who hate repetitive shopping.**

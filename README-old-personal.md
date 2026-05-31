# Teacherville MCP

Claude Code에서 **자연어로** 티처몰(shop.teacherville.co.kr)의 상품을 검색하고, 학급운영·수업 준비물을 똑똑하게 추천받을 수 있는 MCP 서버입니다.

> **대상 사용자**: 초등/유치원 교사, 학급 운영 준비물을 자주 구매하는 분들

## 주요 기능

### 기본 기능
- 자연어 검색 (`search_products`)
- 인기 상품 조회 (`get_best_sellers`)
- 상품 상세 정보 (HTML 파싱 포함)

### 고수준 스마트 추천 (강력 추천)
- `recommend_for_lesson` — 수업 주제/단원에 맞는 준비물 추천 (가격대 필터, 제외 키워드 지원)
- `build_classroom_kit` — 학급운영/보상 키트 자동 구성 (예산 내 최적 조합)
- `generate_semester_preparation_list` — 이번 학기 전체 준비물 리스트 자동 생성 (Notion 친화적 출력)
- `optimize_within_budget` — 여러 needs + 예산으로 최적 조합 탐색
- `create_shopping_list_from_text` — 수업 계획이나 교안 텍스트를 붙여넣으면 필요한 물품 자동 추출

## 요구사항

- Node.js 18 이상
- Claude Code (MCP 지원 버전)

## 설치 방법

### 1. 저장소 클론

```bash
git clone https://github.com/당신의아이디/teacherville-mcp.git
cd teacherville-mcp
```

### 2. 의존성 설치 및 빌드

```bash
npm install
npm run build
```

### 3. Claude Code에 MCP 등록

`~/.claude/settings.json` 파일을 열고 아래 내용을 추가하세요.

```json
{
  "mcpServers": {
    "teacherville": {
      "command": "node",
      "args": ["/절대경로/teacherville-mcp/dist/index.js"],
      "description": "티처몰 상품 검색 — 학급운영, 교구, 스티커, 준비물 추천"
    }
  }
}
```

> **팁**: 절대경로는 본인 환경에 맞게 수정해주세요. (예: `/Users/사용자명/mcp-servers/teacherville-mcp/dist/index.js`)

### 4. /tcv 슬래시 명령어 설치 (강력 추천)

티처몰 전문가 모드를 더 편하게 사용하고 싶다면 아래 명령어를 실행하세요:

```bash
mkdir -p ~/.claude/commands
cp commands/tcv.md ~/.claude/commands/tcv.md
```

설치 후 Claude Code를 재시작하면 `/tcv` 명령어를 사용할 수 있습니다.

## 사용 방법

### 기본 사용 (MCP 직접 호출)
Claude Code에서 자연스럽게 말하세요:
- "티처몰에서 1학년 보상 스티커 인기순으로 찾아줘"
- "화산 수업에 필요한 교구 추천해줘, 2만원 이하로"

### /tcv 명령어 사용 (추천)
```bash
/tcv 2학년 1학기 전체 준비물 리스트, 보상과 과학 중점으로 총 8만원 예산으로 짜줘

/tcv [수업 계획이나 단원 설명을 길게 붙여넣기]
이 수업에 필요한 준비물 리스트 만들어줘

/tcv 보상 스티커, 우체통, 이름표 필요해. 예산 25000원 내에서 최적 조합 찾아줘
```

`/tcv`를 입력하면 Claude가 자동으로 티처몰 전문가 모드로 전환되어 더 똑똑하게 추천해줍니다.

## 주의사항

- 이 MCP는 티처몰의 **공식 API**가 아닌 내부 엔드포인트를 사용합니다.
- 사이트 구조가 변경되면 일부 기능이 동작하지 않을 수 있습니다.
- 과도한 요청은 자제해주세요 (기본적으로 캐싱이 적용되어 있습니다).

## 로드맵

- [ ] npm 패키지 배포 (`npx teacherville-mcp` 형태로 설치 가능하게)
- [ ] 더 정교한 추천 알고리즘 (판매자 신뢰도, 계절성 등 반영)
- [ ] 실제 교사들의 사용 피드백 기반 개선

## 라이선스

MIT License

---

**Made for teachers who are tired of repetitive shopping.**

기여나 제안은 언제든 환영합니다!

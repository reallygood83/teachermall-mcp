#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { client } from './api/client.js';
import { SortOption } from './types/product.js';

const server = new McpServer({
  name: 'teacherville-mcp',
  version: '0.1.0',
  description: '티처몰(shop.teacherville.co.kr) 상품 검색 MCP — 학급운영, 교구, 스티커, 준비물을 자연어로 검색하세요.',
});

// ============================================
// Tool 1: search_products (가장 중요)
// ============================================
server.tool(
  'search_products',
  {
    query: z.string().min(1).describe('검색어 (예: 스티커, 보상, 우체통, 1학년, 과학실험)'),
    page: z.number().int().min(1).default(1).describe('페이지 번호 (기본 1)'),
    limit: z.number().int().min(1).max(20).default(10).describe('결과 개수 (기본 10, 최대 20)'),
    sort: z
      .enum(['relevance', 'price_low', 'price_high', 'popular', 'newest'])
      .default('relevance')
      .describe('정렬 기준: relevance(관련도), popular(인기/판매량), price_low(낮은가격), price_high(높은가격), newest(최신)'),
  },
  async ({ query, page, limit, sort }) => {
    try {
      const result = await client.searchProducts(query, {
        page,
        limit,
        sort: sort as SortOption,
      });

      if (result.items.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ "${query}"에 대한 검색 결과가 없습니다.\n\n다른 키워드로 시도해보세요 (예: 스티커, 보상, 학급, 교구, 우체원).`,
            },
          ],
        };
      }

      const itemsText = result.items
        .map((item, idx) => {
          const priceText = item.consumer_price && item.consumer_price > item.price
            ? `~~${item.consumer_price.toLocaleString()}원~~ → **${item.price.toLocaleString()}원**`
            : `**${item.price.toLocaleString()}원**`;

          const purchaseText = item.purchase_count
            ? ` (구매 ${item.purchase_count.toLocaleString()}회)`
            : '';

          return `${idx + 1}. **[${item.goods_name}](${item.shop_url})**\n   ${priceText}${purchaseText}\n   판매자: ${item.provider_name || '티처몰'}\n   이미지: ${item.image_url}`;
        })
        .join('\n\n');

      const summary = [
        `🔍 **"${query}" 검색 결과** (페이지 ${page}, ${result.items.length}개 표시)`,
        result.has_more ? '더 많은 결과가 있습니다. page를 올려서 확인하세요.' : '',
        '',
        itemsText,
      ]
        .filter(Boolean)
        .join('\n');

      return {
        content: [{ type: 'text', text: summary }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// ============================================
// Tool 2: get_best_sellers
// ============================================
server.tool(
  'get_best_sellers',
  {
    tab: z.string().default('school').describe('베스트 탭 (school, all 등)'),
    limit: z.number().int().min(1).max(15).default(8).describe('가져올 개수'),
  },
  async ({ tab, limit }) => {
    try {
      const items = await client.getBestSellers(tab, limit);

      if (items.length === 0) {
        return {
          content: [{ type: 'text', text: '베스트 상품을 불러오지 못했습니다.' }],
        };
      }

      const text = items
        .map((item, idx) => {
          const price = `**${item.price.toLocaleString()}원**`;
          const purchase = item.purchase_count ? ` · 구매 ${item.purchase_count}회` : '';
          return `${idx + 1}. [${item.goods_name}](${item.shop_url}) — ${price}${purchase}`;
        })
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `🏆 **티처몰 인기 상품 TOP ${items.length}** (tab: ${tab})\n\n${text}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `베스트 상품 조회 실패: ${error}` }],
      };
    }
  }
);

// ============================================
// Tool 3: get_product_details (강화된 버전 - HTML 파싱)
// ============================================
server.tool(
  'get_product_details',
  {
    goods_no: z.string().or(z.number()).describe('상품 번호 (goods_seq)'),
  },
  async ({ goods_no }) => {
    const detail = await client.getProductDetail(String(goods_no));

    if (detail.error) {
      return {
        content: [{ type: 'text', text: `❌ ${detail.error}\n링크: ${detail.shop_url}` }],
      };
    }

    const images = (detail.images || []).slice(0, 4).map((u: string) => `- ${u}`).join('\n');

    const optionsText = detail.options && detail.options.length > 0
      ? `**옵션 예시**: ${detail.options.slice(0, 6).join(' | ')}`
      : '';

    const text = [
      `📦 **${detail.title || '상품 상세'}**`,
      ``,
      `**가격**: ${detail.price ? detail.price.toLocaleString() + '원' : '확인 필요'}`,
      `**판매자**: ${detail.provider_name || '티처몰'}`,
      ``,
      `**바로가기**: ${detail.shop_url}`,
      ``,
      detail.description ? `**상품 설명**:\n${detail.description}` : '',
      optionsText,
      images ? `\n**이미지**:\n${images}` : '',
    ].filter(Boolean).join('\n');

    return {
      content: [{ type: 'text', text }],
    };
  }
);

// ============================================
// Tool 4: recommend_for_lesson (정교화된 추천)
// ============================================
server.tool(
  'recommend_for_lesson',
  {
    topic: z.string().min(2).describe('수업 주제 또는 단원 (예: 화산, 소수, 한글, 보상체계, 과학실험)'),
    grade: z.string().optional().describe('학년 (예: 1학년, 3학년, 유치원)'),
    minPrice: z.number().optional().describe('최소 가격'),
    maxPrice: z.number().optional().describe('최대 가격 (예산 상한)'),
    limit: z.number().int().min(3).max(12).default(6).describe('추천 개수'),
    excludeKeywords: z.array(z.string()).optional().describe('제외할 키워드 (예: ["중국", "비싼"])'),
  },
  async ({ topic, grade, minPrice, maxPrice, limit, excludeKeywords = [] }) => {
    const query = [topic, grade].filter(Boolean).join(' ');
    const boost = [grade, '스티커', '교구', '준비물'].filter(Boolean) as string[];

    const items = await client.smartSearch(query, {
      limit,
      minPrice,
      maxPrice,
      boostKeywords: boost,
      excludeKeywords,
    });

    if (items.length === 0) {
      return {
        content: [{ type: 'text', text: `“${query}”에 맞는 상품을 찾지 못했습니다.` }],
      };
    }

    const text = items.map((item, i) => {
      const price = `${item.price.toLocaleString()}원`;
      const purchase = item.purchase_count ? ` · 인기 ${item.purchase_count}회` : '';
      return `${i + 1}. [${item.goods_name}](${item.shop_url}) — ${price}${purchase}`;
    }).join('\n');

    const budgetNote = maxPrice ? ` (예산 ${maxPrice.toLocaleString()}원 이하)` : '';

    return {
      content: [{
        type: 'text',
        text: `📚 **“${topic}”${grade ? ` (${grade})` : ''} 수업 준비물 추천${budgetNote}**\n\n${text}\n\n필요하면 "예산 15000원 이하" 또는 "스티커 위주"처럼 더 구체적으로 말씀해주세요!`,
      }],
    };
  }
);

// ============================================
// Tool 5: build_classroom_kit (예산 고려 + 정교화된 키트)
// ============================================
server.tool(
  'build_classroom_kit',
  {
    purpose: z.string().min(2).describe('목적 (예: 학급운영, 보상체계, 출석체크, 과학실험)'),
    grade: z.string().optional().describe('주요 학년'),
    maxBudget: z.number().optional().describe('최대 예산 (원)'),
    itemCount: z.number().int().min(3).max(8).default(5).describe('키트 상품 수'),
    excludeKeywords: z.array(z.string()).optional().describe('제외할 키워드'),
  },
  async ({ purpose, grade, maxBudget, itemCount }) => {
    const needs = [purpose, grade, '보상', '스티커', '학급'].filter(Boolean) as string[];

    if (maxBudget) {
      const optimized = await client.findBestUnderBudget(needs, maxBudget, { itemCount });

      const text = optimized.items.map((item, i) => {
        const price = `${item.price.toLocaleString()}원`;
        return `${i + 1}. [${item.goods_name}](${item.shop_url}) — ${price}`;
      }).join('\n');

      return {
        content: [{
          type: 'text',
          text: `🎒 **${purpose} ${grade ? grade + ' ' : ''}키트 (예산 ${maxBudget.toLocaleString()}원)**\n총 ${optimized.totalCost.toLocaleString()}원 | 남은 예산 ${optimized.remaining.toLocaleString()}원\n\n${text}\n\n더 세밀하게 조정하고 싶으면 말씀해주세요!`,
        }],
      };
    }

    // Fallback to previous behavior when no budget
    const query = [purpose, grade, '스티커', '보상'].filter(Boolean).join(' ');
    const result = await client.searchProducts(query, { limit: itemCount + 4, sort: 'popular' });
    const kitItems = result.items.slice(0, itemCount);
    const total = kitItems.reduce((sum, i) => sum + i.price, 0);

    const text = kitItems.map((item, i) => `${i + 1}. [${item.goods_name}](${item.shop_url}) — ${item.price.toLocaleString()}원`).join('\n');

    return {
      content: [{
        type: 'text',
        text: `🎒 **${purpose} ${grade ? grade + ' ' : ''}학급운영 키트** (약 ${total.toLocaleString()}원 예상)\n\n${text}`,
      }],
    };
  }
);

// ============================================
// Tool 6: generate_semester_preparation_list (이번 학기 전체 준비물 계획)
// ============================================
server.tool(
  'generate_semester_preparation_list',
  {
    grade: z.string().describe('학년 (예: 2학년, 4학년)'),
    semester: z.string().optional().describe('학기 (1학기 / 2학기)'),
    focusAreas: z.array(z.string()).optional().describe('중점 영역 (예: ["보상체계", "과학", "한글"])'),
    maxTotalBudget: z.number().optional().describe('전체 예산 상한'),
  },
  async ({ grade, semester = '1학기', focusAreas = [], maxTotalBudget }) => {
    const baseNeeds = ['학급운영', '스티커', '보상', '준비물'];
    const allNeeds = [...baseNeeds, ...focusAreas, grade];

    let items: any[] = [];
    let total = 0;

    if (maxTotalBudget) {
      const optimized = await client.findBestUnderBudget(allNeeds, maxTotalBudget, { itemCount: 12 });
      items = optimized.items;
      total = optimized.totalCost;
    } else {
      const results = await client.smartSearch(allNeeds.join(' '), { limit: 12 });
      items = results;
      total = items.reduce((s, i) => s + i.price, 0);
    }

    const grouped: Record<string, any[]> = {
      '학급운영/보상': [],
      '수업교구': [],
      '기타': [],
    };

    items.forEach(item => {
      const name = item.goods_name.toLowerCase();
      if (name.includes('스티커') || name.includes('보상') || name.includes('우체') || name.includes('상장')) {
        grouped['학급운영/보상'].push(item);
      } else if (name.includes('교구') || name.includes('실험') || name.includes('과학')) {
        grouped['수업교구'].push(item);
      } else {
        grouped['기타'].push(item);
      }
    });

    // Beautiful Notion-friendly output
    let text = `# 📅 ${grade} ${semester} 전체 준비물 리스트\n\n`;

    if (maxTotalBudget) {
      text += `> **예산 계획**: ${maxTotalBudget.toLocaleString()}원 | **실제 구성**: ${total.toLocaleString()}원\n\n`;
    } else {
      text += `> **총 예상 금액**: ${total.toLocaleString()}원\n\n`;
    }

    text += `## 요약\n`;
    text += `- 총 상품 수: ${items.length}개\n`;
    text += `- 예상 총액: ${total.toLocaleString()}원\n\n`;

    Object.entries(grouped).forEach(([cat, list]) => {
      if (list.length === 0) return;
      const catTotal = list.reduce((s: number, i: any) => s + i.price, 0);
      text += `## ${cat} (${list.length}개 · ${catTotal.toLocaleString()}원)\n\n`;

      list.forEach((item: any) => {
        const popular = item.purchase_count ? ` (인기 ${item.purchase_count}회)` : '';
        text += `- [ ] **${item.goods_name}** — ${item.price.toLocaleString()}원${popular}\n`;
        text += `  - [바로가기](${item.shop_url})\n`;
      });
      text += `\n`;
    });

    text += `---\n`;
    text += `**총 예상 지출**: ${total.toLocaleString()}원\n\n`;
    text += `필요하면 특정 카테고리를 더 늘리거나, 예산을 조정하거나, Notion에 바로 붙여넣기 좋은 버전으로 다시 만들어드릴게요!`;

    return { content: [{ type: 'text', text }] };
  }
);

// ============================================
// Tool 7: optimize_within_budget (예산 내 최적 조합)
// ============================================
server.tool(
  'optimize_within_budget',
  {
    needs: z.array(z.string()).min(1).describe('필요한 항목 목록 (예: ["보상 스티커", "우체통", "과학실험 키트"])'),
    maxBudget: z.number().describe('최대 예산'),
    itemCount: z.number().int().min(3).max(10).default(6).describe('원하는 상품 수'),
  },
  async ({ needs, maxBudget, itemCount }) => {
    const optimized = await client.findBestUnderBudget(needs, maxBudget, { itemCount });

    const text = optimized.items.map((item, i) =>
      `${i + 1}. [${item.goods_name}](${item.shop_url}) — ${item.price.toLocaleString()}원`
    ).join('\n');

    return {
      content: [{
        type: 'text',
        text: `💰 **예산 ${maxBudget.toLocaleString()}원 내 최적 조합**\n총 지출: ${optimized.totalCost.toLocaleString()}원 | 남은 예산: ${optimized.remaining.toLocaleString()}원\n\n${text}\n\n다른 조합을 원하시면 needs나 예산을 조정해주세요.`,
      }],
    };
  }
);

// ============================================
// Tool 8: create_shopping_list_from_text (수업 계획 텍스트 → 장바구니)
// ============================================
server.tool(
  'create_shopping_list_from_text',
  {
    lessonText: z.string().min(20).describe('수업 계획이나 단원 설명 텍스트 (자유롭게 붙여넣기)'),
    grade: z.string().optional().describe('학년'),
    maxBudget: z.number().optional().describe('전체 예산'),
  },
  async ({ lessonText, grade, maxBudget }) => {
    // Very simple keyword extraction (can be improved later with better NLP)
    const keywords = [
      '실험', '관찰', '스티커', '보상', '우체통', '상장', '이름표', 
      '과학', '한글', '수학', '미술', '체육', '역할', '모둠', '협동'
    ];

    const found = keywords.filter(kw => lessonText.includes(kw));

    const needs = [...found, grade || '', '준비물'].filter(Boolean);

    let resultText = `📝 **수업 계획 기반 쇼핑 리스트**\n\n`;
    resultText += `**추출된 키워드**: ${found.join(', ') || '일반 준비물'}\n\n`;

    if (maxBudget) {
      const optimized = await client.findBestUnderBudget(needs, maxBudget, { itemCount: 8 });
      resultText += `**예산 ${maxBudget.toLocaleString()}원 내 추천** (총 ${optimized.totalCost.toLocaleString()}원)\n\n`;
      optimized.items.forEach((item, i) => {
        resultText += `${i + 1}. [${item.goods_name}](${item.shop_url}) — ${item.price.toLocaleString()}원\n`;
      });
    } else {
      const items = await client.smartSearch(needs.join(' '), { limit: 8 });
      resultText += `**추천 상품**\n\n`;
      items.forEach((item, i) => {
        resultText += `${i + 1}. [${item.goods_name}](${item.shop_url}) — ${item.price.toLocaleString()}원\n`;
      });
    }

    resultText += `\n더 구체적인 수업 계획을 더 주시면 더 정확하게 뽑아드릴게요!`;

    return { content: [{ type: 'text', text: resultText }] };
  }
);

// ============================================
// Tool 9: clear_cache (개발/디버깅용)
// ============================================
server.tool(
  'clear_cache',
  {},
  async () => {
    client.clearCache();
    return {
      content: [{ type: 'text', text: '✅ 캐시가 초기화되었습니다.' }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Teacherville MCP server started (고품질 개인용 버전)');
}

main().catch((err) => {
  console.error('Fatal error in Teacherville MCP:', err);
  process.exit(1);
});

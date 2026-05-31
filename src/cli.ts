#!/usr/bin/env node
/**
 * Simple CLI for direct use without Claude Code
 * Usage:
 *   npx tsx src/cli.ts search "스티커" --limit 5
 *   npx tsx src/cli.ts best --limit 8
 */
import { client } from './api/client.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (command === 'search' || command === 's') {
    const query = args[1];
    if (!query) {
      console.error('Usage: teacherville search "키워드" [--limit 10] [--sort popular]');
      process.exit(1);
    }

    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10;

    const sortIdx = args.indexOf('--sort');
    const sort = (sortIdx !== -1 ? args[sortIdx + 1] : 'relevance') as any;

    console.log(`🔍 "${query}" 검색 중...\n`);

    const result = await client.searchProducts(query, { limit, sort });

    if (result.items.length === 0) {
      console.log('결과가 없습니다.');
      return;
    }

    result.items.forEach((item, i) => {
      const price = item.consumer_price && item.consumer_price > item.price
        ? `~${item.consumer_price}원 → ${item.price}원`
        : `${item.price}원`;

      console.log(`${i + 1}. ${item.goods_name}`);
      console.log(`   ${price}${item.purchase_count ? ` · 구매 ${item.purchase_count}회` : ''}`);
      console.log(`   ${item.shop_url}`);
      console.log('');
    });
  } else if (command === 'best' || command === 'b') {
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 8;

    console.log('🏆 인기 상품 불러오는 중...\n');

    const items = await client.getBestSellers('school', limit);

    items.forEach((item, i) => {
      console.log(`${i + 1}. ${item.goods_name} — ${item.price}원`);
      console.log(`   ${item.shop_url}`);
      console.log('');
    });
  } else {
    console.log(`
티처몰 CLI (개인용)

사용법:
  teacherville search "스티커" --limit 8 --sort popular
  teacherville best --limit 10

명령어:
  search, s     키워드 검색
  best, b       베스트 상품
`);
  }
}

main().catch(console.error);

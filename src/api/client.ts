import { Product, SearchResult, SearchOptions } from '../types/product.js';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://shop.teacherville.co.kr';
const GRADE_PATTERN = /^(유치원|초등)?\s*\d+\s*학년$/;
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Referer': `${BASE_URL}/`,
};

function buildImageUrl(relativePath: string): string {
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath;
  return `${BASE_URL}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

function buildShopUrl(goodsSeq: string): string {
  return `${BASE_URL}/goods/view?no=${goodsSeq}`;
}

function parsePrice(priceStr: string | number | undefined): number {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

export function normalizeSearchToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[()[\]{}'"“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getMeaningfulQueryTokens(query: string): string[] {
  return normalizeSearchToken(query)
    .split(/\s+/)
    .filter(token => token.length > 1 && !GRADE_PATTERN.test(token));
}

function getPrimaryQueryTokens(query: string): string[] {
  const tokens = getMeaningfulQueryTokens(query);
  return tokens.length > 0 ? [tokens[0]] : [];
}

export function extractPriceCandidates(text: string): number[] {
  const candidates: number[] = [];
  const wonPattern = /(?:^|[^\d])(\d{1,3}(?:,\d{3})+|\d{3,7})\s*원/g;
  let match: RegExpExecArray | null;

  while ((match = wonPattern.exec(text)) !== null) {
    const price = parsePrice(match[1]);
    if (price > 0 && price < 10_000_000) {
      candidates.push(price);
    }
  }

  return candidates;
}

function chooseRepresentativePrice(candidates: number[]): number {
  const unique = [...new Set(candidates)].filter(price => price > 0).sort((a, b) => a - b);
  if (unique.length === 0) return 0;

  const commonRetailPrices = unique.filter(price => price >= 100 && price <= 500_000);
  return commonRetailPrices[0] ?? unique[0];
}

function parseStandalonePriceCandidate(text: string): number {
  const price = parsePrice(text);
  return price > 0 && price < 10_000_000 ? price : 0;
}

function mapApiItemToProduct(item: any): Product {
  const goodsSeq = String(item.goods_seq || item._id || '');
  
  return {
    goods_seq: goodsSeq,
    goods_name: item.goods_name || '',
    price: parsePrice(item.default_price ?? item.price),
    consumer_price: parsePrice(item.default_consumer_price ?? item.consumer_price),
    image_url: buildImageUrl(item.fm_goods_image_image || item.goods_img || ''),
    shop_url: buildShopUrl(goodsSeq),
    provider_name: item.provider_name,
    purchase_count: item.purchase_ea_total || item.purchase_ea,
    score: item._score,
    badges: item.image_badge ? (Array.isArray(item.image_badge) ? item.image_badge : [item.image_badge]) : undefined,
    properties: item.properties,
    regist_date: item.regist_date,
  };
}

export class TeachervilleClient {
  private cache: Map<string, { data: any; expires: number }> = new Map();
  private readonly cacheTtlMs: number;

  constructor(cacheTtlMinutes = 45) {
    this.cacheTtlMs = cacheTtlMinutes * 60 * 1000;
  }

  private getCacheKey(endpoint: string, params: Record<string, any>): string {
    const sorted = Object.keys(params)
      .sort()
      .map(k => `${k}=${Array.isArray(params[k]) ? params[k].join(',') : params[k] ?? ''}`)
      .join('&');
    return `${endpoint}?${sorted}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.cacheTtlMs,
    });
  }

  private async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      throw new Error(`API request failed: ${res.status} ${res.statusText} — ${url}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Main search using the excellent internal API
   */
  async searchProducts(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const { page = 1, limit = 12, sort = 'relevance', minPrice, maxPrice } = options;

    const cacheKey = this.getCacheKey('search', { query, page, limit, sort, minPrice, maxPrice });
    const cached = this.getFromCache<SearchResult>(cacheKey);
    if (cached) return cached;

    // Map our sort options to the site's parameters
    let sortField = '_score';
    let sortOrder = 'desc';

    switch (sort) {
      case 'price_low':
        sortField = 'default_price';
        sortOrder = 'asc';
        break;
      case 'price_high':
        sortField = 'default_price';
        sortOrder = 'desc';
        break;
      case 'popular':
        sortField = 'purchase_ea_total';
        sortOrder = 'desc';
        break;
      case 'newest':
        sortField = 'regist_date';
        sortOrder = 'desc';
        break;
      case 'relevance':
      default:
        sortField = '_score';
        sortOrder = 'desc';
    }

    const params = new URLSearchParams({
      page: String(page),
      goods_type: 'goods',
      'sorts[field]': sortField,
      'sorts[order]': sortOrder,
      'prices[start]': '0',
      'prices[end]': '0',
      search: query,
      filter_price_range: 'all',
      ...(minPrice ? { 'prices[start]': String(minPrice) } : {}),
      ...(maxPrice ? { 'prices[end]': String(maxPrice) } : {}),
    });

    const url = `${BASE_URL}/goods/api_retrieval?${params.toString()}`;

    try {
      const raw = await this.fetchJson<any>(url);

      if (!raw.success || !raw.data?.items) {
        return {
          query,
          page,
          items: [],
          has_more: false,
        };
      }

      const items: Product[] = raw.data.items
        .slice(0, limit)
        .map(mapApiItemToProduct);

      const result: SearchResult = {
        query,
        page,
        items,
        has_more: raw.data.items.length > limit,
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[Teacherville] Search failed:', error);
      throw new Error(`검색 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get best sellers
   */
  async getBestSellers(tab: string = 'school', limit: number = 10): Promise<Product[]> {
    const cacheKey = this.getCacheKey('best', { tab, limit });
    const cached = this.getFromCache<Product[]>(cacheKey);
    if (cached) return cached;

    const url = `${BASE_URL}/goods/get_best_goods?tab=${encodeURIComponent(tab)}&code=all&mode=main1`;

    try {
      const items = await this.fetchJson<any[]>(url);
      const products = items.slice(0, limit).map(mapApiItemToProduct);

      this.setCache(cacheKey, products);
      return products;
    } catch (error) {
      console.error('[Teacherville] Best sellers failed:', error);
      return [];
    }
  }

  /**
   * Fetch and parse product detail page using cheerio.
   * Returns rich information suitable for teacher decision making.
   */
  async getProductDetail(goodsNo: string): Promise<any> {
    const cacheKey = `detail:${goodsNo}`;
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const url = buildShopUrl(goodsNo);

    try {
      const res = await fetch(url, {
        headers: {
          ...DEFAULT_HEADERS,
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch product page: ${res.status}`);
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Extract title - try multiple common patterns for Korean malls
      const title = $('h1, h2, .goods_name, .item_name, .product_title, title')
        .first()
        .text()
        .replace(/[\n\t\r]/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 120);

      // Price extraction
      const priceText = $('.price, .sell_price, .goods_price, [class*="price"]')
        .text()
        .replace(/[\n\t\r,원]/g, ' ')
        .trim();

      const priceTexts = Array.from($('.price, .sell, .consumer, [class*="price"], meta[property="product:price:amount"], meta[itemprop="price"]'))
        .map(el => $(el).text())
        .concat(
          $('meta[property="product:price:amount"]').attr('content') || '',
          $('meta[itemprop="price"]').attr('content') || ''
        )
        .filter(Boolean);

      const currentPrice = chooseRepresentativePrice([
        ...priceTexts.flatMap(text => extractPriceCandidates(text)),
        ...priceTexts.map(parseStandalonePriceCandidate).filter(Boolean),
        ...extractPriceCandidates(priceText),
      ]);

      // Multiple images
      const images: string[] = [];
      $('img').each((_, img) => {
        const src = $(img).attr('src') || '';
        if (src.includes('/data/goods/') || src.includes('goods')) {
          images.push(buildImageUrl(src));
        }
      });

      // Try to find description / product info area
      let description = '';
      const descCandidates = [
        '#goods_info', '#goodsInfo', '.goods_info', '.goods_detail',
        '.detail_info', '.product_description', '#detail', '.item_detail',
        '[id*="info"]', '[class*="detail"]'
      ];

      for (const selector of descCandidates) {
        const el = $(selector);
        if (el.length) {
          const text = el.text().replace(/\s+/g, ' ').trim();
          if (text.length > 80) {
            description = text.slice(0, 800);
            break;
          }
        }
      }

      // Fallback: look for long text blocks after "상품정보"
      if (!description) {
        const bodyText = $('body').text();
        const infoIdx = bodyText.indexOf('상품정보');
        if (infoIdx > 0) {
          description = bodyText.slice(infoIdx + 4, infoIdx + 600).replace(/\s+/g, ' ').trim();
        }
      }

      // Options (size, color, type etc.)
      const options: string[] = [];
      $('select option, .option, .goods_option, [class*="option"]').each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > 1 && t.length < 50 && !t.includes('선택')) {
          options.push(t);
        }
      });

      // Seller / provider
      const provider = $('.provider, .seller, .brand, [class*="shop"]').first().text().trim() ||
                       $('body').text().match(/판매자[:\s]*([^\n|]+)/)?.[1]?.trim();

      const detail = {
        goods_seq: goodsNo,
        title: title || `상품 #${goodsNo}`,
        shop_url: url,
        price: currentPrice,
        images: [...new Set(images)].slice(0, 6),
        description: description || '상세 설명을 불러오지 못했습니다. 사이트에서 확인해주세요.',
        options: [...new Set(options)].slice(0, 8),
        provider_name: provider || undefined,
        fetched_at: new Date().toISOString(),
      };

      this.setCache(cacheKey, detail);
      return detail;

    } catch (error) {
      console.error('[Teacherville] Detail scraping failed for', goodsNo, error);
      return {
        goods_seq: goodsNo,
        shop_url: url,
        error: '상세 정보를 가져오는 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * Advanced smart ranking with multiple signals:
   * - Keyword match quality (exact phrase > word match)
   * - Purchase volume + velocity
   * - Recency boost (newer items get small lift)
   * - Seller trust signals (티처몰ONLY, high-volume providers)
   * - Price/value balance
   */
  private calculateAdvancedScore(item: Product, query: string, boostKeywords: string[]): number {
    const name = item.goods_name || '';
    const nameLower = name.toLowerCase();
    const queryLower = query.toLowerCase();
    const queryWords = getMeaningfulQueryTokens(queryLower);

    let score = 0;

    // 1. Base popularity (most important for teachers)
    const popularity = (item.purchase_count || 0);
    score += Math.min(popularity, 1200) * 0.55;

    // 2. Keyword match quality (much stronger now)
    let matchBonus = 0;
    if (nameLower.includes(queryLower)) {
      matchBonus += 280; // strong exact phrase match
    } else {
      const matchedWords = queryWords.filter(w => nameLower.includes(w)).length;
      matchBonus += matchedWords * 85;
    }
    score += matchBonus;

    if (queryWords.length > 0 && queryWords.every(w => nameLower.includes(w))) {
      score += 220;
    }

    // 3. Boost keywords (학년, 보상, 스티커 등)
    boostKeywords.forEach(kw => {
      if (nameLower.includes(kw.toLowerCase())) {
        score += 145;
      }
    });

    // 4. Recency boost (if regist_date available)
    if (item.regist_date) {
      const date = new Date(item.regist_date);
      const monthsOld = (Date.now() - date.getTime()) / (1000 * 3600 * 24 * 30);
      if (monthsOld < 6) score += 95;
      else if (monthsOld < 12) score += 45;
      else if (monthsOld > 36) score -= 30; // old items slight penalty
    }

    // 5. Seller trust signals
    const provider = (item.provider_name || '').toLowerCase();
    if (provider.includes('티처몰') || provider.includes('테크빌')) {
      score += 70; // official / high trust
    }
    if (item.badges?.some(b => String(b).includes('mall_only') || String(b).includes('pb'))) {
      score += 55;
    }

    // 6. Value score (purchase per won) - prevents overpriced low-volume items
    if (item.price > 0) {
      const valueScore = popularity / Math.max(item.price, 300);
      score += Math.min(valueScore * 180, 160);
    }

    // 7. Price sanity (avoid extremely expensive unless very popular)
    if (item.price > 15000 && popularity < 50) {
      score *= 0.65;
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Smart search with advanced multi-signal ranking + price filtering + diversity.
   */
  async smartSearch(query: string, options: {
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
    boostKeywords?: string[];
    excludeKeywords?: string[];   // NEW: force exclude
    requiredKeywords?: string[];
  } = {}): Promise<Product[]> {
    const { limit = 10, minPrice, maxPrice, boostKeywords = [], excludeKeywords = [], requiredKeywords } = options;
    const required = (requiredKeywords ?? getPrimaryQueryTokens(query)).map(normalizeSearchToken).filter(Boolean);
    const fetchLimit = Math.min(35, limit * 3 + 8);

    const searchVariants = [
      { query, sort: 'relevance' as const },
      { query, sort: 'popular' as const },
    ];

    const shortQuery = getMeaningfulQueryTokens(query).join(' ');
    if (shortQuery && shortQuery !== normalizeSearchToken(query)) {
      searchVariants.push({ query: shortQuery, sort: 'relevance' as const });
    }

    const responses = await Promise.all(searchVariants.map(variant =>
      this.searchProducts(variant.query, {
        limit: fetchLimit,
        minPrice,
        maxPrice,
        sort: variant.sort,
      })
    ));

    const merged = new Map<string, Product>();
    responses.flatMap(response => response.items).forEach(item => {
      if (item.goods_seq) merged.set(item.goods_seq, item);
    });

    let items = [...merged.values()].filter(item => {
      const nameLower = item.goods_name.toLowerCase();
      const excluded = excludeKeywords.some(kw => nameLower.includes(kw.toLowerCase()));
      const missingRequired = required.length > 0 && !required.some(kw => nameLower.includes(kw));
      return !excluded && !missingRequired;
    });

    // Calculate advanced scores
    items = items.map(item => {
      const smartScore = this.calculateAdvancedScore(item, query, boostKeywords);
      return { ...item, _smartScore: smartScore };
    });

    // Sort by smart score
    items.sort((a, b) => ((b as any)._smartScore || 0) - ((a as any)._smartScore || 0));

    // Light diversity: avoid too many from the exact same provider in top results
    const seenProviders = new Set<string>();
    const diversified: Product[] = [];
    for (const item of items) {
      const prov = (item.provider_name || 'unknown').toLowerCase();
      if (diversified.length < limit * 0.7 || !seenProviders.has(prov) || diversified.length >= limit) {
        diversified.push(item);
        seenProviders.add(prov);
      }
      if (diversified.length >= limit) break;
    }

    // Fill remaining slots if needed
    while (diversified.length < limit && items.length > diversified.length) {
      const next = items.find(i => !diversified.includes(i));
      if (next) diversified.push(next);
      else break;
    }

    return diversified.slice(0, limit);
  }

  /**
   * Very simple budget optimizer: greedy selection under budget.
   * Good enough for small kits (5-8 items).
   */
  async findBestUnderBudget(needs: string[], maxBudget: number, options: { itemCount?: number; excludeKeywords?: string[] } = {}) {
    const targetCount = options.itemCount || 5;
    const candidates: Product[] = [];

    for (const need of needs) {
      const results = await this.smartSearch(need, {
        limit: 6,
        excludeKeywords: options.excludeKeywords,
        requiredKeywords: getPrimaryQueryTokens(need),
      });
      candidates.push(...results);
    }

    // Dedup by goods_seq
    const unique = Array.from(new Map(candidates.map(p => [p.goods_seq, p])).values());

    // Sort by value (purchase_count / price) — bang for buck
    unique.sort((a, b) => {
      const va = (a.purchase_count || 1) / Math.max(a.price, 1);
      const vb = (b.purchase_count || 1) / Math.max(b.price, 1);
      return vb - va;
    });

    // Greedy pick under budget
    const selected: Product[] = [];
    let spent = 0;

    for (const item of unique) {
      if (selected.length >= targetCount) break;
      if (spent + item.price <= maxBudget) {
        selected.push(item);
        spent += item.price;
      }
    }

    return {
      items: selected,
      totalCost: spent,
      remaining: maxBudget - spent,
      allCandidates: unique.slice(0, 15),
    };
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance for the MCP server
export const client = new TeachervilleClient(45);

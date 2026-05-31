export interface Product {
  goods_seq: string;
  goods_name: string;
  price: number;
  consumer_price?: number;
  image_url: string;
  shop_url: string;
  provider_name?: string;
  purchase_count?: number;
  score?: number;
  badges?: string[];
  properties?: string;
  regist_date?: string;           // for recency boost
  _smartScore?: number;           // internal
  _matchScore?: number;           // keyword match quality
}

export interface SearchResult {
  query: string;
  total_count?: number;
  page: number;
  items: Product[];
  has_more: boolean;
}

export interface ProductDetail extends Product {
  description?: string;
  options?: string[];
  stock_status?: string;
  review_count?: number;
  average_rating?: number;
  detail_images?: string[];
  category_path?: string;
}

export type SortOption = 'relevance' | 'price_low' | 'price_high' | 'popular' | 'newest';

export interface SearchOptions {
  page?: number;
  limit?: number;
  sort?: SortOption;
  minPrice?: number;
  maxPrice?: number;
}

export interface RecommendationOptions {
  topic: string;
  grade?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  boostKeywords?: string[];   // extra keywords to boost score
}

export interface KitOptions {
  purpose: string;
  grade?: string;
  maxBudget?: number;
  itemCount?: number;
}

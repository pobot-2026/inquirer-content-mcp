import type { ContentService, ContentServiceConfig } from "./content-service.js";
import type { Article, AccessLevel } from "../schemas/article.js";

/**
 * Arc XP Content API Service
 * 
 * Implements ContentService interface against Arc's Content API v4.
 * Handles ANS schema transformation to MCP article schema.
 */

interface ArcConfig extends ContentServiceConfig {
  website: string;  // e.g., "philly-media-network"
  baseUrl: string;  // e.g., "https://api.sandbox.pmn.arcpublishing.com"
}

interface ArcSearchResponse {
  type: string;
  content_elements: ArcArticle[];
  count: number;
  next?: number;
}

interface ArcArticle {
  _id: string;
  slug?: string;
  type: string;
  headlines?: {
    basic?: string;
  };
  description?: {
    basic?: string;
  };
  subheadlines?: {
    basic?: string;
  };
  credits?: {
    by?: Array<{
      name?: string;
      _id?: string;
      org?: string;
      type?: string;
    }>;
  };
  taxonomy?: {
    primary_section?: {
      name?: string;
      _id?: string;
    };
    tags?: Array<{
      text?: string;
      slug?: string;
    }>;
  };
  source?: {
    name?: string;
    source_type?: string;  // "staff", "wires", etc.
    system?: string;
  };
  distributor?: {
    name?: string;
    category?: string;  // "staff", "wires"
  };
  publish_date?: string;
  first_publish_date?: string;
  last_updated_date?: string;
  display_date?: string;
  canonical_url?: string;
  website_url?: string;
  promo_items?: {
    basic?: {
      url?: string;
      type?: string;
      credits?: {
        by?: Array<{
          name?: string;
          type?: string;
        }>;
      };
    };
  };
  additional_properties?: {
    restricted?: boolean;
  };
  content_restrictions?: {
    content_code?: string;  // "premium", "free", etc.
  };
  websites?: {
    [key: string]: {
      website_url?: string;
    };
  };
}

/**
 * Wire service identifiers to mark as restricted
 */
const WIRE_SOURCES = ["AP", "Reuters", "Getty", "AFP", "UPI", "Associated Press"];

/**
 * Check if an article is from a wire service
 */
function isWireContent(article: ArcArticle): boolean {
  const sourceName = article.source?.name || "";
  const sourceType = article.source?.source_type || "";
  const distributorName = article.distributor?.name || "";
  const distributorCategory = article.distributor?.category || "";
  
  // Check various wire indicators
  if (sourceType === "wires" || distributorCategory === "wires") {
    return true;
  }
  
  for (const wire of WIRE_SOURCES) {
    if (sourceName.toLowerCase().includes(wire.toLowerCase()) ||
        distributorName.toLowerCase().includes(wire.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Determine access level based on Arc content
 */
function determineAccess(article: ArcArticle): AccessLevel {
  // Wire content is restricted
  if (isWireContent(article)) {
    return "restricted";
  }
  
  // Check explicit restriction flag
  if (article.additional_properties?.restricted) {
    return "restricted";
  }
  
  // Check content_restrictions for paywall info
  const contentCode = article.content_restrictions?.content_code;
  if (contentCode === "premium" || contentCode === "subscriber") {
    return "subscriber";
  }
  if (contentCode === "registered" || contentCode === "metered") {
    return "registered";
  }
  
  // Default to free
  return "free";
}

/**
 * Check if image is from staff (safe to expose)
 */
function isStaffImage(article: ArcArticle): boolean {
  const promoCredits = article.promo_items?.basic?.credits?.by || [];
  const sourceType = article.source?.source_type || "";
  
  // If source is staff, images are likely staff too
  if (sourceType === "staff") {
    return true;
  }
  
  // Check image credits for wire indicators
  for (const credit of promoCredits) {
    const creditName = credit.name || "";
    for (const wire of WIRE_SOURCES) {
      if (creditName.toLowerCase().includes(wire.toLowerCase())) {
        return false;
      }
    }
  }
  
  // Default to true for staff content
  return sourceType === "staff";
}

/**
 * Transform Arc ANS article to MCP Article schema
 */
function transformArticle(arc: ArcArticle, config: ArcConfig): Article | null {
  const access = determineAccess(arc);
  
  // Skip restricted content entirely
  if (access === "restricted") {
    return null;
  }
  
  // Build canonical URL
  const websiteUrl = arc.websites?.[config.website]?.website_url || arc.website_url || arc.canonical_url || "";
  const canonicalUrl = websiteUrl.startsWith("http") 
    ? websiteUrl 
    : `https://www.inquirer.com${websiteUrl}`;
  
  // Get image URL only for staff photos
  let imageUrl: string | null = null;
  if (arc.promo_items?.basic?.url && isStaffImage(arc)) {
    imageUrl = arc.promo_items.basic.url;
  }
  
  // Extract author name
  const author = arc.credits?.by?.[0]?.name || "Staff";
  
  // Extract topics from tags
  const topics = (arc.taxonomy?.tags || [])
    .map(tag => tag.text || tag.slug || "")
    .filter(Boolean);
  
  // Determine content type
  const arcType = arc.type || "story";
  const contentType = mapContentType(arcType);
  
  return {
    id: arc._id,
    slug: arc.slug || arc._id,
    headline: arc.headlines?.basic || "Untitled",
    summary: arc.description?.basic || arc.subheadlines?.basic || null,
    author,
    section: arc.taxonomy?.primary_section?.name || "News",
    topics,
    published_at: arc.publish_date || arc.first_publish_date || arc.display_date || new Date().toISOString(),
    updated_at: arc.last_updated_date || arc.publish_date || new Date().toISOString(),
    canonical_url: canonicalUrl,
    access,
    source: arc.source?.source_type || "staff",
    content_type: contentType,
    image_url: imageUrl
  };
}

/**
 * Map Arc content types to MCP content types
 */
function mapContentType(arcType: string): Article["content_type"] {
  const typeMap: Record<string, Article["content_type"]> = {
    story: "article",
    article: "article",
    gallery: "article",
    video: "article",
    liveblog: "liveblog",
    "live-blog": "liveblog",
    guide: "guide",
    explainer: "guide",
    analysis: "analysis",
    opinion: "opinion",
    "op-ed": "opinion",
    editorial: "opinion",
    review: "review"
  };
  
  return typeMap[arcType.toLowerCase()] || "article";
}

/**
 * Arc XP Content Service Implementation
 */
export class ArcContentService implements ContentService {
  private config: ArcConfig;
  
  constructor(config: ArcConfig) {
    this.config = config;
  }
  
  private async fetch<T>(endpoint: string, params: Record<string, string | number | undefined>): Promise<T> {
    // Filter out undefined params
    const cleanParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        cleanParams[key] = String(value);
      }
    }
    
    const url = new URL(`${this.config.baseUrl}${endpoint}`);
    url.search = new URLSearchParams(cleanParams).toString();
    
    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Arc API error (${response.status}): ${error}`);
    }
    
    return response.json() as Promise<T>;
  }
  
  async search(params: {
    query: string;
    section?: string;
    topic?: string;
    region?: string;
    from_date?: string;
    to_date?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ articles: Article[]; next_cursor: string | null }> {
    // Build Arc search query
    let query = params.query;
    
    // Add section filter
    if (params.section) {
      query += ` AND taxonomy.primary_section._id:"/${params.section.toLowerCase()}"`;
    }
    
    // Add topic filter (search in tags)
    if (params.topic) {
      query += ` AND taxonomy.tags.text:"${params.topic}"`;
    }
    
    const from = params.cursor ? parseInt(params.cursor, 10) : 0;
    
    const response = await this.fetch<ArcSearchResponse>("/content/v4/search/published", {
      website: this.config.website,
      q: query,
      size: params.limit,
      from,
      sort: "display_date:desc"
    });
    
    const articles = response.content_elements
      .map(arc => transformArticle(arc, this.config))
      .filter((a): a is Article => a !== null);
    
    const nextCursor = response.next !== undefined ? String(response.next) : null;
    
    return { articles, next_cursor: nextCursor };
  }
  
  async getArticle(idOrSlug: string): Promise<Article | null> {
    try {
      // Try by ID first
      const response = await this.fetch<ArcArticle>("/content/v4/stories", {
        website: this.config.website,
        _id: idOrSlug
      });
      
      return transformArticle(response, this.config);
    } catch {
      // Try by website_url (slug)
      try {
        const response = await this.fetch<ArcArticle>("/content/v4/stories", {
          website: this.config.website,
          website_url: idOrSlug.startsWith("/") ? idOrSlug : `/${idOrSlug}`
        });
        
        return transformArticle(response, this.config);
      } catch {
        return null;
      }
    }
  }
  
  async getLatest(params: {
    section?: string;
    region?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ articles: Article[]; next_cursor: string | null }> {
    // Build query for latest news
    let query = "type:story";
    
    if (params.section) {
      query += ` AND taxonomy.primary_section._id:"/${params.section.toLowerCase()}"`;
    }
    
    const from = params.cursor ? parseInt(params.cursor, 10) : 0;
    
    const response = await this.fetch<ArcSearchResponse>("/content/v4/search/published", {
      website: this.config.website,
      q: query,
      size: params.limit,
      from,
      sort: "display_date:desc"
    });
    
    const articles = response.content_elements
      .map(arc => transformArticle(arc, this.config))
      .filter((a): a is Article => a !== null);
    
    const nextCursor = response.next !== undefined ? String(response.next) : null;
    
    return { articles, next_cursor: nextCursor };
  }
  
  async getTopicNews(params: {
    topic: string;
    section?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ articles: Article[]; next_cursor: string | null }> {
    // Search by topic in tags and headline
    let query = `(taxonomy.tags.text:"${params.topic}" OR headlines.basic:"${params.topic}")`;
    
    if (params.section) {
      query += ` AND taxonomy.primary_section._id:"/${params.section.toLowerCase()}"`;
    }
    
    const from = params.cursor ? parseInt(params.cursor, 10) : 0;
    
    const response = await this.fetch<ArcSearchResponse>("/content/v4/search/published", {
      website: this.config.website,
      q: query,
      size: params.limit,
      from,
      sort: "display_date:desc"
    });
    
    const articles = response.content_elements
      .map(arc => transformArticle(arc, this.config))
      .filter((a): a is Article => a !== null);
    
    const nextCursor = response.next !== undefined ? String(response.next) : null;
    
    return { articles, next_cursor: nextCursor };
  }
  
  async getRelated(idOrSlug: string, limit: number): Promise<Article[]> {
    // First get the article to find its topics
    const article = await this.getArticle(idOrSlug);
    if (!article || article.topics.length === 0) {
      return [];
    }
    
    // Search for articles with same topics
    const topicQuery = article.topics
      .slice(0, 3)
      .map(t => `taxonomy.tags.text:"${t}"`)
      .join(" OR ");
    
    const query = `(${topicQuery}) AND NOT _id:"${article.id}"`;
    
    const response = await this.fetch<ArcSearchResponse>("/content/v4/search/published", {
      website: this.config.website,
      q: query,
      size: limit,
      sort: "display_date:desc"
    });
    
    return response.content_elements
      .map(arc => transformArticle(arc, this.config))
      .filter((a): a is Article => a !== null);
  }
}

/**
 * Create Arc Content Service with environment configuration
 */
export function createArcContentService(): ArcContentService {
  const apiKey = process.env.PMN_SANDBOX_CONTENT_API;
  
  if (!apiKey) {
    throw new Error("PMN_SANDBOX_CONTENT_API environment variable is required");
  }
  
  return new ArcContentService({
    baseUrl: process.env.ARC_API_BASE_URL || "https://api.sandbox.pmn.arcpublishing.com",
    website: process.env.ARC_WEBSITE || "philly-media-network",
    apiKey
  });
}

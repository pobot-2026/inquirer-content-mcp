import type { ContentService } from "./content-service.js";
import type { Article } from "../schemas/article.js";

/**
 * Mock Content Service for development and testing
 */
export class MockContentService implements ContentService {
  private articles: Article[] = [
    {
      id: "abc123",
      slug: "eagles-win-super-bowl-2026",
      headline: "Eagles Win Super Bowl LX in Dominant Fashion",
      summary: "The Philadelphia Eagles captured their second Super Bowl title with a commanding 38-17 victory over the Kansas City Chiefs.",
      author: "Marcus Hayes",
      section: "Sports",
      topics: ["Eagles", "NFL", "Super Bowl", "Philadelphia"],
      published_at: "2026-02-08T23:45:00-05:00",
      updated_at: "2026-02-09T08:30:00-05:00",
      canonical_url: "https://www.inquirer.com/eagles/eagles-win-super-bowl-2026.html",
      access: "free",
      source: "staff",
      content_type: "article",
      image_url: "https://www.inquirer.com/resizer/abc123.jpg"
    },
    {
      id: "def456",
      slug: "septa-budget-crisis-2026",
      headline: "SEPTA Faces $240M Budget Shortfall, Service Cuts Loom",
      summary: "Regional transit authority warns of significant service reductions without new state funding by fiscal year end.",
      author: "Paul Nussbaum",
      section: "News",
      topics: ["SEPTA", "Transit", "Philadelphia", "Budget"],
      published_at: "2026-03-07T14:00:00-05:00",
      updated_at: "2026-03-07T14:00:00-05:00",
      canonical_url: "https://www.inquirer.com/transportation/septa-budget-crisis-2026.html",
      access: "subscriber",
      source: "staff",
      content_type: "article",
      image_url: "https://www.inquirer.com/resizer/def456.jpg"
    },
    {
      id: "ghi789",
      slug: "best-cheesesteaks-philadelphia-2026",
      headline: "The 15 Best Cheesesteaks in Philadelphia, Ranked",
      summary: "Our critics spent months eating their way through the city to bring you the definitive cheesesteak ranking.",
      author: "Michael Klein",
      section: "Food",
      topics: ["Cheesesteaks", "Philadelphia", "Restaurants", "Best Of"],
      published_at: "2026-03-01T10:00:00-05:00",
      updated_at: "2026-03-05T16:00:00-05:00",
      canonical_url: "https://www.inquirer.com/food/best-cheesesteaks-philadelphia-2026.html",
      access: "free",
      source: "staff",
      content_type: "guide",
      image_url: "https://www.inquirer.com/resizer/ghi789.jpg"
    },
    {
      id: "wire001",
      slug: "ap-national-story",
      headline: "National Story from Wire Service",
      summary: null,
      author: "Associated Press",
      section: "News",
      topics: ["National"],
      published_at: "2026-03-07T12:00:00-05:00",
      updated_at: "2026-03-07T12:00:00-05:00",
      canonical_url: "https://www.inquirer.com/news/ap-national-story.html",
      access: "restricted",
      source: "AP",
      content_type: "article",
      image_url: null
    }
  ];

  async search(params: {
    query: string;
    section?: string;
    topic?: string;
    limit: number;
    cursor?: string;
  }): Promise<{ articles: Article[]; next_cursor: string | null }> {
    const query = params.query.toLowerCase();
    let results = this.articles.filter(a => 
      a.access !== "restricted" &&
      (a.headline.toLowerCase().includes(query) ||
       a.summary?.toLowerCase().includes(query) ||
       a.topics.some(t => t.toLowerCase().includes(query)))
    );

    if (params.section) {
      results = results.filter(a => a.section.toLowerCase() === params.section!.toLowerCase());
    }

    return {
      articles: results.slice(0, params.limit),
      next_cursor: null
    };
  }

  async getArticle(idOrSlug: string): Promise<Article | null> {
    const article = this.articles.find(a => 
      a.id === idOrSlug || a.slug === idOrSlug
    );
    
    // Return 404 for restricted content
    if (article?.access === "restricted") {
      return null;
    }
    
    return article || null;
  }

  async getLatest(params: {
    section?: string;
    limit: number;
  }): Promise<{ articles: Article[]; next_cursor: string | null }> {
    let results = this.articles.filter(a => a.access !== "restricted");
    
    if (params.section) {
      results = results.filter(a => a.section.toLowerCase() === params.section!.toLowerCase());
    }

    // Sort by published_at descending
    results.sort((a, b) => 
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );

    return {
      articles: results.slice(0, params.limit),
      next_cursor: null
    };
  }

  async getTopicNews(params: {
    topic: string;
    section?: string;
    limit: number;
  }): Promise<{ articles: Article[]; next_cursor: string | null }> {
    const topic = params.topic.toLowerCase();
    let results = this.articles.filter(a => 
      a.access !== "restricted" &&
      a.topics.some(t => t.toLowerCase().includes(topic))
    );

    if (params.section) {
      results = results.filter(a => a.section.toLowerCase() === params.section!.toLowerCase());
    }

    return {
      articles: results.slice(0, params.limit),
      next_cursor: null
    };
  }

  async getRelated(idOrSlug: string, limit: number): Promise<Article[]> {
    const article = await this.getArticle(idOrSlug);
    if (!article) return [];

    // Find articles with overlapping topics
    const related = this.articles.filter(a => 
      a.id !== article.id &&
      a.access !== "restricted" &&
      a.topics.some(t => article.topics.includes(t))
    );

    return related.slice(0, limit);
  }
}

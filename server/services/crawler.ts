import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface CrawledPage {
  url: string;
  title?: string;
  type?: string;
  statusCode?: number;
}

export interface CrawlOptions {
  maxPages: number;
  includeImages: boolean;
}

export class WebsiteCrawler {
  private visited = new Set<string>();
  private baseUrl: string = '';
  private sitemapDepth = 0;
  private readonly MAX_SITEMAP_DEPTH = 2;

  async crawlWebsite(websiteUrl: string, options: CrawlOptions): Promise<CrawledPage[]> {
    this.visited.clear();
    this.baseUrl = new URL(websiteUrl).origin;
    this.sitemapDepth = 0;
    
    const pages: CrawledPage[] = [];
    const toVisit = [websiteUrl];

    // First try to get sitemap.xml
    const sitemapPages = await this.parseSitemap(websiteUrl);
    if (sitemapPages.length > 0) {
      return sitemapPages.slice(0, options.maxPages);
    }

    // Fallback to manual crawling
    while (toVisit.length > 0 && pages.length < options.maxPages) {
      const currentUrl = toVisit.shift()!;
      
      if (this.visited.has(currentUrl)) continue;
      this.visited.add(currentUrl);

      try {
        const response = await axios.get(currentUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'SiteMapper Pro 1.0 - Website Analysis Tool'
          }
        });

        const $ = cheerio.load(response.data);
        const title = $('title').text().trim();
        const pageType = this.determinePageType(currentUrl, title);

        pages.push({
          url: currentUrl,
          title,
          type: pageType,
          statusCode: response.status
        });

        // Extract more links to crawl
        $('a[href]').each((_, element) => {
          const href = $(element).attr('href');
          if (href) {
            const absoluteUrl = this.resolveUrl(href, currentUrl);
            if (this.shouldCrawlUrl(absoluteUrl)) {
              toVisit.push(absoluteUrl);
            }
          }
        });

      } catch (error) {
        console.error(`Error crawling ${currentUrl}:`, error);
        pages.push({
          url: currentUrl,
          statusCode: axios.isAxiosError(error) ? error.response?.status : 0
        });
      }
    }

    return pages;
  }

  private async parseSitemap(websiteUrl: string, isIndividualSitemap = false): Promise<CrawledPage[]> {
    // Prevent infinite recursion
    if (this.sitemapDepth >= this.MAX_SITEMAP_DEPTH) {
      console.log(`Maximum sitemap depth reached (${this.MAX_SITEMAP_DEPTH}), stopping recursion`);
      return [];
    }

    const sitemapUrls = isIndividualSitemap 
      ? [websiteUrl] // If this is an individual sitemap URL, use it directly
      : [
          `${this.baseUrl}/sitemap.xml`,
          `${this.baseUrl}/sitemap_index.xml`,
          `${this.baseUrl}/sitemap-index.xml`,
          `${this.baseUrl}/sitemaps.xml`
        ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        console.log(`Trying to fetch sitemap: ${sitemapUrl}`);
        const response = await axios.get(sitemapUrl, { timeout: 10000 });
        const $ = cheerio.load(response.data, { xmlMode: true });
        
        const urls: string[] = [];
        
        // Handle sitemap index files
        $('sitemap > loc').each((_, element) => {
          const sitemapLocation = $(element).text().trim();
          if (sitemapLocation) {
            urls.push(sitemapLocation);
          }
        });

        // Handle individual sitemap files
        $('url > loc').each((_, element) => {
          const url = $(element).text().trim();
          if (url && this.shouldCrawlUrl(url)) {
            urls.push(url);
          }
        });

        if (urls.length > 0) {
          // For sitemap index, we need to fetch individual sitemaps
          if ($('sitemap').length > 0 && !isIndividualSitemap) {
            console.log(`Found sitemap index with ${urls.length} sitemaps`);
            const allPages: CrawledPage[] = [];
            this.sitemapDepth++; // Increase depth before recursion
            
            for (const individualSitemapUrl of urls.slice(0, 5)) { // Limit to 5 sitemaps
              try {
                console.log(`Parsing individual sitemap: ${individualSitemapUrl}`);
                const individualPages = await this.parseSitemap(individualSitemapUrl, true);
                allPages.push(...individualPages);
                
                // Limit total pages from sitemap parsing
                if (allPages.length >= 500) {
                  console.log(`Reached sitemap page limit (500), stopping`);
                  break;
                }
              } catch (error) {
                console.error(`Error parsing individual sitemap ${individualSitemapUrl}:`, error);
              }
            }
            
            this.sitemapDepth--; // Decrease depth after recursion
            return allPages;
          }

          // Convert URLs to CrawledPage objects
          console.log(`Found ${urls.length} URLs in sitemap`);
          return urls.map(url => ({
            url,
            title: '',
            type: this.determinePageType(url, ''),
            statusCode: 200
          }));
        }
      } catch (error) {
        console.error(`Error fetching sitemap ${sitemapUrl}:`, error);
      }
    }

    console.log('No valid sitemap found, will fallback to manual crawling');
    return [];
  }

  private resolveUrl(href: string, currentUrl: string): string {
    try {
      return new URL(href, currentUrl).href;
    } catch {
      return '';
    }
  }

  private shouldCrawlUrl(url: string): boolean {
    if (!url) return false;
    
    try {
      const parsedUrl = new URL(url);
      
      // Only crawl same domain
      if (parsedUrl.origin !== this.baseUrl) return false;
      
      // Skip files and non-HTML content
      const path = parsedUrl.pathname.toLowerCase();
      const skipExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.xml', '.txt', '.ico'];
      if (skipExtensions.some(ext => path.endsWith(ext))) return false;
      
      // Skip admin and system paths
      const skipPaths = ['/wp-admin', '/admin', '/api', '/wp-content', '/wp-includes'];
      if (skipPaths.some(skipPath => path.startsWith(skipPath))) return false;
      
      return true;
    } catch {
      return false;
    }
  }

  private determinePageType(url: string, title: string): string {
    const path = new URL(url).pathname.toLowerCase();
    const titleLower = title.toLowerCase();

    if (path === '/' || path === '/home') return 'homepage';
    if (path.includes('/about') || titleLower.includes('about')) return 'about';
    if (path.includes('/contact') || titleLower.includes('contact')) return 'contact';
    if (path.includes('/product') || titleLower.includes('product')) return 'product';
    if (path.includes('/service') || titleLower.includes('service')) return 'service';
    if (path.includes('/blog') || path.includes('/news') || titleLower.includes('blog')) return 'blog';
    if (path.includes('/portfolio') || titleLower.includes('portfolio')) return 'portfolio';
    if (path.includes('/team') || titleLower.includes('team')) return 'team';
    if (path.includes('/pricing') || titleLower.includes('pricing')) return 'pricing';

    return 'page';
  }
}

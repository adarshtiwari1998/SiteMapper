import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface PageSection {
  type: 'heading' | 'content' | 'list' | 'table' | 'form' | 'navigation';
  level?: number; // For headings (h1, h2, etc.)
  title: string;
  content: string;
  position: number;
}

export interface PageImage {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  position: number;
}

export interface CrawledPage {
  url: string;
  title?: string;
  type?: string;
  statusCode?: number;
  // Deep analysis data
  sections?: PageSection[];
  images?: PageImage[];
  metaDescription?: string;
  headings?: { level: number; text: string }[];
  contentSummary?: string;
  pageStructure?: string;
}

export interface CrawlOptions {
  maxPages: number;
  includeImages: boolean;
  deepAnalysis: boolean;
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

        const pageData: CrawledPage = {
          url: currentUrl,
          title,
          type: pageType,
          statusCode: response.status
        };

        // Perform deep analysis if enabled
        if (options.deepAnalysis) {
          pageData.sections = this.extractPageSections($);
          pageData.metaDescription = $('meta[name="description"]').attr('content') || '';
          pageData.headings = this.extractHeadings($);
          pageData.contentSummary = this.generateContentSummary($);
          pageData.pageStructure = this.analyzePageStructure($);
        }

        // Extract images if enabled
        if (options.includeImages) {
          pageData.images = this.extractImages($, currentUrl);
        }

        pages.push(pageData);

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

  private extractPageSections($: cheerio.CheerioAPI): PageSection[] {
    const sections: PageSection[] = [];
    let position = 0;

    // Extract headings and their content
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const $el = $(element);
      const level = parseInt(element.tagName.charAt(1));
      const title = $el.text().trim();
      
      // Get content after this heading until the next heading of same or higher level
      let content = '';
      let $next = $el.next();
      while ($next.length && !$next.is(`h1, h2, h3, h4, h5, h6`)) {
        if ($next.is('p, div, span, ul, ol, li')) {
          content += $next.text().trim() + ' ';
        }
        $next = $next.next();
      }

      sections.push({
        type: 'heading',
        level,
        title,
        content: content.trim(),
        position: position++
      });
    });

    // Extract main content areas
    $('main, article, .content, .main-content, #content').each((_, element) => {
      const $el = $(element);
      const content = $el.text().trim();
      if (content.length > 50) {
        sections.push({
          type: 'content',
          title: 'Main Content',
          content: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
          position: position++
        });
      }
    });

    // Extract navigation
    $('nav, .navigation, .nav, .menu').each((_, element) => {
      const $el = $(element);
      const links = $el.find('a').map((_, link) => $(link).text().trim()).get().join(', ');
      if (links) {
        sections.push({
          type: 'navigation',
          title: 'Navigation',
          content: links,
          position: position++
        });
      }
    });

    // Extract lists
    $('ul, ol').each((_, element) => {
      const $el = $(element);
      const listItems = $el.find('li').map((_, li) => $(li).text().trim()).get();
      if (listItems.length > 0) {
        sections.push({
          type: 'list',
          title: 'List',
          content: listItems.join('; '),
          position: position++
        });
      }
    });

    return sections;
  }

  private extractImages($: cheerio.CheerioAPI, currentUrl: string): PageImage[] {
    const images: PageImage[] = [];
    let position = 0;

    $('img').each((_, element) => {
      const $img = $(element);
      const src = $img.attr('src');
      if (src) {
        const absoluteSrc = this.resolveUrl(src, currentUrl);
        images.push({
          src: absoluteSrc,
          alt: $img.attr('alt') || '',
          title: $img.attr('title') || '',
          width: parseInt($img.attr('width') || '0') || undefined,
          height: parseInt($img.attr('height') || '0') || undefined,
          position: position++
        });
      }
    });

    return images;
  }

  private extractHeadings($: cheerio.CheerioAPI): { level: number; text: string }[] {
    const headings: { level: number; text: string }[] = [];
    
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const level = parseInt(element.tagName.charAt(1));
      const text = $(element).text().trim();
      if (text) {
        headings.push({ level, text });
      }
    });

    return headings;
  }

  private generateContentSummary($: cheerio.CheerioAPI): string {
    // Extract main content from various selectors
    const contentSelectors = [
      'main p',
      'article p', 
      '.content p',
      '.main-content p',
      '#content p',
      'p'
    ];

    let content = '';
    for (const selector of contentSelectors) {
      const text = $(selector).first().text().trim();
      if (text.length > 100) {
        content = text;
        break;
      }
    }

    // If no good content found, try to get any meaningful text
    if (!content) {
      content = $('body').text().replace(/\s+/g, ' ').trim();
    }

    // Return first 300 characters
    return content.length > 300 ? content.substring(0, 300) + '...' : content;
  }

  private analyzePageStructure($: cheerio.CheerioAPI): string {
    const structure: string[] = [];
    
    // Count different elements
    const headings = $('h1, h2, h3, h4, h5, h6').length;
    const paragraphs = $('p').length;
    const images = $('img').length;
    const links = $('a').length;
    const forms = $('form').length;
    const tables = $('table').length;
    const lists = $('ul, ol').length;

    if (headings > 0) structure.push(`${headings} headings`);
    if (paragraphs > 0) structure.push(`${paragraphs} paragraphs`);
    if (images > 0) structure.push(`${images} images`);
    if (links > 0) structure.push(`${links} links`);
    if (forms > 0) structure.push(`${forms} forms`);
    if (tables > 0) structure.push(`${tables} tables`);
    if (lists > 0) structure.push(`${lists} lists`);

    return structure.join(', ');
  }
}

import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import { GLMService } from './glm-api';

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
  // AI-enhanced analysis
  aiAnalysis?: any;
  detectedPlatform?: string;
  hasElementor?: boolean;
  completeContent?: string;
}

export interface CrawlOptions {
  maxPages: number;
  includeImages: boolean;
  deepAnalysis: boolean;
  useAI?: boolean;
  glmApiKey?: string;
  onPageProcessed?: (page: CrawledPage, processedCount: number, totalFound: number) => Promise<void>;
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

    // Initialize AI service if enabled
    let glmService: GLMService | undefined;
    if (options.useAI && options.glmApiKey) {
      glmService = new GLMService(options.glmApiKey);
      console.log('🤖 AI-powered analysis enabled for deep content extraction');
    }

    // First try to get sitemap.xml
    const sitemapPages = await this.parseSitemap(websiteUrl);
    if (sitemapPages.length > 0) {
      console.log(`Found ${sitemapPages.length} pages from sitemap, starting intelligent analysis...`);
      
      // Process sitemap pages with AI-enhanced analysis
      const processedPages: CrawledPage[] = [];
      const pagesToProcess = sitemapPages.slice(0, options.maxPages);
      
      for (const sitemapPage of pagesToProcess) {
        try {
          const response = await axios.get(sitemapPage.url, {
            timeout: 60000, // Extended timeout for comprehensive AI analysis
            headers: {
              'User-Agent': 'SiteMapper Pro 1.0 - AI Website Analysis Tool'
            },
            maxRedirects: 5,
            validateStatus: function (status) {
              return status >= 200 && status < 400;
            }
          });

          const $ = cheerio.load(response.data);
          const title = $('title').text().trim();
          const pageType = this.determinePageType(sitemapPage.url, title);

          const pageData: CrawledPage = {
            url: sitemapPage.url,
            title,
            type: pageType,
            statusCode: response.status
          };

          // ENHANCED ANALYSIS - Use AI only for structure analysis, not content rewriting
          if (options.useAI && glmService && options.deepAnalysis) {
            try {
              console.log(`🤖 Running AI structure analysis for: ${sitemapPage.url}`);
              
              // First extract exact content without AI rewriting
              pageData.completeContent = this.extractExactContentInOrder($, sitemapPage.url);
              console.log(`📝 Extracted ${pageData.completeContent?.length || 0} characters of exact content`);
              
              // Then use AI only for structure analysis and summary
              const aiAnalysis = await glmService.analyzePageStructureOnly(sitemapPage.url, title, response.data);
              
              pageData.aiAnalysis = aiAnalysis;
              pageData.detectedPlatform = aiAnalysis.detectedPlatform;
              pageData.hasElementor = aiAnalysis.hasElementor;
              pageData.contentSummary = aiAnalysis.summary;
              
              // Create sections from the exact content (not AI-rewritten)
              pageData.sections = this.createSectionsFromExactContent($);
              
              console.log(`✅ Analysis completed for: ${sitemapPage.url}`);
            } catch (aiError) {
              console.error(`⚠️ AI analysis failed for ${sitemapPage.url}, using traditional extraction:`, aiError);
              // Fallback to traditional analysis
              await this.performTraditionalAnalysis(pageData, $, options, sitemapPage.url);
            }
          } else {
            // Traditional analysis if AI is not enabled
            await this.performTraditionalAnalysis(pageData, $, options, sitemapPage.url);
          }

          processedPages.push(pageData);
          console.log(`📊 Processed page ${processedPages.length}/${pagesToProcess.length}: ${sitemapPage.url}`);
          
        } catch (error) {
          console.error(`Error processing sitemap page ${sitemapPage.url}:`, error);
          
          // Add failed page with error info
          processedPages.push({
            url: sitemapPage.url,
            title: 'Failed to load',
            statusCode: axios.isAxiosError(error) ? error.response?.status || 0 : 0,
            contentSummary: 'Page could not be analyzed due to loading error'
          });
        }
      }
      
      return processedPages;
    }

    // Fallback to manual crawling
    while (toVisit.length > 0 && pages.length < options.maxPages) {
      const currentUrl = toVisit.shift()!;
      
      if (this.visited.has(currentUrl)) continue;
      this.visited.add(currentUrl);

      try {
        const response = await axios.get(currentUrl, {
          timeout: 30000, // Increased timeout
          headers: {
            'User-Agent': 'SiteMapper Pro 1.0 - Website Analysis Tool'
          },
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 400;
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
        
        // Still add the page but with error status
        const errorPage: CrawledPage = {
          url: currentUrl,
          statusCode: axios.isAxiosError(error) ? error.response?.status || 0 : 0,
          title: 'Failed to load',
          contentSummary: 'Page could not be analyzed due to loading error'
        };
        
        pages.push(errorPage);
        
        // Continue processing other pages instead of stopping
        continue;
      }
    }

    return pages;
  }

  async crawlWebsiteWithRealTimeUpdates(websiteUrl: string, options: CrawlOptions): Promise<CrawledPage[]> {
    console.log('🚀 Starting REAL-TIME website crawling with live updates...');
    
    this.visited.clear();
    this.baseUrl = new URL(websiteUrl).origin;
    this.sitemapDepth = 0;
    
    // Initialize AI service if enabled
    let glmService: GLMService | undefined;
    if (options.useAI && options.glmApiKey) {
      glmService = new GLMService(options.glmApiKey);
      console.log('🤖 AI-powered real-time analysis enabled');
    }

    // Get sitemap pages first
    const sitemapPages = await this.parseSitemap(websiteUrl);
    if (sitemapPages.length === 0) {
      console.log('⚠️ No sitemap found, fallback to manual crawling');
      // Fallback to original crawling method
      return this.crawlWebsite(websiteUrl, options);
    }

    console.log(`📊 Found ${sitemapPages.length} pages in sitemap, processing with real-time updates...`);
    
    const processedPages: CrawledPage[] = [];
    const pagesToProcess = sitemapPages.slice(0, options.maxPages);
    let processedCount = 0;
    
    // Process pages one by one with real-time updates
    for (const sitemapPage of pagesToProcess) {
      try {
        console.log(`🔄 Processing page ${processedCount + 1}/${pagesToProcess.length}: ${sitemapPage.url}`);
        
        const response = await axios.get(sitemapPage.url, {
          timeout: 60000,
          headers: {
            'User-Agent': 'SiteMapper Pro 1.0 - Real-time AI Analysis Tool'
          },
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 400;
          }
        });

        const $ = cheerio.load(response.data);
        const title = $('title').text().trim();
        const pageType = this.determinePageType(sitemapPage.url, title);

        const pageData: CrawledPage = {
          url: sitemapPage.url,
          title,
          type: pageType,
          statusCode: response.status
        };

        // ENHANCED ANALYSIS with real-time processing
        if (options.useAI && glmService && options.deepAnalysis) {
          try {
            console.log(`🤖 Running real-time AI structure analysis for: ${sitemapPage.url}`);
            
            // First extract exact content without AI rewriting
            pageData.completeContent = this.extractExactContentInOrder($, sitemapPage.url);
            console.log(`📝 Extracted ${pageData.completeContent?.length || 0} characters of exact content`);
            
            // Then use AI only for structure analysis and summary
            const aiAnalysis = await glmService.analyzePageStructureOnly(sitemapPage.url, title, response.data);
            
            pageData.aiAnalysis = aiAnalysis;
            pageData.detectedPlatform = aiAnalysis.detectedPlatform;
            pageData.hasElementor = aiAnalysis.hasElementor;
            pageData.contentSummary = aiAnalysis.summary;
            
            // Create sections from the exact content (not AI-rewritten)
            pageData.sections = this.createSectionsFromExactContent($);
            
            console.log(`✅ Analysis completed - Content length: ${pageData.completeContent?.length || 0} chars`);
          } catch (aiError) {
            console.error(`⚠️ AI analysis failed for ${sitemapPage.url}, using traditional extraction:`, aiError);
            await this.performTraditionalAnalysis(pageData, $, options, sitemapPage.url);
          }
        } else {
          // Traditional analysis if AI is not enabled
          await this.performTraditionalAnalysis(pageData, $, options, sitemapPage.url);
        }

        processedPages.push(pageData);
        processedCount++;
        
        // REAL-TIME UPDATE: Call callback to save page immediately
        if (options.onPageProcessed) {
          try {
            await options.onPageProcessed(pageData, processedCount, pagesToProcess.length);
            console.log(`💾 Real-time update sent for page ${processedCount}/${pagesToProcess.length}`);
          } catch (callbackError) {
            console.error('Error in real-time callback:', callbackError);
            // Continue processing even if callback fails
          }
        }
        
        console.log(`✅ Completed page ${processedCount}/${pagesToProcess.length}: ${sitemapPage.url}`);
        
      } catch (error) {
        console.error(`⚠️ Error processing page ${sitemapPage.url}:`, error);
        
        // Add failed page
        const errorPage: CrawledPage = {
          url: sitemapPage.url,
          title: 'Failed to load',
          statusCode: axios.isAxiosError(error) ? error.response?.status || 0 : 0,
          contentSummary: 'Page could not be analyzed due to loading error'
        };
        
        processedPages.push(errorPage);
        processedCount++;
        
        // Still call the callback for failed pages
        if (options.onPageProcessed) {
          try {
            await options.onPageProcessed(errorPage, processedCount, pagesToProcess.length);
          } catch (callbackError) {
            console.error('Error in real-time callback for failed page:', callbackError);
          }
        }
      }
    }
    
    console.log(`✅ Real-time crawling completed! Processed ${processedCount} pages`);
    return processedPages;
  }

  private async performTraditionalAnalysis(pageData: CrawledPage, $: cheerio.CheerioAPI, options: CrawlOptions, url: string): Promise<void> {
    // Perform traditional deep analysis if enabled
    if (options.deepAnalysis) {
      pageData.sections = this.extractPageSections($);
      pageData.metaDescription = $('meta[name="description"]').attr('content') || '';
      pageData.headings = this.extractHeadings($);
      pageData.contentSummary = this.generateContentSummary($);
      pageData.pageStructure = this.analyzePageStructure($);
      
      // Extract complete content in exact HTML order without AI rewriting
      pageData.completeContent = this.extractExactContentInOrder($, url);
    }

    // Extract images if enabled
    if (options.includeImages) {
      pageData.images = this.extractImages($, url);
    }
  }

  private formatActualContent(extractedContent: any): string {
    let content = '';
    
    console.log('🔄 Formatting actual extracted content for display...');
    
    // Add title if available
    if (extractedContent.title) {
      content += `PAGE TITLE: ${extractedContent.title}\n\n`;
    }
    
    // Add the complete full content if available
    if (extractedContent.fullContent && extractedContent.fullContent.trim()) {
      content += `COMPLETE PAGE CONTENT:\n${extractedContent.fullContent}\n\n`;
    }
    
    // Add organized sections with actual content
    if (extractedContent.sections && extractedContent.sections.length > 0) {
      content += 'ORGANIZED CONTENT SECTIONS:\n\n';
      extractedContent.sections.forEach((section: any, index: number) => {
        const sectionTitle = section.heading || `Content Section ${index + 1}`;
        const sectionContent = section.content || 'No content found';
        
        content += `● ${sectionTitle}\n`;
        content += `${sectionContent}\n\n`;
        
        // Add separator between sections
        if (index < extractedContent.sections.length - 1) {
          content += '---\n\n';
        }
      });
    }
    
    // Add any additional content if main sections are empty
    if ((!extractedContent.sections || extractedContent.sections.length === 0) && 
        (!extractedContent.fullContent || extractedContent.fullContent.trim().length === 0)) {
      content += 'NO DETAILED CONTENT EXTRACTED - Please check page accessibility or try different extraction method.';
    }
    
    const finalContent = content.trim();
    console.log(`📝 Generated content length: ${finalContent.length} characters`);
    
    return finalContent;
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
      
      // Skip fragment URLs (#id) - these are not real pages
      if (parsedUrl.hash) return false;
      
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

    // 1. Extract header content as separate entry
    this.extractHeaderContent($, sections, position);
    position = sections.length;

    // 2. Extract main content from <main> elements with full detail
    this.extractMainContent($, sections, position);
    position = sections.length;

    // 3. Extract footer content as separate entry
    this.extractFooterContent($, sections, position);
    
    return sections;
  }

  private extractHeaderContent($: cheerio.CheerioAPI, sections: PageSection[], startPosition: number): void {
    let position = startPosition;
    
    $('header, .header, #header, #site-header, .site-header').first().each((_, element) => {
      const $header = $(element);
      
      // Extract navigation links cleanly with deduplication
      const navLinksSet = new Set<string>();
      $header.find('a, .menu-item').each((_, linkEl) => {
        const linkText = $(linkEl).text().trim();
        if (linkText && linkText.length > 1 && linkText.length < 50) {
          navLinksSet.add(linkText);
        }
      });
      const navLinks = Array.from(navLinksSet);
      
      // Extract header text content (excluding navigation)
      let headerText = $header.clone().find('nav, .nav, .menu').remove().end().text().trim().replace(/\s+/g, ' ');
      
      if (navLinks.length > 0 || headerText.length > 10) {
        const content = [
          headerText ? `Header Text: ${headerText}` : '',
          navLinks.length > 0 ? `Navigation: ${navLinks.join(' | ')}` : ''
        ].filter(Boolean).join('\n');
        
        sections.push({
          type: 'navigation',
          title: '🔝 HEADER SECTION',
          content: content,
          position: position++
        });
      }
    });
  }

  private extractMainContent($: cheerio.CheerioAPI, sections: PageSection[], startPosition: number): void {
    let position = startPosition;
    
    // Target main content areas specifically
    const mainSelectors = [
      'main#main', 
      'main.site-main', 
      'main[role="main"]',
      'main',
      '.main-content',
      '#main-content',
      '.entry-content',
      '.post-content',
      'article .content'
    ];
    
    for (const selector of mainSelectors) {
      const $main = $(selector).first();
      if ($main.length > 0) {
        console.log(`Extracting content from: ${selector}`);
        
        // SPECIFICALLY target Elementor structure: headings + their content containers
        $main.find('h1, h2, h3, h4, h5, h6').each((_, headingEl) => {
          const $heading = $(headingEl);
          const level = parseInt(headingEl.tagName.charAt(1));
          const title = $heading.text().trim();
          
          if (title && !title.toLowerCase().includes('about us') && !title.toLowerCase().includes('quick links')) {
            let content = '';
            let images: string[] = [];
            
            console.log(`Processing heading: ${title}`);
            
            // For Elementor: Look for the next elementor-widget-container or similar content containers
            let $next = $heading.parent().next();
            let attempts = 0;
            
            // Search through multiple next siblings to find content
            while ($next.length && attempts < 5) {
              attempts++;
              
              // Target Elementor content containers specifically
              const $contentContainer = $next.find('.elementor-widget-container, .elementor-text-editor');
              if ($contentContainer.length > 0) {
                $contentContainer.each((_, container) => {
                  const $container = $(container);
                  
                  // Extract list items, paragraphs, and text content
                  const listItems: string[] = [];
                  $container.find('li').each((_, li) => {
                    const itemText = $(li).text().trim();
                    if (itemText && itemText.length > 2) {
                      listItems.push(`• ${itemText}`);
                    }
                  });
                  
                  // Extract paragraph content
                  const paragraphs: string[] = [];
                  $container.find('p').each((_, p) => {
                    const pText = $(p).text().trim();
                    if (pText && pText.length > 10) {
                      paragraphs.push(pText);
                    }
                  });
                  
                  // Combine list items and paragraphs
                  if (listItems.length > 0) {
                    content += listItems.join('\n') + '\n';
                  }
                  if (paragraphs.length > 0) {
                    content += paragraphs.join('\n\n') + '\n';
                  }
                  
                  // If no lists or paragraphs, get any text content
                  if (listItems.length === 0 && paragraphs.length === 0) {
                    const rawText = $container.text().trim();
                    if (rawText && rawText.length > 10) {
                      content += rawText + '\n';
                    }
                  }
                });
              }
              
              // Extract images from this container and nearby elements
              $next.find('img').each((_, imgEl) => {
                const $img = $(imgEl);
                const src = $img.attr('src');
                const alt = $img.attr('alt') || 'Image';
                if (src) {
                  const fullSrc = src.startsWith('http') ? src : `https://www.ssfplastics.com${src}`;
                  images.push(`🖼️ ${alt}: ${fullSrc}`);
                }
              });
              
              $next = $next.next();
              if (content.length > 2000) break;
            }
            
            // Also check the heading's parent container for nearby content
            const $headingParent = $heading.closest('.elementor-element, .elementor-container');
            if ($headingParent.length > 0) {
              $headingParent.find('.elementor-widget-container').not($heading.closest('.elementor-widget-container')).each((_, container) => {
                const $container = $(container);
                const containerText = $container.text().trim();
                if (containerText && containerText.length > 10 && !content.includes(containerText)) {
                  // Check for lists
                  const listItems: string[] = [];
                  $container.find('li').each((_, li) => {
                    const itemText = $(li).text().trim();
                    if (itemText && itemText.length > 2) {
                      listItems.push(`• ${itemText}`);
                    }
                  });
                  
                  if (listItems.length > 0) {
                    content += listItems.join('\n') + '\n';
                  } else {
                    content += containerText + '\n';
                  }
                }
              });
            }
            
            // Clean up content and format properly
            content = content.trim().replace(/\n\s*\n+/g, '\n').replace(/\s+/g, ' ');
            
            // Combine content with inline images
            let fullContent = '';
            if (content && content.length > 10) {
              fullContent = content;
              
              // Add images inline with content, not at the end
              if (images.length > 0) {
                fullContent += '\n\n' + images.join('\n');
              }
            } else {
              fullContent = images.length > 0 ? images.join('\n') : 'No detailed content found for this section';
            }
            
            console.log(`Content found for ${title}: ${fullContent.substring(0, 100)}...`);
            
            sections.push({
              type: 'heading',
              level,
              title: `📝 ${title}`,
              content: fullContent,
              position: position++
            });
          }
        });
        
        break; // Found main content, stop looking
      }
    }
  }

  private extractFooterContent($: cheerio.CheerioAPI, sections: PageSection[], startPosition: number): void {
    let position = startPosition;
    
    $('footer, .footer, #footer, .site-footer').first().each((_, element) => {
      const $footer = $(element);
      
      // Extract only actual footer content, not navigation links that belong to main content
      let footerText = '';
      
      // Get copyright, contact info, but skip main navigation
      $footer.contents().each((_, node) => {
        const $node = $(node);
        if ($node.is('p, div') && !$node.find('a').length) {
          const text = $node.text().trim();
          if (text.includes('©') || text.includes('copyright') || text.includes('@') || text.includes('+91')) {
            footerText += text + ' ';
          }
        }
      });
      
      footerText = footerText.trim().replace(/\s+/g, ' ');
      
      if (footerText && footerText.length > 20) {
        sections.push({
          type: 'navigation',
          title: '🔽 FOOTER SECTION',
          content: this.truncateText(footerText, 300),
          position: position++
        });
      }
    });
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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

  /**
   * Extract content exactly as it appears in HTML in correct top-to-bottom order
   * WITHOUT any AI rewriting or modification - ENHANCED FOR 100% ACCURACY
   */
  private extractExactContentInOrder($: cheerio.CheerioAPI, url: string): string {
    console.log(`🔍 Extracting exact content in HTML order for: ${url}`);
    
    const content: string[] = [];
    const processedElements = new Set<string>();
    
    // Extract navigation elements first (header/nav)
    const navigationContent = this.extractNavigationElements($, url);
    if (navigationContent) {
      content.push(`\n🧭 === NAVIGATION ELEMENTS ===\n${navigationContent}\n`);
    }
    
    // Enhanced extraction - walk through body elements in order and get ALL text content
    this.walkElementsInOrder($('body').first(), $, content, processedElements, url);
    
    const finalContent = content.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    console.log(`📝 Extracted ${finalContent.length} characters of exact content`);
    
    return finalContent;
  }

  /**
   * Recursively walk through elements to extract ALL content including nested ul/li and div children
   */
  private walkElementsInOrder(
    $parent: any, 
    $: cheerio.CheerioAPI, 
    content: string[], 
    processedElements: Set<string>,
    url: string
  ): void {
    $parent.children().each((_, element) => {
      const $el = $(element);
      const tagName = element.tagName?.toLowerCase();
      
      // Skip script, style, and other non-content elements
      if (['script', 'style', 'noscript', 'meta', 'link', 'head', 'nav', 'header'].includes(tagName || '')) {
        return;
      }
      
      // Handle different element types for 100% extraction accuracy
      if (tagName === 'ul' || tagName === 'ol') {
        this.extractListContent($el, content, processedElements, tagName);
      } else if (tagName === 'div') {
        this.extractDivContent($el, $, content, processedElements, url);
      } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName || '')) {
        this.extractHeadingContent($el, content, processedElements, tagName);
      } else if (tagName === 'p') {
        this.extractParagraphContent($el, content, processedElements);
      } else if (tagName === 'img') {
        this.extractImageContent($el, content, url);
      } else if (tagName === 'table') {
        this.extractTableContent($el, content, processedElements);
      } else {
        // Extract any other text content
        const allText = $el.text().trim();
        if (allText && allText.length > 10) {
          const elementId = `${tagName}_${allText.substring(0, 30)}`;
          if (!processedElements.has(elementId)) {
            content.push(`${allText}`);
            processedElements.add(elementId);
          }
        }
      }
      
      // Recursively process children for complete extraction
      this.walkElementsInOrder($el, $, content, processedElements, url);
    });
  }

  /**
   * Extract navigation elements separately for better organization
   */
  private extractNavigationElements($: cheerio.CheerioAPI, url: string): string {
    const navContent: string[] = [];
    
    // Extract header and navigation elements
    $('header, nav, .header, .navigation, .navbar, .menu').each((_, element) => {
      const $el = $(element);
      const text = $el.text().trim();
      
      if (text && text.length > 10) {
        navContent.push(text);
      }
      
      // Extract navigation links
      $el.find('a').each((_, link) => {
        const $link = $(link);
        const linkText = $link.text().trim();
        const href = $link.attr('href');
        
        if (linkText && linkText.length > 2) {
          if (href) {
            const absoluteHref = href.startsWith('http') ? href : new URL(href, url).href;
            navContent.push(`📎 ${linkText} → ${absoluteHref}`);
          } else {
            navContent.push(`📎 ${linkText}`);
          }
        }
      });
    });
    
    return navContent.join('\n');
  }

  /**
   * Extract ul/ol lists with proper bullet formatting
   */
  private extractListContent($el: any, content: string[], processedElements: Set<string>, tagName: string): void {
    const listItems: string[] = [];
    
    $el.find('li').each((index, item) => {
      const $item = $el.find('li').eq(index);
      const itemText = $item.text().trim();
      
      if (itemText && itemText.length > 2) {
        const bullet = tagName === 'ul' ? '•' : `${index + 1}.`;
        listItems.push(`  ${bullet} ${itemText}`);
      }
    });
    
    if (listItems.length > 0) {
      const listId = `list_${listItems[0].substring(0, 30)}`;
      if (!processedElements.has(listId)) {
        content.push(`\n📋 === ${tagName.toUpperCase()} LIST ===\n${listItems.join('\n')}\n`);
        processedElements.add(listId);
      }
    }
  }

  /**
   * Extract div content including all nested children
   */
  private extractDivContent($el: any, $: cheerio.CheerioAPI, content: string[], processedElements: Set<string>, url: string): void {
    // Get all text content from div and its children
    const divText = $el.text().trim();
    
    if (divText && divText.length > 20) {
      const divId = `div_${divText.substring(0, 30)}`;
      if (!processedElements.has(divId)) {
        // Check if div has specific content structure
        const hasHeadings = $el.find('h1, h2, h3, h4, h5, h6').length > 0;
        const hasList = $el.find('ul, ol').length > 0;
        const hasImages = $el.find('img').length > 0;
        
        if (hasHeadings || hasList || hasImages) {
          content.push(`\n📦 === DIV SECTION ===\n${divText}\n`);
        } else {
          content.push(`${divText}`);
        }
        processedElements.add(divId);
      }
    }
  }

  /**
   * Extract heading content with proper formatting
   */
  private extractHeadingContent($el: any, content: string[], processedElements: Set<string>, tagName: string): void {
    const headingText = $el.text().trim();
    
    if (headingText && headingText.length > 2) {
      const headingId = `${tagName}_${headingText.substring(0, 30)}`;
      if (!processedElements.has(headingId)) {
        content.push(`\n=== ${tagName?.toUpperCase()} HEADING ===\n${headingText}\n`);
        processedElements.add(headingId);
      }
    }
  }

  /**
   * Extract paragraph content
   */
  private extractParagraphContent($el: any, content: string[], processedElements: Set<string>): void {
    const paragraphText = $el.text().trim();
    
    if (paragraphText && paragraphText.length > 10) {
      const paragraphId = `p_${paragraphText.substring(0, 30)}`;
      if (!processedElements.has(paragraphId)) {
        content.push(`\n${paragraphText}\n`);
        processedElements.add(paragraphId);
      }
    }
  }

  /**
   * Extract image content with enhanced formatting
   */
  private extractImageContent($el: any, content: string[], url: string): void {
    const src = $el.attr('src');
    const alt = $el.attr('alt') || 'No alt text';
    const title = $el.attr('title') || '';
    
    if (src) {
      // Resolve relative URLs
      const absoluteSrc = src.startsWith('http') ? src : new URL(src, url).href;
      content.push(`\n🖼️ IMAGE: ${alt}\n📷 URL: ${absoluteSrc}${title ? `\n📝 Title: ${title}` : ''}\n`);
    }
  }

  /**
   * Extract table content with structure
   */
  private extractTableContent($el: any, content: string[], processedElements: Set<string>): void {
    const tableText = $el.text().trim();
    
    if (tableText && tableText.length > 20) {
      const tableId = `table_${tableText.substring(0, 30)}`;
      if (!processedElements.has(tableId)) {
        content.push(`\n📊 === TABLE CONTENT ===\n${tableText}\n`);
        processedElements.add(tableId);
      }
    }
  }

  /**
   * Create structured sections from exact HTML content without AI modification
   */
  private createSectionsFromExactContent($: cheerio.CheerioAPI): PageSection[] {
    const sections: PageSection[] = [];
    let position = 0;
    
    // Extract headings and their following content in order
    $('h1, h2, h3, h4, h5, h6').each((_, heading) => {
      const $heading = $(heading);
      const headingText = $heading.text().trim();
      const level = parseInt(heading.tagName?.charAt(1) || '1');
      
      if (headingText) {
        // Get all content until the next heading of same or higher level
        let sectionContent = '';
        let $next = $heading.next();
        
        while ($next.length > 0) {
          const nextTagName = $next.prop('tagName')?.toLowerCase();
          
          // Stop if we hit another heading of same or higher level
          if (nextTagName?.match(/^h[1-6]$/)) {
            const nextLevel = parseInt(nextTagName.charAt(1));
            if (nextLevel <= level) break;
          }
          
          const text = $next.text().trim();
          if (text && text.length > 10) {
            sectionContent += text + '\n';
          }
          
          $next = $next.next();
        }
        
        sections.push({
          type: 'heading',
          level,
          title: headingText,
          content: sectionContent.trim(),
          position: position++
        });
      }
    });
    
    // Extract standalone paragraphs not under headings
    $('p').each((_, p) => {
      const $p = $(p);
      const text = $p.text().trim();
      
      // Check if this paragraph is not already captured under a heading
      const hasParentHeading = $p.prevAll('h1, h2, h3, h4, h5, h6').length > 0;
      
      if (text && text.length > 20 && !hasParentHeading) {
        sections.push({
          type: 'content',
          title: 'Paragraph',
          content: text,
          position: position++
        });
      }
    });
    
    return sections;
  }
}
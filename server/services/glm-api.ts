import axios from 'axios';
import * as cheerio from 'cheerio';

export interface GLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface PageStructureAnalysis {
  detectedPlatform: 'wordpress' | 'shopify' | 'react' | 'static' | 'other';
  hasElementor: boolean;
  contentAreas: {
    header: string[];
    main: string[];
    footer: string[];
    sidebar?: string[];
  };
  extractedContent: {
    title: string;
    mainContent: string;
    images: string[];
    sections: Array<{
      heading: string;
      content: string;
      images: string[];
    }>;
  };
  summary: string;
}

export class GLMService {
  private apiKey: string;
  private baseUrl = 'https://api.z.ai/api/paas/v4';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async testConnection(): Promise<void> {
    try {
      await this.makeRequest([
        { role: 'user', content: 'Hello, please respond with "API test successful"' }
      ]);
    } catch (error) {
      throw new Error('GLM API connection test failed');
    }
  }

  async analyzePageContent(url: string, title: string): Promise<string> {
    try {
      const structureAnalysis = await this.deepAnalyzePageStructure(url, title);
      return structureAnalysis.summary;
    } catch (error) {
      console.error(`Error analyzing page ${url}:`, error);
      return 'Analysis failed - unable to process page content';
    }
  }

  /**
   * Analyze only page structure - DO NOT extract or rewrite content
   * Use this for getting AI insights about page architecture without content modification
   */
  async analyzePageStructureOnly(url: string, title: string, html: string): Promise<PageStructureAnalysis> {
    try {
      console.log(`🔍 Starting AI structure-only analysis for: ${url}`);
      
      const $ = cheerio.load(html);
      
      // Detect platform and architecture
      const platform = this.detectPlatform(html, $);
      const hasElementor = html.includes('elementor') || html.includes('Elementor');
      
      console.log(`🏗️ Detected platform: ${platform}, Elementor: ${hasElementor}`);
      
      // Analyze page structure with AI (no content extraction)
      const structureAnalysis = await this.analyzeStructureWithAI(url, title, html, platform);
      
      return {
        detectedPlatform: platform,
        hasElementor,
        contentAreas: structureAnalysis.contentAreas,
        extractedContent: {
          title: title || 'No title',
          mainContent: '', // No content extraction - this is handled separately
          images: [],
          sections: []
        },
        summary: structureAnalysis.summary
      };
    } catch (error) {
      console.error(`Error in structure analysis for ${url}:`, error);
      // Return fallback analysis
      return {
        detectedPlatform: 'other',
        hasElementor: false,
        contentAreas: { header: [], main: [], footer: [] },
        extractedContent: {
          title: title || 'No title',
          mainContent: '',
          images: [],
          sections: []
        },
        summary: 'Structure analysis failed - unable to process page'
      };
    }
  }

  async deepAnalyzePageStructure(url: string, title: string): Promise<PageStructureAnalysis> {
    try {
      console.log(`🔍 Starting deep AI analysis for: ${url}`);
      
      // Fetch page content with extended timeout
      const pageResponse = await axios.get(url, {
        timeout: 45000, // Increased timeout for complex pages
        headers: {
          'User-Agent': 'SiteMapper Pro 1.0 - AI Content Analyzer'
        },
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });

      const $ = cheerio.load(pageResponse.data);
      const html = pageResponse.data;
      
      // Detect platform and architecture
      const platform = this.detectPlatform(html, $);
      const hasElementor = html.includes('elementor') || html.includes('Elementor');
      
      console.log(`🏗️ Detected platform: ${platform}, Elementor: ${hasElementor}`);
      
      // Extract content using AI-guided approach
      const extractedContent = await this.extractContentWithAI(url, title, html, platform, hasElementor);
      
      // Analyze page structure with AI
      const structureAnalysis = await this.analyzeStructureWithAI(url, title, html, platform);
      
      return {
        detectedPlatform: platform,
        hasElementor,
        contentAreas: structureAnalysis.contentAreas,
        extractedContent,
        summary: structureAnalysis.summary
      };
    } catch (error) {
      console.error(`Error in deep analysis for ${url}:`, error);
      // Return fallback analysis
      return {
        detectedPlatform: 'other',
        hasElementor: false,
        contentAreas: { header: [], main: [], footer: [] },
        extractedContent: {
          title: title || 'No title',
          mainContent: 'Analysis failed - unable to process page content',
          images: [],
          sections: []
        },
        summary: 'Analysis failed - unable to process page content'
      };
    }
  }

  private detectPlatform(html: string, $: cheerio.CheerioAPI): 'wordpress' | 'shopify' | 'react' | 'static' | 'other' {
    if (html.includes('wp-content') || html.includes('wp-includes') || html.includes('/wp-json/')) {
      return 'wordpress';
    }
    if (html.includes('Shopify') || html.includes('shopify') || html.includes('cdn.shopify.com')) {
      return 'shopify';
    }
    if (html.includes('React') || html.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__') || html.includes('_next/')) {
      return 'react';
    }
    if ($('main, article, .content, #content').length > 0) {
      return 'static';
    }
    return 'other';
  }

  private async extractContentWithAI(url: string, title: string, html: string, platform: string, hasElementor: boolean): Promise<any> {
    console.log(`🤖 Using AI to extract ACTUAL CONTENT from ${platform} page...`);
    
    // Use Cheerio to pre-extract structured content for AI analysis
    const $ = cheerio.load(html);
    
    // Extract actual text content from key areas
    const contentAreas = this.extractActualContent($, platform, hasElementor);
    
    const prompt = `Extract and organize ALL the actual text content from this ${platform} webpage. DO NOT SUMMARIZE - return the complete actual content.

🌐 URL: ${url}
📄 Title: ${title}

📝 ACTUAL CONTENT FOUND:
${contentAreas.join('\n\n---\n\n')}

📋 REQUIREMENTS:
1. **RETURN REAL CONTENT**: Extract ALL actual text, paragraphs, lists, and content
2. **ORGANIZE BY SECTIONS**: Group content logically with clear headings
3. **INCLUDE EVERYTHING**: Don't skip any text content - include complete paragraphs, lists, descriptions
4. **NO STATISTICS**: Don't count elements - show the actual content

Return in this format:
{
  "title": "${title}",
  "sections": [
    {
      "heading": "Section name",
      "content": "Complete actual text content from this section with all paragraphs, lists, and details"
    }
  ],
  "fullContent": "All content combined as one continuous text"
}

⚠️ CRITICAL: Show ACTUAL CONTENT, not summaries or statistics!`;

    try {
      const response = await this.makeRequest([
        { role: 'user', content: prompt }
      ]);

      const aiResponse = response.choices[0]?.message?.content || '{}';
      
      // Try to parse JSON response
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log(`✅ AI extracted actual content with ${parsed.sections?.length || 0} sections from ${url}`);
          return parsed;
        }
      } catch (parseError) {
        console.log('📝 AI response was not JSON, using as raw content');
      }
      
      // Fallback: organize the AI response as content
      return {
        title: title || 'No title',
        sections: [{
          heading: 'Main Content',
          content: aiResponse
        }],
        fullContent: aiResponse
      };
    } catch (error) {
      console.error('Error in AI content extraction:', error);
      // Return actual extracted content even if AI fails
      return {
        title: title || 'No title',
        sections: [{
          heading: 'Extracted Content',
          content: contentAreas.join('\n\n')
        }],
        fullContent: contentAreas.join('\n\n')
      };
    }
  }

  private extractActualContent($: cheerio.CheerioAPI, platform: string, hasElementor: boolean): string[] {
    const contentAreas: string[] = [];
    
    console.log(`🔍 Extracting actual content from ${platform} page...`);
    
    // Extract header content
    const headerContent = this.extractHeaderContent($);
    if (headerContent) contentAreas.push(`HEADER CONTENT:\n${headerContent}`);
    
    // Extract main content based on platform
    const mainContent = this.extractMainContentText($, platform, hasElementor);
    if (mainContent.length > 0) {
      contentAreas.push(...mainContent);
    }
    
    // Extract footer content
    const footerContent = this.extractFooterContent($);
    if (footerContent) contentAreas.push(`FOOTER CONTENT:\n${footerContent}`);
    
    return contentAreas;
  }

  private extractHeaderContent($: cheerio.CheerioAPI): string {
    const headerSelectors = ['header', '.header', '#header', '.site-header', 'nav', '.navbar'];
    let content = '';
    
    for (const selector of headerSelectors) {
      const $header = $(selector).first();
      if ($header.length > 0) {
        const text = $header.text().trim().replace(/\s+/g, ' ');
        if (text && text.length > 20) {
          content += text + '\n';
        }
      }
    }
    
    return content.trim();
  }

  private extractMainContentText($: cheerio.CheerioAPI, platform: string, hasElementor: boolean): string[] {
    const contentSections: string[] = [];
    
    if (hasElementor || platform === 'wordpress') {
      // WordPress/Elementor specific extraction
      this.extractWordPressContent($, contentSections);
    } else if (platform === 'shopify') {
      // Shopify specific extraction
      this.extractShopifyContent($, contentSections);
    } else {
      // Generic content extraction
      this.extractGenericContent($, contentSections);
    }
    
    return contentSections;
  }

  private extractWordPressContent($: cheerio.CheerioAPI, contentSections: string[]): void {
    // Target WordPress and Elementor structures
    const selectors = [
      'main', '.main', '#main',
      '.entry-content', '.post-content', '.page-content',
      '.elementor-widget-container', '.elementor-text-editor',
      'article', '.content', '#content'
    ];
    
    const processedContent = new Set<string>();
    
    for (const selector of selectors) {
      $(selector).each((_, element) => {
        const $element = $(element);
        
        // Extract paragraphs
        $element.find('p').each((_, p) => {
          const text = $(p).text().trim();
          if (text && text.length > 30 && !processedContent.has(text)) {
            contentSections.push(`PARAGRAPH:\n${text}`);
            processedContent.add(text);
          }
        });
        
        // Extract headings with their following content
        $element.find('h1, h2, h3, h4, h5, h6').each((_, heading) => {
          const $heading = $(heading);
          const headingText = $heading.text().trim();
          
          if (headingText && !processedContent.has(headingText)) {
            let sectionContent = `${headingText}\n`;
            
            // Get content after this heading
            let $next = $heading.next();
            let contentFound = false;
            
            while ($next.length && $next.prop('tagName')?.match(/^H[1-6]$/i) === null) {
              const nextText = $next.text().trim();
              if (nextText && nextText.length > 20) {
                sectionContent += nextText + '\n';
                contentFound = true;
              }
              $next = $next.next();
            }
            
            if (contentFound && !processedContent.has(sectionContent)) {
              contentSections.push(`SECTION: ${sectionContent}`);
              processedContent.add(sectionContent);
            }
          }
        });
        
        // Extract lists
        $element.find('ul, ol').each((_, list) => {
          const listItems: string[] = [];
          $(list).find('li').each((_, li) => {
            const itemText = $(li).text().trim();
            if (itemText) listItems.push(itemText);
          });
          
          if (listItems.length > 0) {
            const listContent = `LIST:\n${listItems.map(item => `• ${item}`).join('\n')}`;
            if (!processedContent.has(listContent)) {
              contentSections.push(listContent);
              processedContent.add(listContent);
            }
          }
        });
      });
    }
  }

  private extractShopifyContent($: cheerio.CheerioAPI, contentSections: string[]): void {
    const selectors = [
      '.main-content', '.product-content', '.page-content',
      '.rte', '.product-description', '.product-info',
      'main', 'article', '.content'
    ];
    
    for (const selector of selectors) {
      $(selector).each((_, element) => {
        const text = $(element).text().trim().replace(/\s+/g, ' ');
        if (text && text.length > 50) {
          contentSections.push(`SHOPIFY CONTENT:\n${text}`);
        }
      });
    }
  }

  private extractGenericContent($: cheerio.CheerioAPI, contentSections: string[]): void {
    const selectors = ['main', 'article', '.content', '#content', '.main', '.page-content'];
    
    for (const selector of selectors) {
      $(selector).each((_, element) => {
        const text = $(element).text().trim().replace(/\s+/g, ' ');
        if (text && text.length > 50) {
          contentSections.push(`MAIN CONTENT:\n${text}`);
        }
      });
    }
  }

  private extractFooterContent($: cheerio.CheerioAPI): string {
    const footerSelectors = ['footer', '.footer', '#footer', '.site-footer'];
    let content = '';
    
    for (const selector of footerSelectors) {
      const $footer = $(selector).first();
      if ($footer.length > 0) {
        const text = $footer.text().trim().replace(/\s+/g, ' ');
        if (text && text.length > 20) {
          content += text + '\n';
        }
      }
    }
    
    return content.trim();
  }

  private async analyzeStructureWithAI(url: string, title: string, html: string, platform: string): Promise<any> {
    console.log(`🏗️ Using AI to analyze page structure...`);
    
    // Extract structure indicators
    const $ = cheerio.load(html);
    const structureElements = {
      headers: $('header, .header, #header').length,
      mains: $('main, .main, #main').length,
      footers: $('footer, .footer, #footer').length,
      articles: $('article').length,
      sections: $('section').length,
      elementorContainers: $('.elementor-container, .elementor-widget').length
    };
    
    const prompt = `Analyze the structure of this ${platform} webpage and provide insights:

🌐 URL: ${url}
📄 Title: ${title}
🔧 Platform: ${platform}

📊 Structure Elements Found:
- Headers: ${structureElements.headers}
- Main areas: ${structureElements.mains}
- Footers: ${structureElements.footers}
- Articles: ${structureElements.articles}
- Sections: ${structureElements.sections}
- Elementor containers: ${structureElements.elementorContainers}

Provide a comprehensive summary covering:
1. What this page is about and its primary purpose
2. Key content sections and their functions
3. Important features, services, or products mentioned
4. Call-to-action elements or user engagement points
5. Overall page effectiveness and user experience insights

Keep summary detailed but under 300 words.`;

    try {
      const response = await this.makeRequest([
        { role: 'user', content: prompt }
      ]);

      return {
        contentAreas: {
          header: ['Navigation', 'Logo', 'Header content'],
          main: ['Primary content', 'Main sections'],
          footer: ['Footer links', 'Contact info']
        },
        summary: response.choices[0]?.message?.content || 'Structure analysis completed'
      };
    } catch (error) {
      console.error('Error in AI structure analysis:', error);
      return {
        contentAreas: {
          header: ['Header content'],
          main: ['Main content'],
          footer: ['Footer content']
        },
        summary: 'Structure analysis failed'
      };
    }
  }

  private async makeRequest(messages: Array<{ role: string; content: string }>): Promise<GLMResponse> {
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: 'glm-4.5-flash',
        messages,
        max_tokens: 500,
        temperature: 0.3,
        thinking: {
          type: 'disabled'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // Increased timeout for complex analysis
      }
    );

    return response.data;
  }
}

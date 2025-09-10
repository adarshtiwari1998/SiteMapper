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
    console.log(`🤖 Using AI to extract content from ${platform} page...`);
    
    // Clean HTML and prepare for AI analysis
    const cleanedHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit HTML size for AI processing
    const htmlForAI = cleanedHtml.substring(0, 8000);
    
    const prompt = `As an expert web content analyst, analyze this ${platform}${hasElementor ? ' with Elementor' : ''} webpage and extract ALL content comprehensively.

🌐 URL: ${url}
📄 Title: ${title}
🔧 Platform: ${platform}${hasElementor ? ' + Elementor' : ''}

🔍 HTML to analyze:
${htmlForAI}

📋 EXTRACTION REQUIREMENTS:
1. **COMPLETE CONTENT EXTRACTION**: Extract ALL text content from every section
2. **STRUCTURE AWARENESS**: Understand ${platform} architecture and ${hasElementor ? 'Elementor widget containers' : 'standard HTML structure'}
3. **INTELLIGENT PARSING**: Identify main content areas (header, main, footer)
4. **IMAGE DETECTION**: Find all images with proper context
5. **SECTION ORGANIZATION**: Group content by logical sections with clear headings

📤 PROVIDE DETAILED JSON RESPONSE:
{
  "title": "extracted page title",
  "mainContent": "complete main content as continuous text",
  "images": ["complete list of all image URLs found"],
  "sections": [
    {
      "heading": "section heading",
      "content": "complete section content with ALL details",
      "images": ["images in this section"]
    }
  ]
}

⚠️ CRITICAL: Extract EVERYTHING - don't summarize, include complete text content from all divs, paragraphs, lists, and containers.`;

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
          console.log(`✅ AI extracted ${parsed.sections?.length || 0} sections from ${url}`);
          return parsed;
        }
      } catch (parseError) {
        console.log('📝 AI response was not JSON, using as text content');
      }
      
      // Fallback: use AI response as main content
      return {
        title: title || 'No title',
        mainContent: aiResponse,
        images: [],
        sections: [{
          heading: 'AI Analysis',
          content: aiResponse,
          images: []
        }]
      };
    } catch (error) {
      console.error('Error in AI content extraction:', error);
      return {
        title: title || 'No title',
        mainContent: 'AI content extraction failed',
        images: [],
        sections: []
      };
    }
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

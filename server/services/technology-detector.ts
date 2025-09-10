import axios from 'axios';
import * as cheerio from 'cheerio';

export interface DetectedTechnology {
  name: string;
  version?: string;
  category: string;
  confidence: number;
}

export class TechnologyDetector {
  async detectTechnologies(websiteUrl: string): Promise<DetectedTechnology[]> {
    const technologies: DetectedTechnology[] = [];

    try {
      const response = await axios.get(websiteUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'SiteMapper Pro 1.0 - Technology Detector'
        }
      });

      const $ = cheerio.load(response.data);
      const html = response.data;
      const headers = response.headers;

      // Detect WordPress
      if (this.isWordPress(html, headers)) {
        const version = this.extractWordPressVersion(html);
        technologies.push({
          name: 'WordPress',
          version,
          category: 'CMS',
          confidence: 0.95
        });
      }

      // Detect Shopify
      if (this.isShopify(html, headers)) {
        technologies.push({
          name: 'Shopify',
          category: 'E-commerce',
          confidence: 0.95
        });
      }

      // Detect React
      if (this.isReact(html)) {
        technologies.push({
          name: 'React',
          category: 'JavaScript Framework',
          confidence: 0.9
        });
      }

      // Detect Vue.js
      if (this.isVue(html)) {
        technologies.push({
          name: 'Vue.js',
          category: 'JavaScript Framework',
          confidence: 0.9
        });
      }

      // Detect Angular
      if (this.isAngular(html)) {
        technologies.push({
          name: 'Angular',
          category: 'JavaScript Framework',
          confidence: 0.9
        });
      }

      // Detect Next.js
      if (this.isNextJS(html)) {
        technologies.push({
          name: 'Next.js',
          category: 'JavaScript Framework',
          confidence: 0.9
        });
      }

      // Detect PHP
      if (this.isPHP(headers)) {
        technologies.push({
          name: 'PHP',
          category: 'Programming Language',
          confidence: 0.8
        });
      }

      // Detect Google Analytics
      if (this.hasGoogleAnalytics(html)) {
        const version = this.getGoogleAnalyticsVersion(html);
        technologies.push({
          name: 'Google Analytics',
          version,
          category: 'Analytics',
          confidence: 0.95
        });
      }

      // Detect jQuery
      if (this.hasJQuery(html)) {
        technologies.push({
          name: 'jQuery',
          category: 'JavaScript Library',
          confidence: 0.9
        });
      }

      // Detect Bootstrap
      if (this.hasBootstrap(html)) {
        technologies.push({
          name: 'Bootstrap',
          category: 'CSS Framework',
          confidence: 0.8
        });
      }

      // Detect Tailwind CSS
      if (this.hasTailwindCSS(html)) {
        technologies.push({
          name: 'Tailwind CSS',
          category: 'CSS Framework',
          confidence: 0.85
        });
      }

      // Server detection
      const server = this.detectServer(headers);
      if (server) {
        technologies.push(server);
      }

    } catch (error) {
      console.error('Error detecting technologies:', error);
    }

    return technologies;
  }

  private isWordPress(html: string, headers: any): boolean {
    return html.includes('wp-content') ||
           html.includes('wp-includes') ||
           html.includes('/wp-json/') ||
           /generator.*wordpress/i.test(html) ||
           headers['x-powered-by']?.includes('WordPress');
  }

  private extractWordPressVersion(html: string): string | undefined {
    const versionMatch = html.match(/generator.*wordpress\s+([\d.]+)/i);
    return versionMatch ? versionMatch[1] : undefined;
  }

  private isShopify(html: string, headers: any): boolean {
    return html.includes('Shopify') ||
           html.includes('shopify') ||
           html.includes('cdn.shopify.com') ||
           headers.server?.includes('Shopify');
  }

  private isReact(html: string): boolean {
    return html.includes('React') ||
           html.includes('react') ||
           html.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__') ||
           /react.*\.js/i.test(html);
  }

  private isVue(html: string): boolean {
    return html.includes('Vue.js') ||
           html.includes('vue.js') ||
           html.includes('__VUE__') ||
           /vue.*\.js/i.test(html);
  }

  private isAngular(html: string): boolean {
    return html.includes('Angular') ||
           html.includes('angular') ||
           html.includes('ng-version') ||
           /angular.*\.js/i.test(html);
  }

  private isNextJS(html: string): boolean {
    return html.includes('Next.js') ||
           html.includes('next.js') ||
           html.includes('__NEXT_DATA__') ||
           html.includes('_next/');
  }

  private isPHP(headers: any): boolean {
    return headers['x-powered-by']?.includes('PHP') ||
           headers.server?.includes('PHP');
  }

  private hasGoogleAnalytics(html: string): boolean {
    return html.includes('google-analytics.com') ||
           html.includes('googletagmanager.com') ||
           html.includes('gtag(') ||
           html.includes('ga(');
  }

  private getGoogleAnalyticsVersion(html: string): string {
    if (html.includes('gtag(') || html.includes('googletagmanager.com')) {
      return 'GA4';
    }
    if (html.includes('google-analytics.com/analytics.js')) {
      return 'Universal Analytics';
    }
    return 'Classic Analytics';
  }

  private hasJQuery(html: string): boolean {
    return html.includes('jquery') ||
           html.includes('jQuery') ||
           /jquery.*\.js/i.test(html);
  }

  private hasBootstrap(html: string): boolean {
    return html.includes('bootstrap') ||
           html.includes('Bootstrap') ||
           /bootstrap.*\.css/i.test(html);
  }

  private hasTailwindCSS(html: string): boolean {
    return html.includes('tailwind') ||
           html.includes('Tailwind') ||
           /tailwind.*\.css/i.test(html);
  }

  private detectServer(headers: any): DetectedTechnology | null {
    const server = headers.server;
    if (!server) return null;

    if (server.includes('nginx')) {
      return {
        name: 'Nginx',
        category: 'Web Server',
        confidence: 0.95
      };
    }

    if (server.includes('Apache')) {
      return {
        name: 'Apache',
        category: 'Web Server',
        confidence: 0.95
      };
    }

    if (server.includes('Microsoft-IIS')) {
      return {
        name: 'Microsoft IIS',
        category: 'Web Server',
        confidence: 0.95
      };
    }

    return null;
  }
}

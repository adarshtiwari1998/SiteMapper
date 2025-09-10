import axios from 'axios';

export interface GLMResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
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
      // Fetch page content
      const pageResponse = await axios.get(url, {
        timeout: 30000, // Increased timeout
        headers: {
          'User-Agent': 'SiteMapper Pro 1.0 - Content Analyzer'
        },
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept 2xx and 3xx status codes
        }
      });

      // Extract text content (simplified)
      let content = pageResponse.data
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000); // Limit content length

      const prompt = `Analyze this webpage and provide a concise summary in 2-3 sentences:

URL: ${url}
Title: ${title}
Content: ${content}

Please provide:
1. What this page is about
2. Its main purpose or function
3. Key information or features mentioned

Keep the summary under 150 words and focus on the most important aspects.`;

      const response = await this.makeRequest([
        { role: 'user', content: prompt }
      ]);

      return response.choices[0]?.message?.content || 'Analysis unavailable';
    } catch (error) {
      console.error(`Error analyzing page ${url}:`, error);
      return 'Analysis failed - unable to process page content';
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
        timeout: 30000
      }
    );

    return response.data;
  }
}

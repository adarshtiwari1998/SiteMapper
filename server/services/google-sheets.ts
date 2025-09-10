import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { DiscoveredPage } from '@shared/schema';
import type { DetectedTechnology } from './technology-detector';

export interface ExportData {
  websiteUrl: string;
  technologies: DetectedTechnology[];
  pages: (DiscoveredPage & {
    sectionsData?: any[];
    imagesData?: any[];
    headingsData?: any[];
    metaDescription?: string;
    pageStructure?: string;
  })[];
}

export class GoogleSheetsService {
  private serviceAccount: any;

  constructor(serviceAccountJson: any) {
    this.serviceAccount = serviceAccountJson;
  }

  async verifyAccess(sheetsId: string): Promise<{ title: string }> {
    try {
      const jwt = new JWT({
        email: this.serviceAccount.client_email,
        key: this.serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const doc = new GoogleSpreadsheet(sheetsId, jwt);
      await doc.loadInfo();
      
      return { title: doc.title };
    } catch (error) {
      throw new Error('Unable to access Google Sheets. Check credentials and sheet ID.');
    }
  }

  async exportToSheets(sheetsId: string, data: ExportData): Promise<void> {
    try {
      const jwt = new JWT({
        email: this.serviceAccount.client_email,
        key: this.serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const doc = new GoogleSpreadsheet(sheetsId, jwt);
      await doc.loadInfo();

      // Clear existing sheets and create new ones
      await this.clearAndCreateSheets(doc, data);
    } catch (error) {
      console.error('Error exporting to Google Sheets:', error);
      throw new Error('Failed to export to Google Sheets');
    }
  }

  private async clearAndCreateSheets(doc: GoogleSpreadsheet, data: ExportData): Promise<void> {
    // Delete existing sheets except the first one
    const sheets = doc.sheetsByIndex.slice(1);
    for (const sheet of sheets) {
      await sheet.delete();
    }

    // 1. Website Overview Sheet
    await this.createOverviewSheet(doc, data);
    
    // 2. Consolidated Site Structure Sheet (includes all page data)
    await this.createConsolidatedSiteStructureSheet(doc, data);
    
    // 3. Technologies Sheet
    await this.createTechnologiesSheet(doc, data);

    // Format all sheets with improved formatting
    await this.formatSheetsWithAutoResize(doc);
  }

  private async createOverviewSheet(doc: GoogleSpreadsheet, data: ExportData): Promise<void> {
    const overviewSheet = doc.sheetsByIndex[0];
    await overviewSheet.updateProperties({ title: '📊 Website Overview' });
    await overviewSheet.clear();
    
    await overviewSheet.setHeaderRow(['Property', 'Value']);

    const overviewRows = [
      ['🌐 Website URL', data.websiteUrl],
      ['📅 Analysis Date', new Date().toISOString().split('T')[0]],
      ['📄 Total Pages Found', data.pages.length.toString()],
      ['🔧 Technologies Detected', data.technologies.length.toString()],
      ['', ''],
      ['📊 ANALYSIS SUMMARY', ''],
      ['', '']
    ];

    // Count page types
    const pageTypes = data.pages.reduce((acc: Record<string, number>, page) => {
      const type = page.pageType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    Object.entries(pageTypes).forEach(([type, count]) => {
      overviewRows.push([`📄 ${type.charAt(0).toUpperCase() + type.slice(1)} Pages`, count.toString()]);
    });

    overviewRows.push(['', '']);
    overviewRows.push(['🔧 DETECTED TECHNOLOGIES', '']);
    overviewRows.push(['', '']);

    data.technologies.forEach(tech => {
      overviewRows.push([
        `${this.getTechIcon(tech.category)} ${tech.name}`,
        `${tech.category}${tech.version ? ` (v${tech.version})` : ''}`
      ]);
    });

    await overviewSheet.addRows(overviewRows);
  }

  private async createConsolidatedSiteStructureSheet(doc: GoogleSpreadsheet, data: ExportData): Promise<void> {
    const structureSheet = await doc.addSheet({
      title: '🏗️ Site Structure',
      headerValues: [
        'Page Type',
        'Page Title', 
        'URL',
        'Status',
        'Complete Page Content & Structure',
        'AI Content Summary'
      ]
    });

    const structureRows = data.pages
      .sort((a, b) => {
        const typeOrder = ['homepage', 'about', 'contact', 'product', 'service', 'blog', 'page'];
        const aIndex = typeOrder.indexOf(a.pageType || 'page');
        const bIndex = typeOrder.indexOf(b.pageType || 'page');
        return aIndex - bIndex;
      })
      .map(page => {
        // Compile comprehensive page content including header, content, and footer
        let completeContent = '';
        if (page.sectionsData && Array.isArray(page.sectionsData)) {
          completeContent = page.sectionsData.map((section: any) => {
            const sectionIcon = this.getSectionIcon(section.type);
            const sectionTitle = section.title || 'Content Section';
            const content = section.content || 'No content';
            return `${sectionIcon} ${sectionTitle}\n${content}`;
          }).join('\n\n---\n\n');
        }
        
        // Add page structure information
        if (page.pageStructure) {
          completeContent += `\n\n📈 Page Structure: ${page.pageStructure}`;
        }
        
        // Add meta description if available
        if (page.metaDescription) {
          completeContent += `\n\n📝 Meta Description: ${page.metaDescription}`;
        }
        
        // Add additional images not already included in sections
        if (page.imagesData && Array.isArray(page.imagesData)) {
          const additionalImages = page.imagesData.map((img: any) => {
            const altText = img.alt ? ` - ${img.alt}` : '';
            return `🖼️ ${img.src}${altText}`;
          }).join('\n');
          
          if (additionalImages) {
            completeContent += `\n\n🖼️ Additional Images:\n${additionalImages}`;
          }
        }

        // Enhanced AI summary
        let aiSummary = page.contentSummary || 'No summary available';
        if (page.pageStructure) {
          aiSummary += `\n\n📋 Structure: ${page.pageStructure}`;
        }
        if (page.metaDescription) {
          aiSummary += `\n\n📝 Meta: ${page.metaDescription}`;
        }

        return {
          'Page Type': `${this.getPageTypeIcon(page.pageType || 'page')} ${(page.pageType || 'page').toUpperCase()}`,
          'Page Title': page.title || 'No Title',
          'URL': page.url,
          'Status': page.statusCode === 200 ? '✅ OK' : `❌ ${page.statusCode}`,
          'Complete Page Content & Structure': completeContent || 'No content analyzed',
          'AI Content Summary': aiSummary
        };
      });

    if (structureRows.length > 0) {
      await structureSheet.addRows(structureRows);
    }
  }

  private async createSiteStructureSheet(doc: GoogleSpreadsheet, data: ExportData): Promise<void> {
    const structureSheet = await doc.addSheet({
      title: '🏗️ Site Structure',
      headerValues: [
        'Page Type',
        'Page Title', 
        'URL',
        'Status',
        'Page Structure',
        'Content Summary'
      ]
    });

    const structureRows = data.pages
      .sort((a, b) => {
        const typeOrder = ['homepage', 'about', 'contact', 'product', 'service', 'blog', 'page'];
        const aIndex = typeOrder.indexOf(a.pageType || 'page');
        const bIndex = typeOrder.indexOf(b.pageType || 'page');
        return aIndex - bIndex;
      })
      .map(page => ({
        'Page Type': `${this.getPageTypeIcon(page.pageType || 'page')} ${(page.pageType || 'page').toUpperCase()}`,
        'Page Title': page.title || 'No Title',
        'URL': page.url,
        'Status': page.statusCode === 200 ? '✅ OK' : `❌ ${page.statusCode}`,
        'Page Structure': page.pageStructure || 'Not analyzed',
        'Content Summary': page.contentSummary ? this.truncateText(page.contentSummary, 150) : 'No summary available'
      }));

    if (structureRows.length > 0) {
      await structureSheet.addRows(structureRows);
    }
  }

  private async createPageAnalysisSheet(doc: GoogleSpreadsheet, data: ExportData): Promise<void> {
    const analysisSheet = await doc.addSheet({
      title: '🔍 Detailed Page Analysis',
      headerValues: [
        'Page Title',
        'URL', 
        'Page Type',
        'Meta Description',
        'Main Headings',
        'Content Sections',
        'Images Count',
        'Navigation Links'
      ]
    });

    const analysisRows = data.pages.map(page => {
      const headings = page.headingsData && Array.isArray(page.headingsData) 
        ? page.headingsData.map((h: any) => `H${h.level}: ${h.text}`).join(' | ')
        : 'No headings found';
      
      const sections = page.sectionsData && Array.isArray(page.sectionsData)
        ? page.sectionsData.filter((s: any) => s.type === 'content').length
        : 0;
      
      const imagesCount = page.imagesData && Array.isArray(page.imagesData)
        ? page.imagesData.length
        : 0;
      
      const navSections = page.sectionsData && Array.isArray(page.sectionsData)
        ? page.sectionsData.filter((s: any) => s.type === 'navigation').map((s: any) => s.content).join(' | ')
        : 'No navigation found';

      return {
        'Page Title': page.title || 'No Title',
        'URL': page.url,
        'Page Type': this.getPageTypeIcon(page.pageType || 'page') + ' ' + (page.pageType || 'page'),
        'Meta Description': page.metaDescription ? this.truncateText(page.metaDescription, 100) : 'No meta description',
        'Main Headings': this.truncateText(headings, 200),
        'Content Sections': `${sections} content sections`,
        'Images Count': `${imagesCount} images`,
        'Navigation Links': this.truncateText(navSections, 150)
      };
    });

    if (analysisRows.length > 0) {
      await analysisSheet.addRows(analysisRows);
    }
  }

  private async createImagesSheet(doc: GoogleSpreadsheet, data: ExportData): Promise<void> {
    const imagesSheet = await doc.addSheet({
      title: '🖼️ Images Found',
      headerValues: [
        'Page Title',
        'Page URL',
        'Image URL',
        'Alt Text',
        'Image Title',
        'Position on Page'
      ]
    });

    const imageRows: any[] = [];
    data.pages.forEach(page => {
      if (page.imagesData && Array.isArray(page.imagesData)) {
        page.imagesData.forEach((image: any) => {
          imageRows.push({
            'Page Title': page.title || 'No Title',
            'Page URL': page.url,
            'Image URL': image.src,
            'Alt Text': image.alt || 'No alt text',
            'Image Title': image.title || 'No title',
            'Position on Page': `Image #${image.position + 1}`
          });
        });
      }
    });

    if (imageRows.length > 0) {
      await imagesSheet.addRows(imageRows);
    }
  }

  private async createTechnologiesSheet(doc: GoogleSpreadsheet, data: ExportData): Promise<void> {
    const techSheet = await doc.addSheet({ 
      title: '⚙️ Technologies',
      headerValues: ['Technology', 'Version', 'Category', 'Confidence', 'Description']
    });

    const techRows = data.technologies.map(tech => ({
      Technology: `${this.getTechIcon(tech.category)} ${tech.name}`,
      Version: tech.version || 'Unknown',
      Category: tech.category,
      Confidence: `${Math.round(tech.confidence * 100)}%`,
      Description: this.getTechDescription(tech.name, tech.category)
    }));

    if (techRows.length > 0) {
      await techSheet.addRows(techRows);
    }
  }

  private async createPageSectionsSheet(doc: GoogleSpreadsheet, data: ExportData): Promise<void> {
    const sectionsSheet = await doc.addSheet({
      title: '📝 Page Sections',
      headerValues: [
        'Page Title',
        'Page URL',
        'Section Type',
        'Section Title',
        'Content Preview',
        'Position'
      ]
    });

    const sectionRows: any[] = [];
    data.pages.forEach(page => {
      if (page.sectionsData && Array.isArray(page.sectionsData)) {
        page.sectionsData.forEach((section: any) => {
          sectionRows.push({
            'Page Title': page.title || 'No Title',
            'Page URL': page.url,
            'Section Type': `${this.getSectionIcon(section.type)} ${section.type.toUpperCase()}`,
            'Section Title': section.title || 'No title',
            'Content Preview': this.truncateText(section.content, 200),
            'Position': `Section #${section.position + 1}`
          });
        });
      }
    });

    if (sectionRows.length > 0) {
      await sectionsSheet.addRows(sectionRows);
    }
  }

  private getTechIcon(category: string): string {
    const iconMap: Record<string, string> = {
      'CMS': '📝',
      'JavaScript Framework': '⚛️', 
      'CSS Framework': '🎨',
      'Programming Language': '💻',
      'Analytics': '📊',
      'E-commerce': '🛒',
      'Web Server': '🖥️',
      'JavaScript Library': '📚'
    };
    return iconMap[category] || '⚙️';
  }

  private getPageTypeIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'homepage': '🏠',
      'about': 'ℹ️',
      'contact': '📞',
      'product': '📦',
      'service': '🛠️',
      'blog': '📰',
      'portfolio': '🎨',
      'team': '👥',
      'pricing': '💰'
    };
    return iconMap[type] || '📄';
  }

  private getSectionIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'heading': '📋',
      'content': '📝',
      'navigation': '🧭',
      'list': '📜',
      'table': '📊',
      'form': '📝'
    };
    return iconMap[type] || '📄';
  }

  private getTechDescription(name: string, category: string): string {
    const descriptions: Record<string, string> = {
      'WordPress': 'Popular content management system',
      'React': 'JavaScript library for building user interfaces',
      'Vue.js': 'Progressive JavaScript framework',
      'Angular': 'Platform for building mobile and desktop web applications',
      'Bootstrap': 'CSS framework for responsive design',
      'jQuery': 'JavaScript library for DOM manipulation',
      'Google Analytics': 'Web analytics service'
    };
    return descriptions[name] || `${category} technology`;
  }

  private truncateText(text: string, length: number): string {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  private async formatSheetsWithAutoResize(doc: GoogleSpreadsheet): Promise<void> {
    // Enhanced formatting for better readability and auto-resize
    for (const sheet of doc.sheetsByIndex) {
      if (sheet.rowCount > 0) {
        // Make header row bold and set background color
        await sheet.loadCells('A1:Z1');
        for (let col = 0; col < sheet.columnCount; col++) {
          const cell = sheet.getCell(0, col);
          if (cell.value) {
            cell.textFormat = { bold: true };
            cell.backgroundColor = { red: 0.9, green: 0.9, blue: 0.9 };
          }
        }
        await sheet.saveUpdatedCells();

        // Auto-resize columns and set text wrapping
        const requests = [];
        
        // Auto-resize all columns
        requests.push({
          autoResizeDimensions: {
            dimensions: {
              sheetId: sheet.sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: sheet.columnCount
            }
          }
        });

        // Set row height to auto-resize for content
        requests.push({
          updateDimensionProperties: {
            range: {
              sheetId: sheet.sheetId,
              dimension: 'ROWS',
              startIndex: 1, // Skip header row
              endIndex: sheet.rowCount
            },
            properties: {
              pixelSize: null // Auto-size
            },
            fields: 'pixelSize'
          }
        });

        // Enable text wrapping for all cells
        requests.push({
          repeatCell: {
            range: {
              sheetId: sheet.sheetId,
              startRowIndex: 0,
              endRowIndex: sheet.rowCount,
              startColumnIndex: 0,
              endColumnIndex: sheet.columnCount
            },
            cell: {
              userEnteredFormat: {
                wrapStrategy: 'WRAP',
                verticalAlignment: 'TOP'
              }
            },
            fields: 'userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment'
          }
        });

        // Note: More advanced formatting can be added here if needed
        // The google-spreadsheet library has limited batch update support
      }
    }
  }

  private async formatSheets(doc: GoogleSpreadsheet): Promise<void> {
    // Basic formatting for better readability
    for (const sheet of doc.sheetsByIndex) {
      if (sheet.rowCount > 0) {
        // Make header row bold
        await sheet.loadCells('A1:Z1');
        for (let col = 0; col < sheet.columnCount; col++) {
          const cell = sheet.getCell(0, col);
          if (cell.value) {
            cell.textFormat = { bold: true };
          }
        }
        await sheet.saveUpdatedCells();
      }
    }
  }
}

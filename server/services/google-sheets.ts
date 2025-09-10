import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { DiscoveredPage } from '@shared/schema';
import type { DetectedTechnology } from './technology-detector';

export interface ExportData {
  websiteUrl: string;
  technologies: DetectedTechnology[];
  pages: DiscoveredPage[];
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

    // Update the first sheet with overview data
    const overviewSheet = doc.sheetsByIndex[0];
    await overviewSheet.updateProperties({ title: 'Website Overview' });
    await overviewSheet.clear();
    
    // Add overview headers
    await overviewSheet.setHeaderRow([
      'Property', 'Value'
    ]);

    // Add overview data
    const overviewRows = [
      ['Website URL', data.websiteUrl],
      ['Analysis Date', new Date().toISOString().split('T')[0]],
      ['Total Pages Found', data.pages.length.toString()],
      ['Technologies Detected', data.technologies.length.toString()],
      ['', ''],
      ['DETECTED TECHNOLOGIES', ''],
      ['', '']
    ];

    // Add technology details
    data.technologies.forEach(tech => {
      overviewRows.push([
        tech.name,
        `${tech.category}${tech.version ? ` (v${tech.version})` : ''}`
      ]);
    });

    await overviewSheet.addRows(overviewRows);

    // Create Technologies sheet
    const techSheet = await doc.addSheet({ 
      title: 'Technologies',
      headerValues: ['Technology', 'Version', 'Category', 'Confidence']
    });

    const techRows = data.technologies.map(tech => ({
      Technology: tech.name,
      Version: tech.version || '',
      Category: tech.category,
      Confidence: `${Math.round(tech.confidence * 100)}%`
    }));

    if (techRows.length > 0) {
      await techSheet.addRows(techRows);
    }

    // Create Pages sheet
    const pagesSheet = await doc.addSheet({
      title: 'Sitemap',
      headerValues: [
        'URL',
        'Page Title',
        'Page Type',
        'Status Code',
        'Analysis Status',
        'Content Summary',
        'Discovered Date'
      ]
    });

    const pageRows = data.pages.map(page => ({
      URL: page.url,
      'Page Title': page.title || '',
      'Page Type': page.pageType || '',
      'Status Code': page.statusCode?.toString() || '',
      'Analysis Status': page.analysisStatus || 'pending',
      'Content Summary': page.contentSummary || '',
      'Discovered Date': page.createdAt?.toISOString().split('T')[0] || ''
    }));

    if (pageRows.length > 0) {
      await pagesSheet.addRows(pageRows);
    }

    // Format sheets
    await this.formatSheets(doc);
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

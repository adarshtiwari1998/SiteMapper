import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAnalysisJobSchema, insertUserConfigurationSchema } from "@shared/schema";
import { z } from "zod";
import { WebsiteCrawler } from "./services/crawler";
import { TechnologyDetector } from "./services/technology-detector";
import { GLMService } from "./services/glm-api";
import { GoogleSheetsService } from "./services/google-sheets";
import multer from "multer";

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Start website analysis
  app.post("/api/analysis/start", async (req, res) => {
    try {
      const validatedData = insertAnalysisJobSchema.parse(req.body);
      
      // Create analysis job
      const job = await storage.createAnalysisJob(validatedData);
      
      // Start analysis process asynchronously
      processAnalysisJob(job.id).catch(console.error);
      
      res.json({ success: true, jobId: job.id });
    } catch (error) {
      console.error("Error starting analysis:", error);
      res.status(400).json({ 
        error: error instanceof z.ZodError ? error.errors : "Failed to start analysis" 
      });
    }
  });

  // Get analysis job status
  app.get("/api/analysis/:jobId", async (req, res) => {
    try {
      const job = await storage.getAnalysisJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Analysis job not found" });
      }
      
      const pages = await storage.getJobPages(job.id);
      
      res.json({
        job,
        pages: pages.slice(0, 50), // Limit to first 50 pages for performance
        totalPages: pages.length
      });
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ error: "Failed to fetch analysis status" });
    }
  });

  // Get analysis jobs list
  app.get("/api/analysis", async (req, res) => {
    try {
      const jobs = await storage.getUserAnalysisJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching analysis jobs:", error);
      res.status(500).json({ error: "Failed to fetch analysis jobs" });
    }
  });

  // Upload service account JSON
  app.post("/api/upload/service-account", upload.single('serviceAccount'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const jsonData = JSON.parse(req.file.buffer.toString());
      
      // Validate service account JSON structure
      if (!jsonData.type || !jsonData.private_key || !jsonData.client_email) {
        return res.status(400).json({ error: "Invalid service account JSON format" });
      }

      res.json({ 
        success: true, 
        message: "Service account JSON uploaded successfully",
        clientEmail: jsonData.client_email
      });
    } catch (error) {
      console.error("Error uploading service account:", error);
      res.status(400).json({ error: "Invalid JSON file" });
    }
  });

  // Verify Google Sheets access
  app.post("/api/sheets/verify", async (req, res) => {
    try {
      const { sheetsId, serviceAccountJson } = req.body;
      
      if (!sheetsId || !serviceAccountJson) {
        return res.status(400).json({ error: "Missing sheets ID or service account credentials" });
      }

      const sheetsService = new GoogleSheetsService(serviceAccountJson);
      const sheetInfo = await sheetsService.verifyAccess(sheetsId);
      
      res.json({ 
        success: true, 
        sheetTitle: sheetInfo.title,
        message: "Google Sheets access verified" 
      });
    } catch (error) {
      console.error("Error verifying sheets access:", error);
      res.status(400).json({ error: "Failed to access Google Sheets. Check credentials and sheet ID." });
    }
  });

  // Test GLM API key
  app.post("/api/glm/test", async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ error: "API key is required" });
      }

      const glmService = new GLMService(apiKey);
      await glmService.testConnection();
      
      res.json({ success: true, message: "GLM API key verified" });
    } catch (error) {
      console.error("Error testing GLM API:", error);
      res.status(400).json({ error: "Invalid GLM API key or service unavailable" });
    }
  });

  // Save configuration
  app.post("/api/configurations", async (req, res) => {
    try {
      const validatedData = insertUserConfigurationSchema.parse(req.body);
      
      const config = await storage.createConfiguration({
        ...validatedData,
        isDefault: true, // Set as default for now
        userId: null // For now, we don't have user auth
      });
      
      res.json({ success: true, configuration: config });
    } catch (error) {
      console.error("Error saving configuration:", error);
      res.status(400).json({ 
        error: error instanceof z.ZodError ? error.errors : "Failed to save configuration" 
      });
    }
  });

  // Get default configuration
  app.get("/api/configurations/default", async (req, res) => {
    try {
      const config = await storage.getDefaultConfiguration(undefined); // No user auth for now
      res.json(config || null);
    } catch (error) {
      console.error("Error fetching default configuration:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  // Get all configurations
  app.get("/api/configurations", async (req, res) => {
    try {
      const configs = await storage.getAllConfigurations(undefined); // No user auth for now
      res.json(configs);
    } catch (error) {
      console.error("Error fetching configurations:", error);
      res.status(500).json({ error: "Failed to fetch configurations" });
    }
  });

  // Update configuration
  app.put("/api/configurations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertUserConfigurationSchema.partial().parse(req.body);
      
      const config = await storage.updateConfiguration(id, validatedData);
      res.json({ success: true, configuration: config });
    } catch (error) {
      console.error("Error updating configuration:", error);
      res.status(400).json({ 
        error: error instanceof z.ZodError ? error.errors : "Failed to update configuration" 
      });
    }
  });

  // Export to CSV
  app.get("/api/analysis/:jobId/export", async (req, res) => {
    try {
      const job = await storage.getAnalysisJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Analysis job not found" });
      }
      
      const pages = await storage.getJobPages(job.id);
      
      // Generate CSV
      const csvHeaders = "URL,Title,Type,Status Code,Analysis Status,Content Summary\n";
      const csvRows = pages.map(page => 
        `"${page.url}","${page.title || ''}","${page.pageType || ''}","${page.statusCode || ''}","${page.analysisStatus}","${page.contentSummary || ''}"`
      ).join("\n");
      
      const csv = csvHeaders + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="sitemap-${job.id}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Background processing function
async function processAnalysisJob(jobId: string) {
  try {
    const job = await storage.getAnalysisJob(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Update job status to running
    await storage.updateAnalysisJob(jobId, { status: "running", progress: 10 });

    // Step 1: Detect technologies
    const detector = new TechnologyDetector();
    const technologies = await detector.detectTechnologies(job.websiteUrl);
    await storage.updateAnalysisJob(jobId, { 
      detectedTechnologies: technologies, 
      progress: 25 
    });

    // Step 2: Crawl website
    const crawler = new WebsiteCrawler();
    const pages = await crawler.crawlWebsite(job.websiteUrl, {
      maxPages: job.maxPages || 100,
      includeImages: job.includeImages || false,
      deepAnalysis: job.deepAnalysis || false
    });

    // Save discovered pages with deep analysis data
    for (const page of pages) {
      await storage.createDiscoveredPage({
        jobId: job.id,
        url: page.url,
        title: page.title,
        pageType: page.type,
        statusCode: page.statusCode,
        analysisStatus: "completed",
        contentSummary: page.contentSummary,
        metaDescription: page.metaDescription,
        pageStructure: page.pageStructure,
        sectionsData: page.sections,
        imagesData: page.images,
        headingsData: page.headings
      });
    }

    await storage.updateAnalysisJob(jobId, { 
      totalPages: pages.length, 
      progress: 50 
    });

    // Step 3: Analyze content with GLM if API key provided
    if (job.glmApiKey) {
      const glmService = new GLMService(job.glmApiKey);
      const jobPages = await storage.getJobPages(job.id);
      
      let processedCount = 0;
      for (const page of jobPages) {
        try {
          await storage.updateDiscoveredPage(page.id, { analysisStatus: "processing" });
          
          const analysis = await glmService.analyzePageContent(page.url, page.title || '');
          
          await storage.updateDiscoveredPage(page.id, {
            contentSummary: analysis,
            analysisStatus: "completed"
          });
          
          processedCount++;
          const progress = 50 + Math.floor((processedCount / jobPages.length) * 40);
          await storage.updateAnalysisJob(jobId, { 
            processedPages: processedCount,
            progress 
          });
        } catch (error) {
          console.error(`Error analyzing page ${page.url}:`, error);
          await storage.updateDiscoveredPage(page.id, { analysisStatus: "failed" });
        }
      }
    }

    // Step 4: Export to Google Sheets if configured
    if (job.sheetsId && job.serviceAccountJson) {
      try {
        const sheetsService = new GoogleSheetsService(job.serviceAccountJson as any);
        const finalPages = await storage.getJobPages(job.id);
        
        await sheetsService.exportToSheets(job.sheetsId, {
          websiteUrl: job.websiteUrl,
          technologies,
          pages: finalPages.map(page => ({
            ...page,
            sectionsData: page.sectionsData as any[] || undefined,
            imagesData: page.imagesData as any[] || undefined,
            headingsData: page.headingsData as any[] || undefined,
            metaDescription: page.metaDescription || undefined,
            pageStructure: page.pageStructure || undefined
          }))
        });
        
        await storage.updateAnalysisJob(jobId, { progress: 100 });
      } catch (error) {
        console.error("Error exporting to sheets:", error);
        // Continue even if sheets export fails
      }
    }

    // Mark job as completed
    await storage.updateAnalysisJob(jobId, { 
      status: "completed", 
      progress: 100 
    });

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await storage.updateAnalysisJob(jobId, { 
      status: "failed" 
    });
  }
}

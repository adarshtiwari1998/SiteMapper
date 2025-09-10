import { analysisJobs, discoveredPages, users, type User, type InsertUser, type AnalysisJob, type InsertAnalysisJob, type DiscoveredPage, type InsertDiscoveredPage } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Analysis Jobs
  createAnalysisJob(job: InsertAnalysisJob): Promise<AnalysisJob>;
  getAnalysisJob(id: string): Promise<AnalysisJob | undefined>;
  updateAnalysisJob(id: string, updates: Partial<AnalysisJob>): Promise<AnalysisJob>;
  getUserAnalysisJobs(userId?: string): Promise<AnalysisJob[]>;
  
  // Discovered Pages
  createDiscoveredPage(page: InsertDiscoveredPage): Promise<DiscoveredPage>;
  getJobPages(jobId: string): Promise<DiscoveredPage[]>;
  updateDiscoveredPage(id: string, updates: Partial<DiscoveredPage>): Promise<DiscoveredPage>;
  getPagesByStatus(jobId: string, status: string): Promise<DiscoveredPage[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createAnalysisJob(job: InsertAnalysisJob): Promise<AnalysisJob> {
    const [analysisJob] = await db
      .insert(analysisJobs)
      .values(job)
      .returning();
    return analysisJob;
  }

  async getAnalysisJob(id: string): Promise<AnalysisJob | undefined> {
    const [job] = await db.select().from(analysisJobs).where(eq(analysisJobs.id, id));
    return job || undefined;
  }

  async updateAnalysisJob(id: string, updates: Partial<AnalysisJob>): Promise<AnalysisJob> {
    const [job] = await db
      .update(analysisJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(analysisJobs.id, id))
      .returning();
    return job;
  }

  async getUserAnalysisJobs(userId?: string): Promise<AnalysisJob[]> {
    if (userId) {
      return await db.select().from(analysisJobs).where(eq(analysisJobs.userId, userId)).orderBy(desc(analysisJobs.createdAt));
    }
    return await db.select().from(analysisJobs).orderBy(desc(analysisJobs.createdAt));
  }

  async createDiscoveredPage(page: InsertDiscoveredPage): Promise<DiscoveredPage> {
    const [discoveredPage] = await db
      .insert(discoveredPages)
      .values(page)
      .returning();
    return discoveredPage;
  }

  async getJobPages(jobId: string): Promise<DiscoveredPage[]> {
    return await db.select().from(discoveredPages).where(eq(discoveredPages.jobId, jobId));
  }

  async updateDiscoveredPage(id: string, updates: Partial<DiscoveredPage>): Promise<DiscoveredPage> {
    const [page] = await db
      .update(discoveredPages)
      .set(updates)
      .where(eq(discoveredPages.id, id))
      .returning();
    return page;
  }

  async getPagesByStatus(jobId: string, status: string): Promise<DiscoveredPage[]> {
    return await db.select().from(discoveredPages)
      .where(and(eq(discoveredPages.jobId, jobId), eq(discoveredPages.analysisStatus, status)));
  }
}

export const storage = new DatabaseStorage();

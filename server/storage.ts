import { analysisJobs, discoveredPages, users, userConfigurations, type User, type InsertUser, type AnalysisJob, type InsertAnalysisJob, type DiscoveredPage, type InsertDiscoveredPage, type UserConfiguration, type InsertUserConfiguration } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull } from "drizzle-orm";

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
  
  // User Configurations
  createConfiguration(config: InsertUserConfiguration): Promise<UserConfiguration>;
  getDefaultConfiguration(userId?: string): Promise<UserConfiguration | undefined>;
  getAllConfigurations(userId?: string): Promise<UserConfiguration[]>;
  updateConfiguration(id: string, updates: Partial<UserConfiguration>): Promise<UserConfiguration>;
  deleteConfiguration(id: string): Promise<void>;
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

  async createConfiguration(config: InsertUserConfiguration): Promise<UserConfiguration> {
    // If this is being set as default, unset any existing default
    if (config.isDefault) {
      await db.update(userConfigurations)
        .set({ isDefault: false })
        .where(eq(userConfigurations.userId, config.userId || ''));
    }

    const [configuration] = await db
      .insert(userConfigurations)
      .values(config)
      .returning();
    return configuration;
  }

  async getDefaultConfiguration(userId?: string): Promise<UserConfiguration | undefined> {
    const [config] = await db.select().from(userConfigurations)
      .where(and(
        userId ? eq(userConfigurations.userId, userId) : isNull(userConfigurations.userId),
        eq(userConfigurations.isDefault, true)
      ))
      .orderBy(desc(userConfigurations.createdAt));
    return config || undefined;
  }

  async getAllConfigurations(userId?: string): Promise<UserConfiguration[]> {
    return await db.select().from(userConfigurations)
      .where(userId ? eq(userConfigurations.userId, userId) : isNull(userConfigurations.userId))
      .orderBy(desc(userConfigurations.createdAt));
  }

  async updateConfiguration(id: string, updates: Partial<UserConfiguration>): Promise<UserConfiguration> {
    // If setting as default, unset any existing default
    if (updates.isDefault) {
      await db.update(userConfigurations)
        .set({ isDefault: false })
        .where(eq(userConfigurations.userId, updates.userId || ''));
    }

    const [config] = await db
      .update(userConfigurations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userConfigurations.id, id))
      .returning();
    return config;
  }

  async deleteConfiguration(id: string): Promise<void> {
    await db.delete(userConfigurations).where(eq(userConfigurations.id, id));
  }
}

export const storage = new DatabaseStorage();

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const analysisJobs = pgTable("analysis_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  websiteUrl: text("website_url").notNull(),
  technologyType: text("technology_type"),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  progress: integer("progress").default(0),
  sheetsId: text("sheets_id"),
  glmApiKey: text("glm_api_key"),
  serviceAccountJson: json("service_account_json"),
  maxPages: integer("max_pages").default(100),
  includeImages: boolean("include_images").default(true),
  deepAnalysis: boolean("deep_analysis").default(false),
  detectedTechnologies: json("detected_technologies"),
  totalPages: integer("total_pages").default(0),
  processedPages: integer("processed_pages").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const discoveredPages = pgTable("discovered_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  url: text("url").notNull(),
  title: text("title"),
  pageType: text("page_type"), // homepage, about, contact, product, etc.
  statusCode: integer("status_code"),
  contentSummary: text("content_summary"),
  analysisStatus: text("analysis_status").default("pending"), // pending, processing, completed, failed
  // Deep analysis fields
  metaDescription: text("meta_description"),
  pageStructure: text("page_structure"),
  sectionsData: json("sections_data"), // PageSection[]
  imagesData: json("images_data"), // PageImage[]
  headingsData: json("headings_data"), // {level: number, text: string}[]
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const userConfigurations = pgTable("user_configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  configName: text("config_name").notNull().default("Default Configuration"),
  websiteUrl: text("website_url"),
  technologyType: text("technology_type"),
  maxPages: integer("max_pages").default(100),
  includeImages: boolean("include_images").default(true),
  deepAnalysis: boolean("deep_analysis").default(false),
  sheetsId: text("sheets_id"),
  glmApiKey: text("glm_api_key"),
  serviceAccountJson: json("service_account_json"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertAnalysisJobSchema = createInsertSchema(analysisJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  progress: true,
  totalPages: true,
  processedPages: true,
}).extend({
  websiteUrl: z.string().url(),
  maxPages: z.number().min(1).max(1000),
  sheetsId: z.string().optional(),
  glmApiKey: z.string().optional(),
});

export const insertDiscoveredPageSchema = createInsertSchema(discoveredPages).omit({
  id: true,
  createdAt: true,
});

export const insertUserConfigurationSchema = createInsertSchema(userConfigurations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  configName: z.string().min(1),
  sheetsId: z.string().optional(),
  glmApiKey: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type AnalysisJob = typeof analysisJobs.$inferSelect;
export type InsertAnalysisJob = z.infer<typeof insertAnalysisJobSchema>;
export type DiscoveredPage = typeof discoveredPages.$inferSelect;
export type InsertDiscoveredPage = z.infer<typeof insertDiscoveredPageSchema>;
export type UserConfiguration = typeof userConfigurations.$inferSelect;
export type InsertUserConfiguration = z.infer<typeof insertUserConfigurationSchema>;

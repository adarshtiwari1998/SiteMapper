# Website Analysis Tool

## Overview

This is a comprehensive website analysis tool that crawls websites, detects technologies, and exports results to Google Sheets. The application provides automated website discovery through sitemap parsing and manual crawling, technology stack detection, and integration with Google Sheets for data export. It features a modern React frontend with real-time progress tracking and a robust Express.js backend with PostgreSQL database storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Modern component-based UI built with React 18 and TypeScript for type safety
- **Vite Build System**: Fast development server and optimized production builds with hot module replacement
- **Shadcn/ui Components**: Pre-built, accessible UI components using Radix UI primitives with Tailwind CSS styling
- **TanStack React Query**: Server state management with caching, background updates, and optimistic updates
- **React Hook Form + Zod**: Form handling with schema validation and type-safe form data
- **Wouter Router**: Lightweight client-side routing solution

### Backend Architecture
- **Express.js Server**: RESTful API server with middleware for logging, error handling, and JSON parsing
- **TypeScript**: Full type safety across the backend with shared schema definitions
- **Modular Service Architecture**: Separate services for web crawling, technology detection, GLM API integration, and Google Sheets export
- **Async Job Processing**: Background processing for website analysis with status tracking

### Data Storage Solutions
- **PostgreSQL with Drizzle ORM**: Type-safe database operations with schema migrations
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Schema-First Design**: Shared TypeScript schemas between frontend and backend using Drizzle and Zod

### Authentication and Authorization
- **No Authentication System**: Currently operates without user authentication - all analysis jobs are accessible to any user
- **Session-Based Architecture Ready**: Database schema includes user tables for future authentication implementation

### External Service Integrations
- **Google Sheets API**: Service account authentication for exporting analysis results to spreadsheets
- **GLM (Zhipu AI) API**: AI-powered content analysis and page categorization
- **Web Scraping**: Axios-based HTTP client with Cheerio for HTML parsing and content extraction
- **File Upload System**: Multer middleware for handling service account JSON file uploads

### Key Design Patterns
- **Shared Schema Architecture**: Common TypeScript types and validation schemas shared between client and server
- **Repository Pattern**: Database storage abstraction with interface-based design for easy testing and swapping
- **Service Layer Pattern**: Business logic separated into dedicated service classes
- **Real-time Updates**: Polling-based progress tracking with React Query for live status updates
- **Error Boundary Handling**: Comprehensive error handling with user-friendly error messages

### Technology Detection Strategy
- **Multi-source Detection**: Combines sitemap parsing, manual crawling, and HTML analysis
- **Intelligent Fallbacks**: Gracefully falls back from sitemap to manual crawling if sitemap is unavailable
- **Technology Fingerprinting**: Detects frameworks, CMS platforms, analytics tools, and hosting providers through HTML patterns and HTTP headers
- **Content Categorization**: AI-powered page type classification (homepage, about, contact, product pages)
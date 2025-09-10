import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import TechnologyResults from "@/components/technology-results";
import SitemapTable from "@/components/sitemap-table";
import { api } from "@/lib/api";
import type { AnalysisJob } from "@shared/schema";
import { Download, RefreshCw, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";

interface ProgressDashboardProps {
  currentJob: AnalysisJob | null;
}

export default function ProgressDashboard({ currentJob }: ProgressDashboardProps) {
  const {
    data: jobData,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["/api/analysis", currentJob?.id],
    enabled: !!currentJob,
    refetchInterval: currentJob?.status === "running" ? 2000 : false,
  });

  useEffect(() => {
    if (currentJob) {
      refetch();
    }
  }, [currentJob, refetch]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-yellow-600 animate-spin" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Complete</Badge>;
      case "running":
        return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const progressSteps = [
    {
      title: "Technology Detection",
      description: jobData?.job.detectedTechnologies 
        ? `${jobData.job.detectedTechnologies.length} technologies detected`
        : "Analyzing website technology stack",
      status: jobData?.job.detectedTechnologies ? "completed" : 
              (jobData?.job.progress || 0) > 10 ? "running" : "pending"
    },
    {
      title: "Sitemap Crawling",
      description: jobData?.job.totalPages 
        ? `${jobData.job.processedPages || 0}/${jobData.job.totalPages} pages crawled`
        : "Discovering website pages",
      status: (jobData?.job.progress || 0) > 50 ? "completed" :
              (jobData?.job.progress || 0) > 25 ? "running" : "pending"
    },
    {
      title: "Content Analysis",
      description: jobData?.job.glmApiKey 
        ? "Analyzing page content with AI"
        : "Skipped - no GLM API key provided",
      status: (jobData?.job.progress || 0) > 90 ? "completed" :
              (jobData?.job.progress || 0) > 50 ? "running" : "pending"
    },
    {
      title: "Export to Sheets",
      description: jobData?.job.sheetsId 
        ? "Exporting data to Google Sheets"
        : "Skipped - no Google Sheets configured",
      status: jobData?.job.status === "completed" ? "completed" :
              (jobData?.job.progress || 0) > 90 ? "running" : "pending"
    }
  ];

  if (!currentJob) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        <div className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Website Analysis Dashboard</h2>
              <p className="text-sm text-muted-foreground">Configure analysis settings to get started</p>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
              <span className="text-muted-foreground">No active analysis</span>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Download className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Ready to Analyze</h3>
            <p className="text-muted-foreground max-w-md">
              Enter a website URL and configure your analysis settings to start mapping and documenting a website.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top Navigation */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Website Analysis Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Analyzing: {jobData?.job.websiteUrl || currentJob.websiteUrl}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-sm">
              {getStatusIcon(jobData?.job.status || currentJob.status)}
              <span className="text-muted-foreground capitalize">
                {jobData?.job.status || currentJob.status}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {jobData?.job.status === "completed" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/api/analysis/${jobData.job.id}/export`, '_blank')}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Progress Section */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-medium text-foreground mb-4">Analysis Progress</h3>
          
          <div className="space-y-4 mb-6">
            {progressSteps.map((step, index) => (
              <div key={index} className="flex items-center space-x-4" data-testid={`progress-step-${index}`}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center">
                  {getStatusIcon(step.status)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {getStatusBadge(step.status)}
              </div>
            ))}
          </div>

          {/* Overall Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-foreground">Overall Progress</span>
              <span className="text-muted-foreground" data-testid="text-progress-percentage">
                {jobData?.job.progress || currentJob.progress || 0}%
              </span>
            </div>
            <Progress 
              value={jobData?.job.progress || currentJob.progress || 0} 
              className="h-2"
              data-testid="progress-bar-overall"
            />
          </div>
        </div>

        {/* Technology Results */}
        {jobData?.job.detectedTechnologies && (
          <TechnologyResults technologies={jobData.job.detectedTechnologies} />
        )}

        {/* Sitemap Table */}
        {jobData?.pages && jobData.pages.length > 0 && (
          <SitemapTable 
            pages={jobData.pages} 
            totalPages={jobData.totalPages}
            jobId={jobData.job.id}
          />
        )}
      </div>
    </div>
  );
}

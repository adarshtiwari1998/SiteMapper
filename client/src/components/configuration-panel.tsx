import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/ui/file-upload";
import { api } from "@/lib/api";
import type { AnalysisJob } from "@shared/schema";
import { Globe, Table, Brain, Cog, Play, Save, Check, Eye, EyeOff } from "lucide-react";

const formSchema = z.object({
  websiteUrl: z.string().url("Please enter a valid URL"),
  technologyType: z.string().optional(),
  maxPages: z.number().min(1).max(1000),
  includeImages: z.boolean(),
  deepAnalysis: z.boolean(),
  sheetsId: z.string().optional(),
  glmApiKey: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ConfigurationPanelProps {
  onJobCreated: (job: AnalysisJob) => void;
}

export default function ConfigurationPanel({ onJobCreated }: ConfigurationPanelProps) {
  const [serviceAccountJson, setServiceAccountJson] = useState<any>(null);
  const [showGlmKey, setShowGlmKey] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    sheets?: boolean;
    glm?: boolean;
  }>({});
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      websiteUrl: "",
      technologyType: "auto",
      maxPages: 100,
      includeImages: true,
      deepAnalysis: false,
      sheetsId: "",
      glmApiKey: "",
    },
  });

  const startAnalysisMutation = useMutation({
    mutationFn: api.startAnalysis,
    onSuccess: (data) => {
      toast({
        title: "Analysis Started",
        description: "Website analysis has been initiated successfully.",
      });
      // Create a mock job object for the UI
      const mockJob: AnalysisJob = {
        id: data.jobId,
        websiteUrl: form.getValues("websiteUrl"),
        status: "running",
        progress: 0,
        totalPages: 0,
        processedPages: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null,
        technologyType: form.getValues("technologyType") || null,
        sheetsId: form.getValues("sheetsId") || null,
        glmApiKey: form.getValues("glmApiKey") || null,
        serviceAccountJson: serviceAccountJson,
        maxPages: form.getValues("maxPages"),
        includeImages: form.getValues("includeImages"),
        deepAnalysis: form.getValues("deepAnalysis"),
        detectedTechnologies: null,
      };
      onJobCreated(mockJob);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.message || "Failed to start website analysis.",
      });
    },
  });

  const verifySheetsMutation = useMutation({
    mutationFn: ({ sheetsId, serviceAccountJson }: { sheetsId: string; serviceAccountJson: any }) =>
      api.verifySheets(sheetsId, serviceAccountJson),
    onSuccess: (data) => {
      setVerificationStatus(prev => ({ ...prev, sheets: true }));
      toast({
        title: "Sheets Verified",
        description: `Access to "${data.sheetTitle}" confirmed.`,
      });
    },
    onError: (error: any) => {
      setVerificationStatus(prev => ({ ...prev, sheets: false }));
      toast({
        variant: "destructive",
        title: "Verification Failed",
        description: error.message || "Failed to verify Google Sheets access.",
      });
    },
  });

  const testGlmMutation = useMutation({
    mutationFn: api.testGlmApi,
    onSuccess: () => {
      setVerificationStatus(prev => ({ ...prev, glm: true }));
      toast({
        title: "GLM API Verified",
        description: "API key is valid and working.",
      });
    },
    onError: (error: any) => {
      setVerificationStatus(prev => ({ ...prev, glm: false }));
      toast({
        variant: "destructive",
        title: "API Test Failed",
        description: error.message || "Invalid GLM API key.",
      });
    },
  });

  const handleServiceAccountUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setServiceAccountJson(json);
        toast({
          title: "File Uploaded",
          description: `Service account for ${json.client_email} uploaded successfully.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Invalid File",
          description: "Please upload a valid JSON file.",
        });
      }
    };
    reader.readAsText(file);
  };

  const handleVerifySheets = () => {
    const sheetsId = form.getValues("sheetsId");
    if (!sheetsId || !serviceAccountJson) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide both Sheets ID and service account JSON.",
      });
      return;
    }
    verifySheetsMutation.mutate({ sheetsId, serviceAccountJson });
  };

  const handleTestGlm = () => {
    const apiKey = form.getValues("glmApiKey");
    if (!apiKey) {
      toast({
        variant: "destructive",
        title: "Missing API Key",
        description: "Please enter your GLM API key.",
      });
      return;
    }
    testGlmMutation.mutate(apiKey);
  };

  const onSubmit = (data: FormData) => {
    startAnalysisMutation.mutate({
      ...data,
      serviceAccountJson,
    });
  };

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col" data-testid="configuration-panel">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Globe className="text-primary-foreground h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">SiteMapper Pro</h1>
            <p className="text-sm text-muted-foreground">Website Analysis Tool</p>
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl" className="text-sm font-medium">Website URL</Label>
            <div className="relative">
              <Input
                id="websiteUrl"
                type="url"
                placeholder="https://www.example.com"
                {...form.register("websiteUrl")}
                data-testid="input-website-url"
                className="pr-10"
              />
              <Globe className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            </div>
            {form.formState.errors.websiteUrl && (
              <p className="text-sm text-destructive">{form.formState.errors.websiteUrl.message}</p>
            )}
          </div>

          {/* Technology Detection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Website Technology</Label>
            <Select
              value={form.watch("technologyType")}
              onValueChange={(value) => form.setValue("technologyType", value)}
              data-testid="select-technology"
            >
              <SelectTrigger>
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="wordpress">WordPress</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="react">React/Next.js</SelectItem>
                <SelectItem value="vue">Vue.js/Nuxt.js</SelectItem>
                <SelectItem value="angular">Angular</SelectItem>
                <SelectItem value="static">Static HTML</SelectItem>
                <SelectItem value="cms">Custom CMS</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Google Sheets Configuration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Table className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">Google Sheets Configuration</h3>
            </div>

            {/* Service Account Upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Service Account JSON</Label>
              <FileUpload
                accept=".json"
                onFileSelect={handleServiceAccountUpload}
                data-testid="upload-service-account"
              />
              {serviceAccountJson && (
                <div className="flex items-center space-x-2 p-2 bg-secondary rounded-md">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-secondary-foreground">
                    {serviceAccountJson.client_email}
                  </span>
                </div>
              )}
            </div>

            {/* Sheets ID */}
            <div className="space-y-2">
              <Label htmlFor="sheetsId" className="text-sm font-medium">Google Sheets ID</Label>
              <Input
                id="sheetsId"
                placeholder="1Be5LuAhJaliGfqb7fJPYXkrdgIM94p_ZgmYUQxCaqNA"
                {...form.register("sheetsId")}
                data-testid="input-sheets-id"
              />
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleVerifySheets}
                  disabled={verifySheetsMutation.isPending}
                  data-testid="button-verify-sheets"
                >
                  {verifySheetsMutation.isPending ? "Verifying..." : "Verify Access"}
                </Button>
                {verificationStatus.sheets !== undefined && (
                  <Badge variant={verificationStatus.sheets ? "default" : "destructive"}>
                    <Check className="h-3 w-3 mr-1" />
                    {verificationStatus.sheets ? "Verified" : "Failed"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* GLM API Configuration */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">GLM 4.5 Flash API</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="glmApiKey" className="text-sm font-medium">API Key</Label>
              <div className="relative">
                <Input
                  id="glmApiKey"
                  type={showGlmKey ? "text" : "password"}
                  placeholder="Enter GLM 4.5 Flash API key"
                  {...form.register("glmApiKey")}
                  data-testid="input-glm-api-key"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowGlmKey(!showGlmKey)}
                  data-testid="button-toggle-glm-visibility"
                >
                  {showGlmKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleTestGlm}
                  disabled={testGlmMutation.isPending}
                  data-testid="button-test-glm"
                >
                  {testGlmMutation.isPending ? "Testing..." : "Test API"}
                </Button>
                {verificationStatus.glm !== undefined && (
                  <Badge variant={verificationStatus.glm ? "default" : "destructive"}>
                    <Check className="h-3 w-3 mr-1" />
                    {verificationStatus.glm ? "Valid" : "Invalid"}
                  </Badge>
                )}
              </div>
              <a
                href="https://docs.z.ai/guides/llm/glm-4.5"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                Get your API key from Z.ai
              </a>
            </div>
          </div>

          <Separator />

          {/* Analysis Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Cog className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium text-foreground">Analysis Settings</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxPages" className="text-sm">Max Pages to Crawl</Label>
                <Input
                  id="maxPages"
                  type="number"
                  min="1"
                  max="1000"
                  className="w-20 text-center"
                  {...form.register("maxPages", { valueAsNumber: true })}
                  data-testid="input-max-pages"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="includeImages" className="text-sm">Include Images</Label>
                <Switch
                  id="includeImages"
                  checked={form.watch("includeImages")}
                  onCheckedChange={(checked) => form.setValue("includeImages", checked)}
                  data-testid="switch-include-images"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="deepAnalysis" className="text-sm">Deep Analysis</Label>
                <Switch
                  id="deepAnalysis"
                  checked={form.watch("deepAnalysis")}
                  onCheckedChange={(checked) => form.setValue("deepAnalysis", checked)}
                  data-testid="switch-deep-analysis"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={startAnalysisMutation.isPending}
              data-testid="button-start-analysis"
            >
              <Play className="mr-2 h-4 w-4" />
              {startAnalysisMutation.isPending ? "Starting..." : "Start Analysis"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              data-testid="button-save-config"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

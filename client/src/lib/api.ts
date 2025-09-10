import { apiRequest } from "./queryClient";

export const api = {
  async startAnalysis(data: any) {
    const response = await apiRequest("POST", "/api/analysis/start", data);
    return response.json();
  },

  async getAnalysisJob(jobId: string) {
    const response = await apiRequest("GET", `/api/analysis/${jobId}`);
    return response.json();
  },

  async uploadServiceAccount(file: File) {
    const formData = new FormData();
    formData.append('serviceAccount', file);
    
    const response = await fetch('/api/upload/service-account', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    return response.json();
  },

  async verifySheets(sheetsId: string, serviceAccountJson: any) {
    const response = await apiRequest("POST", "/api/sheets/verify", {
      sheetsId,
      serviceAccountJson
    });
    return response.json();
  },

  async testGlmApi(apiKey: string) {
    const response = await apiRequest("POST", "/api/glm/test", { apiKey });
    return response.json();
  },

  async exportCsv(jobId: string) {
    const response = await apiRequest("GET", `/api/analysis/${jobId}/export`);
    return response.blob();
  },

  async saveConfiguration(data: any) {
    const response = await apiRequest("POST", "/api/configurations", data);
    return response.json();
  },

  async getDefaultConfiguration() {
    const response = await apiRequest("GET", "/api/configurations/default");
    return response.json();
  },

  async getAllConfigurations() {
    const response = await apiRequest("GET", "/api/configurations");
    return response.json();
  },

  async updateConfiguration(id: string, data: any) {
    const response = await apiRequest("PUT", `/api/configurations/${id}`, data);
    return response.json();
  }
};

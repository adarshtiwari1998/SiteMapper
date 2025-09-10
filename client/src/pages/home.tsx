import { useState } from "react";
import ConfigurationPanel from "@/components/configuration-panel";
import ProgressDashboard from "@/components/progress-dashboard";
import type { AnalysisJob } from "@shared/schema";

export default function Home() {
  const [currentJob, setCurrentJob] = useState<AnalysisJob | null>(null);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ConfigurationPanel onJobCreated={setCurrentJob} />
      <ProgressDashboard currentJob={currentJob} />
    </div>
  );
}

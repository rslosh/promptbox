"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import type { IngestionJob } from "@/lib/supabase/types";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";

export default function JobsPage() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchJobs() {
    const { data, error } = await supabase
      .from("ingestion_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching jobs:", error);
      setIsLoading(false);
      return;
    }

    setJobs(data || []);
    setIsLoading(false);
  }

  async function deleteJob(id: string) {
    if (!confirm("Are you sure you want to delete this job?")) return;

    await supabase.from("ingestion_jobs").delete().eq("id", id);
    fetchJobs();
  }

  async function retryJob(job: IngestionJob) {
    await supabase
      .from("ingestion_jobs")
      .update({ status: "queued", error: null })
      .eq("id", job.id);
    fetchJobs();
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <Clock className="h-4 w-4 text-amber-600" />;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "completed":
        return "border border-emerald-200 bg-emerald-50 text-emerald-700";
      case "failed":
        return "border border-red-200 bg-red-50 text-red-600";
      case "running":
        return "border border-blue-200 bg-blue-50 text-blue-700";
      default:
        return "border border-amber-200 bg-amber-50 text-amber-700";
    }
  }

  const runningJobs = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const failedJobs = jobs.filter((j) => j.status === "failed");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 pl-64">
        <Header
          title="Ingestion Jobs"
          description={`${runningJobs.length} active, ${completedJobs.length} completed, ${failedJobs.length} failed`}
          actions={
            <Button variant="outline" onClick={fetchJobs}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
          }
        />

        <div className="p-6 space-y-6 max-w-4xl">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
                <div className="text-sm text-gray-600">Total Jobs</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">{runningJobs.length}</div>
                <div className="text-sm text-gray-600">Active</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-emerald-600">{completedJobs.length}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{failedJobs.length}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </CardContent>
            </Card>
          </div>

          {/* Job list */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-black/[0.06]" />
                  ))}
                </div>
              ) : jobs.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-600">No jobs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between rounded-lg border border-black/[0.08] bg-black/[0.03] p-4"
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(job.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(job.status)}>
                              {job.status}
                            </Badge>
                            <Badge variant="outline">{job.source_type}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-gray-600 truncate max-w-md">
                            {job.source_ref}
                          </p>
                          {job.error && (
                            <p className="mt-1 text-xs text-red-400 truncate max-w-md">
                              {job.error}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                          {formatRelativeTime(job.created_at)}
                        </span>
                        <div className="flex gap-1">
                          {job.status === "failed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => retryJob(job)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => deleteJob(job.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

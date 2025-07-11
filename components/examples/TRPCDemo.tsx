/**
 * tRPC Demo Component
 *
 * This component demonstrates how to use tRPC hooks for queries and mutations.
 * Can be used as a reference for migrating existing components.
 */

"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";

export function TRPCDemo() {
  const [sessionFilters, setSessionFilters] = useState({
    search: "",
    page: 1,
    limit: 5,
  });

  // Queries
  const {
    data: sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = trpc.dashboard.getSessions.useQuery(sessionFilters);

  const { data: overview, isLoading: overviewLoading } =
    trpc.dashboard.getOverview.useQuery({});

  const { data: topQuestions, isLoading: questionsLoading } =
    trpc.dashboard.getTopQuestions.useQuery({ limit: 3 });

  // Mutations
  const refreshSessionsMutation = trpc.dashboard.refreshSessions.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // Invalidate and refetch sessions
      refetchSessions();
    },
    onError: (error) => {
      toast.error(`Failed to refresh sessions: ${error.message}`);
    },
  });

  const handleRefreshSessions = () => {
    refreshSessionsMutation.mutate();
  };

  const handleSearchChange = (search: string) => {
    setSessionFilters((prev) => ({ ...prev, search, page: 1 }));
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">tRPC Demo</h2>
        <Button
          onClick={handleRefreshSessions}
          disabled={refreshSessionsMutation.isPending}
          variant="outline"
        >
          {refreshSessionsMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Sessions
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Total Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {overview?.totalSessions || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg Messages</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <div className="text-2xl font-bold">
                {Math.round(overview?.avgMessagesSent || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Sentiment Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : (
              <div className="space-y-1">
                {overview?.sentimentDistribution.map((item) => (
                  <div
                    key={item.sentiment}
                    className="flex justify-between text-sm"
                  >
                    <span>{item.sentiment}</span>
                    <Badge variant="outline">{item.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Top Questions</CardTitle>
        </CardHeader>
        <CardContent>
          {questionsLoading ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading questions...
            </div>
          ) : (
            <div className="space-y-2">
              {topQuestions?.map((item) => (
                <div
                  key={item.question}
                  className="flex justify-between items-center"
                >
                  <span className="text-sm">{item.question}</span>
                  <Badge>{item.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Sessions
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search sessions..."
                value={sessionFilters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-64"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsError && (
            <div className="text-red-600 mb-4">
              Error loading sessions: {sessionsError.message}
            </div>
          )}

          {sessionsLoading ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading sessions...
            </div>
          ) : (
            <div className="space-y-4">
              {sessions?.sessions.map((session) => (
                <div key={session.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">Session {session.id}</span>
                      <Badge
                        variant={
                          session.sentiment === "POSITIVE"
                            ? "default"
                            : session.sentiment === "NEGATIVE"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {session.sentiment}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {session.messagesSent} messages
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {session.summary}
                  </p>
                  {session.questions && session.questions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {session.questions.slice(0, 3).map((question) => (
                        <Badge
                          key={question}
                          variant="outline"
                          className="text-xs"
                        >
                          {question.length > 50
                            ? `${question.slice(0, 50)}...`
                            : question}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Pagination Info */}
              {sessions && (
                <div className="text-center text-sm text-muted-foreground">
                  Showing {sessions.sessions.length} of{" "}
                  {sessions.pagination.totalCount} sessions (Page{" "}
                  {sessions.pagination.page} of {sessions.pagination.totalPages}
                  )
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import SessionDetails from "../../../../components/SessionDetails";
import MessageViewer from "../../../../components/MessageViewer";
import { ChatSession } from "../../../../lib/types";
import { formatCategory } from "@/lib/format-enums";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MessageSquare,
  Clock,
  Globe,
  ExternalLink,
  User,
  AlertCircle,
  FileText,
  Activity,
} from "lucide-react";

export default function SessionViewPage() {
  const params = useParams();
  const router = useRouter(); // Initialize useRouter
  const { status } = useSession(); // Get session status, removed unused sessionData
  const id = params?.id as string;
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true); // This will now primarily be for data fetching
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && id) {
      const fetchSession = async () => {
        setLoading(true); // Always set loading before fetch
        setError(null);
        try {
          const response = await fetch(`/api/dashboard/session/${id}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error ||
                `Failed to fetch session: ${response.statusText}`
            );
          }
          const data = await response.json();
          setSession(data.session);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "An unknown error occurred"
          );
          setSession(null);
        } finally {
          setLoading(false);
        }
      };
      fetchSession();
    } else if (status === "authenticated" && !id) {
      setError("Session ID is missing.");
      setLoading(false);
    }
  }, [id, status, router]); // session removed from dependencies

  if (status === "loading") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              Loading session...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              Redirecting to login...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && status === "authenticated") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              Loading session details...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-destructive text-lg mb-4">Error: {error}</p>
              <Link href="/dashboard/sessions">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sessions List
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-4">
                Session not found.
              </p>
              <Link href="/dashboard/sessions">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sessions List
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-2">
              <Link href="/dashboard/sessions">
                <Button
                  variant="ghost"
                  className="gap-2 p-0 h-auto focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  aria-label="Return to sessions list"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to Sessions List
                </Button>
              </Link>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Session Details</h1>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs">
                    ID
                  </Badge>
                  <code className="text-sm text-muted-foreground font-mono">
                    {(session.sessionId || session.id).slice(0, 8)}...
                  </code>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {session.category && (
                <Badge variant="secondary" className="gap-1">
                  <Activity className="h-3 w-3" />
                  {formatCategory(session.category)}
                </Badge>
              )}
              {session.language && (
                <Badge variant="outline" className="gap-1">
                  <Globe className="h-3 w-3" />
                  {session.language.toUpperCase()}
                </Badge>
              )}
              {session.sentiment && (
                <Badge
                  variant={
                    session.sentiment === "positive"
                      ? "default"
                      : session.sentiment === "negative"
                        ? "destructive"
                        : "secondary"
                  }
                  className="gap-1"
                >
                  {session.sentiment.charAt(0).toUpperCase() +
                    session.sentiment.slice(1)}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Start Time</p>
                <p className="font-semibold">
                  {new Date(session.startTime).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Messages</p>
                <p className="font-semibold">{session.messages?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="font-semibold truncate">
                  {session.userId || "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-semibold">
                  {session.endTime && session.startTime
                    ? `${Math.round(
                        (new Date(session.endTime).getTime() -
                          new Date(session.startTime).getTime()) /
                          60000
                      )} min`
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Details */}
      <SessionDetails session={session} />

      {/* Messages */}
      {session.messages && session.messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation ({session.messages.length} messages)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MessageViewer messages={session.messages} />
          </CardContent>
        </Card>
      )}

      {/* Transcript URL */}
      {session.fullTranscriptUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Source Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={session.fullTranscriptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
              aria-label="Open original transcript in new tab"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View Original Transcript
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

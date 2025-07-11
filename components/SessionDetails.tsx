"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCategory } from "@/lib/format-enums";
import type { ChatSession } from "../lib/types";
import CountryDisplay from "./CountryDisplay";
import LanguageDisplay from "./LanguageDisplay";

interface SessionDetailsProps {
  session: ChatSession;
}

/**
 * Component for basic session information
 */
function SessionBasicInfo({ session }: { session: ChatSession }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Basic Information
        </h4>
        <div className="space-y-2">
          <div>
            <span className="text-xs text-muted-foreground">Session ID:</span>
            <code className="ml-2 text-xs font-mono bg-muted px-1 py-0.5 rounded">
              {session.id.slice(0, 8)}...
            </code>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Start Time:</span>
            <span className="ml-2 text-sm">
              {new Date(session.startTime).toLocaleString()}
            </span>
          </div>
          {session.endTime && (
            <div>
              <span className="text-xs text-muted-foreground">End Time:</span>
              <span className="ml-2 text-sm">
                {new Date(session.endTime).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Component for session location and language
 */
function SessionLocationInfo({ session }: { session: ChatSession }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Location & Language
        </h4>
        <div className="space-y-2">
          {session.countryCode && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Country:</span>
              <CountryDisplay countryCode={session.countryCode} />
            </div>
          )}
          {session.language && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Language:</span>
              <LanguageDisplay languageCode={session.language} />
            </div>
          )}
          {session.ipAddress && (
            <div>
              <span className="text-xs text-muted-foreground">IP Address:</span>
              <span className="ml-2 font-mono text-sm">
                {session.ipAddress}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Component for session metrics
 */
function SessionMetrics({ session }: { session: ChatSession }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Session Metrics
        </h4>
        <div className="space-y-2">
          {session.messagesSent !== null &&
            session.messagesSent !== undefined && (
              <div>
                <span className="text-xs text-muted-foreground">
                  Messages Sent:
                </span>
                <span className="ml-2 text-sm font-medium">
                  {session.messagesSent}
                </span>
              </div>
            )}
          {session.userId && (
            <div>
              <span className="text-xs text-muted-foreground">User ID:</span>
              <span className="ml-2 text-sm">{session.userId}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Component for session analysis and status
 */
function SessionAnalysis({ session }: { session: ChatSession }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          AI Analysis
        </h4>
        <div className="space-y-2">
          {session.category && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Category:</span>
              <Badge variant="secondary" className="text-xs">
                {formatCategory(session.category)}
              </Badge>
            </div>
          )}
          {session.sentiment && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sentiment:</span>
              <Badge
                variant={
                  session.sentiment === "positive"
                    ? "default"
                    : session.sentiment === "negative"
                      ? "destructive"
                      : "secondary"
                }
                className="text-xs"
              >
                {session.sentiment.charAt(0).toUpperCase() +
                  session.sentiment.slice(1)}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Component for session status flags
 */
function SessionStatusFlags({ session }: { session: ChatSession }) {
  const hasStatusFlags =
    session.escalated !== null || session.forwardedHr !== null;

  if (!hasStatusFlags) return null;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-2">
          Status Flags
        </h4>
        <div className="space-y-2">
          {session.escalated !== null && session.escalated !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Escalated:</span>
              <Badge
                variant={session.escalated ? "destructive" : "outline"}
                className="text-xs"
              >
                {session.escalated ? "Yes" : "No"}
              </Badge>
            </div>
          )}
          {session.forwardedHr !== null &&
            session.forwardedHr !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Forwarded to HR:
                </span>
                <Badge
                  variant={session.forwardedHr ? "destructive" : "outline"}
                  className="text-xs"
                >
                  {session.forwardedHr ? "Yes" : "No"}
                </Badge>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

/**
 * Component for session summary
 */
function SessionSummary({ session }: { session: ChatSession }) {
  if (!session.summary) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">AI Summary</h4>
      <p className="text-sm leading-relaxed border-l-4 border-muted pl-4 italic">
        {session.summary}
      </p>
    </div>
  );
}

/**
 * Component to display session details with formatted country and language names
 */
export default function SessionDetails({ session }: SessionDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SessionBasicInfo session={session} />
          <SessionLocationInfo session={session} />
        </div>

        <Separator />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SessionMetrics session={session} />
          <SessionAnalysis session={session} />
        </div>

        <SessionStatusFlags session={session} />

        <SessionSummary session={session} />

        {!session.summary && session.initialMsg && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Initial Message
            </h4>
            <p className="text-sm leading-relaxed border-l-4 border-muted pl-4 italic">
              &quot;{session.initialMsg}&quot;
            </p>
          </div>
        )}

        {session.fullTranscriptUrl && (
          <>
            <Separator />
            <div>
              <a
                href={session.fullTranscriptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
                aria-label="Open full transcript in new tab"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                View Full Transcript
              </a>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

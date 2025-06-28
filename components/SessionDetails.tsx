"use client";

import { ChatSession } from "../lib/types";
import LanguageDisplay from "./LanguageDisplay";
import CountryDisplay from "./CountryDisplay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink } from "lucide-react";

interface SessionDetailsProps {
  session: ChatSession;
}

/**
 * Component to display session details with formatted country and language names
 */
export default function SessionDetails({ session }: SessionDetailsProps) {
  // Helper function to format category names
  const formatCategory = (category: string) => {
    if (category === 'UNRECOGNIZED_OTHER' || category === 'ACCESS_LOGIN') {
      return null; // Don't show these internal enum values
    }
    return category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Session ID</p>
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                {session.id.slice(0, 8)}...
              </code>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Start Time</p>
              <p className="font-medium">
                {new Date(session.startTime).toLocaleString()}
              </p>
            </div>

            {session.endTime && (
              <div>
                <p className="text-sm text-muted-foreground">End Time</p>
                <p className="font-medium">
                  {new Date(session.endTime).toLocaleString()}
                </p>
              </div>
            )}

            {session.category && formatCategory(session.category) && (
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <Badge variant="secondary">
                  {formatCategory(session.category)}
                </Badge>
              </div>
            )}

            {session.language && (
              <div>
                <p className="text-sm text-muted-foreground">Language</p>
                <div className="flex items-center gap-2">
                  <LanguageDisplay languageCode={session.language} />
                  <Badge variant="outline" className="text-xs">
                    {session.language.toUpperCase()}
                  </Badge>
                </div>
              </div>
            )}

            {session.country && (
              <div>
                <p className="text-sm text-muted-foreground">Country</p>
                <div className="flex items-center gap-2">
                  <CountryDisplay countryCode={session.country} />
                  <Badge variant="outline" className="text-xs">
                    {session.country}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {session.sentiment !== null && session.sentiment !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Sentiment</p>
                <Badge
                  variant={
                    session.sentiment === "positive"
                      ? "default"
                      : session.sentiment === "negative"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {session.sentiment.charAt(0).toUpperCase() + session.sentiment.slice(1)}
                </Badge>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">Messages Sent</p>
              <p className="font-medium">{session.messagesSent || 0}</p>
            </div>

            {session.avgResponseTime !== null && session.avgResponseTime !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="font-medium">{session.avgResponseTime.toFixed(2)}s</p>
              </div>
            )}

            {session.escalated !== null && session.escalated !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Escalated</p>
                <Badge variant={session.escalated ? "destructive" : "default"}>
                  {session.escalated ? "Yes" : "No"}
                </Badge>
              </div>
            )}

            {session.forwardedHr !== null && session.forwardedHr !== undefined && (
              <div>
                <p className="text-sm text-muted-foreground">Forwarded to HR</p>
                <Badge variant={session.forwardedHr ? "secondary" : "default"}>
                  {session.forwardedHr ? "Yes" : "No"}
                </Badge>
              </div>
            )}

            {session.ipAddress && (
              <div>
                <p className="text-sm text-muted-foreground">IP Address</p>
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {session.ipAddress}
                </code>
              </div>
            )}
          </div>
        </div>

        {(session.summary || session.initialMsg) && <Separator />}

        {session.summary && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">AI Summary</p>
            <div className="bg-muted p-3 rounded-md text-sm">
              {session.summary}
            </div>
          </div>
        )}

        {!session.summary && session.initialMsg && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Initial Message</p>
            <div className="bg-muted p-3 rounded-md text-sm italic">
              &quot;{session.initialMsg}&quot;
            </div>
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
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View Full Transcript
              </a>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

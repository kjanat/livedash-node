"use client";

import { ChatSession } from "../lib/types";
import LanguageDisplay from "./LanguageDisplay";
import CountryDisplay from "./CountryDisplay";

interface SessionDetailsProps {
  session: ChatSession;
}

/**
 * Component to display session details with formatted country and language names
 */
export default function SessionDetails({ session }: SessionDetailsProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-bold text-lg mb-3">Session Details</h3>

      <div className="space-y-2">
        <div className="flex justify-between border-b pb-2">
          <span className="text-gray-600">Session ID:</span>
          <span className="font-medium">{session.sessionId || session.id}</span>
        </div>

        <div className="flex justify-between border-b pb-2">
          <span className="text-gray-600">Start Time:</span>
          <span className="font-medium">
            {new Date(session.startTime).toLocaleString()}
          </span>
        </div>

        {session.endTime && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">End Time:</span>
            <span className="font-medium">
              {new Date(session.endTime).toLocaleString()}
            </span>
          </div>
        )}

        {session.category && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Category:</span>
            <span className="font-medium">{session.category}</span>
          </div>
        )}

        {session.language && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Language:</span>
            <span className="font-medium">
              <LanguageDisplay languageCode={session.language} />
              <span className="text-gray-400 text-xs ml-1">
                ({session.language.toUpperCase()})
              </span>
            </span>
          </div>
        )}

        {session.country && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Country:</span>
            <span className="font-medium">
              <CountryDisplay countryCode={session.country} />
              <span className="text-gray-400 text-xs ml-1">
                ({session.country})
              </span>
            </span>
          </div>
        )}

        {session.sentiment !== null && session.sentiment !== undefined && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Sentiment Score:</span>
            <span
              className={`font-medium ${
                session.sentiment > 0.3
                  ? "text-green-500"
                  : session.sentiment < -0.3
                    ? "text-red-500"
                    : "text-orange-500"
              }`}
            >
              {session.sentiment > 0.3
                ? "Positive"
                : session.sentiment < -0.3
                  ? "Negative"
                  : "Neutral"}{" "}
              ({session.sentiment.toFixed(2)})
            </span>
          </div>
        )}

        {session.sentimentCategory && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">AI Sentiment:</span>
            <span
              className={`font-medium capitalize ${
                session.sentimentCategory === "positive"
                  ? "text-green-500"
                  : session.sentimentCategory === "negative"
                    ? "text-red-500"
                    : "text-orange-500"
              }`}
            >
              {session.sentimentCategory}
            </span>
          </div>
        )}

        <div className="flex justify-between border-b pb-2">
          <span className="text-gray-600">Messages Sent:</span>
          <span className="font-medium">{session.messagesSent || 0}</span>
        </div>

        {typeof session.tokens === "number" && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Tokens:</span>
            <span className="font-medium">{session.tokens}</span>
          </div>
        )}

        {typeof session.tokensEur === "number" && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Cost:</span>
            <span className="font-medium">€{session.tokensEur.toFixed(4)}</span>
          </div>
        )}

        {session.avgResponseTime !== null &&
          session.avgResponseTime !== undefined && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-600">Avg Response Time:</span>
              <span className="font-medium">
                {session.avgResponseTime.toFixed(2)}s
              </span>
            </div>
          )}

        {session.escalated !== null && session.escalated !== undefined && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Escalated:</span>
            <span
              className={`font-medium ${session.escalated ? "text-red-500" : "text-green-500"}`}
            >
              {session.escalated ? "Yes" : "No"}
            </span>
          </div>
        )}

        {session.forwardedHr !== null && session.forwardedHr !== undefined && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">Forwarded to HR:</span>
            <span
              className={`font-medium ${session.forwardedHr ? "text-amber-500" : "text-green-500"}`}
            >
              {session.forwardedHr ? "Yes" : "No"}
            </span>
          </div>
        )}

        {session.ipAddress && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">IP Address:</span>
            <span className="font-medium font-mono text-sm">{session.ipAddress}</span>
          </div>
        )}

        {session.processed !== null && session.processed !== undefined && (
          <div className="flex justify-between border-b pb-2">
            <span className="text-gray-600">AI Processed:</span>
            <span
              className={`font-medium ${session.processed ? "text-green-500" : "text-gray-500"}`}
            >
              {session.processed ? "Yes" : "No"}
            </span>
          </div>
        )}

        {session.initialMsg && (
          <div className="border-b pb-2">
            <span className="text-gray-600 block mb-1">Initial Message:</span>
            <div className="bg-gray-50 p-2 rounded text-sm italic">
              "{session.initialMsg}"
            </div>
          </div>
        )}

        {session.summary && (
          <div className="border-b pb-2">
            <span className="text-gray-600 block mb-1">AI Summary:</span>
            <div className="bg-blue-50 p-2 rounded text-sm">
              {session.summary}
            </div>
          </div>
        )}

        {session.questions && (
          <div className="border-b pb-2">
            <span className="text-gray-600 block mb-1">Questions Asked:</span>
            <div className="bg-yellow-50 p-2 rounded text-sm">
              {(() => {
                try {
                  const questions = JSON.parse(session.questions);
                  if (Array.isArray(questions) && questions.length > 0) {
                    return (
                      <ul className="list-disc list-inside space-y-1">
                        {questions.map((question: string, index: number) => (
                          <li key={index}>{question}</li>
                        ))}
                      </ul>
                    );
                  }
                  return "No questions identified";
                } catch {
                  return session.questions;
                }
              })()}
            </div>
          </div>
        )}

        {/* Transcript rendering is now handled by the parent page (app/dashboard/sessions/[id]/page.tsx) */}
        {/* Fallback to link only if we only have the URL but no content - this might also be redundant if parent handles all transcript display */}
        {(!session.transcriptContent ||
          session.transcriptContent.length === 0) &&
          session.fullTranscriptUrl && (
            <div className="flex justify-between pt-2">
              <span className="text-gray-600">Transcript:</span>
              <a
                href={session.fullTranscriptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700 underline"
              >
                View Full Transcript
              </a>
            </div>
          )}
      </div>
    </div>
  );
}

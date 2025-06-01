"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

interface TranscriptViewerProps {
  transcriptContent: string;
  transcriptUrl?: string | null;
}

/**
 * Format the transcript content into a more readable format with styling
 */
function formatTranscript(content: string): React.ReactNode[] {
  if (!content.trim()) {
    return [<p key="empty">No transcript content available.</p>];
  }

  // Split the transcript by lines
  const lines = content.split("\n");

  const elements: React.ReactNode[] = [];
  let currentSpeaker: string | null = null;
  let currentMessages: string[] = [];
  let currentTimestamp: string | null = null;

  // Process each line
  lines.forEach((line) => {
    line = line.trim();
    if (!line) {
      // Empty line, ignore
      return;
    }

    // Check if this is a new speaker line with or without datetime
    // Format 1: [29.05.2025 21:26:44] User: message
    // Format 2: User: message
    const datetimeMatch = line.match(
      /^\[([^\]]+)\]\s*(User|Assistant):\s*(.*)$/
    );
    const simpleMatch = line.match(/^(User|Assistant):\s*(.*)$/);

    if (datetimeMatch || simpleMatch) {
      // If we have accumulated messages for a previous speaker, add them
      if (currentSpeaker && currentMessages.length > 0) {
        elements.push(
          <div
            key={`message-${elements.length}`}
            className={`mb-3 ${currentSpeaker === "User" ? "text-right" : ""}`}
          >
            <div
              className={`inline-block px-4 py-2 rounded-lg ${
                currentSpeaker === "User"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {currentTimestamp && (
                <div className="text-xs opacity-60 mb-1">
                  {currentTimestamp}
                </div>
              )}
              {currentMessages.map((msg, i) => (
                // Use ReactMarkdown to render each message part
                <ReactMarkdown
                  key={i}
                  rehypePlugins={[rehypeRaw]} // Add rehypeRaw to plugins
                  components={{
                    p: "span",
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
                    a: ({ node: _node, ...props }) => (
                      <a
                        className="text-sky-600 hover:text-sky-800 underline"
                        {...props}
                      />
                    ),
                  }}
                >
                  {msg}
                </ReactMarkdown>
              ))}
            </div>
          </div>
        );
        currentMessages = [];
      }

      if (datetimeMatch) {
        // Format with datetime: [29.05.2025 21:26:44] User: message
        currentTimestamp = datetimeMatch[1];
        currentSpeaker = datetimeMatch[2];
        const messageContent = datetimeMatch[3].trim();
        if (messageContent) {
          currentMessages.push(messageContent);
        }
      } else if (simpleMatch) {
        // Format without datetime: User: message
        currentTimestamp = null;
        currentSpeaker = simpleMatch[1];
        const messageContent = simpleMatch[2].trim();
        if (messageContent) {
          currentMessages.push(messageContent);
        }
      }
    } else if (currentSpeaker) {
      // This is a continuation of the current speaker's message
      currentMessages.push(line);
    }
  });

  // Add any remaining messages
  if (currentSpeaker && currentMessages.length > 0) {
    elements.push(
      <div
        key={`message-${elements.length}`}
        className={`mb-3 ${currentSpeaker === "User" ? "text-right" : ""}`}
      >
        <div
          className={`inline-block px-4 py-2 rounded-lg ${
            currentSpeaker === "User"
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {currentTimestamp && (
            <div className="text-xs opacity-60 mb-1">{currentTimestamp}</div>
          )}
          {currentMessages.map((msg, i) => (
            // Use ReactMarkdown to render each message part
            <ReactMarkdown
              key={i}
              rehypePlugins={[rehypeRaw]} // Add rehypeRaw to plugins
              components={{
                p: "span",
                // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
                a: ({ node: _node, ...props }) => (
                  <a
                    className="text-sky-600 hover:text-sky-800 underline"
                    {...props}
                  />
                ),
              }}
            >
              {msg}
            </ReactMarkdown>
          ))}
        </div>
      </div>
    );
  }

  return elements;
}

/**
 * Component to display a chat transcript
 */
export default function TranscriptViewer({
  transcriptContent,
  transcriptUrl,
}: TranscriptViewerProps) {
  const [showRaw, setShowRaw] = useState(false);

  const formattedElements = formatTranscript(transcriptContent);

  // Hide "View Full Raw" button in production environment
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div className="bg-white shadow-lg rounded-lg p-4 md:p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Session Transcript
        </h2>
        <div className="flex items-center space-x-3">
          {transcriptUrl && !isProduction && (
            <a
              href={transcriptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-sky-600 hover:text-sky-800 hover:underline"
              title="View full raw transcript"
            >
              View Full Raw
            </a>
          )}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-sm text-sky-600 hover:text-sky-800 hover:underline"
            title={
              showRaw ? "Show formatted transcript" : "Show raw transcript"
            }
          >
            {showRaw ? "Formatted" : "Raw Text"}
          </button>
        </div>
      </div>

      {showRaw ? (
        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-3 rounded-md overflow-x-auto">
          {transcriptContent}
        </pre>
      ) : (
        <div className="space-y-2">
          {formattedElements.length > 0 ? (
            formattedElements
          ) : (
            <p className="text-gray-500">No transcript content available.</p>
          )}
        </div>
      )}
    </div>
  );
}

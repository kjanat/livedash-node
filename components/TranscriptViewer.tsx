"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw"; // Import rehype-raw

interface TranscriptViewerProps {
  transcriptContent: string;
  transcriptUrl?: string | null;
}

/**
 * Renders a message bubble with proper styling
 */
function renderMessageBubble(
  speaker: string,
  messages: string[],
  key: string
): React.ReactNode {
  return (
    <div key={key} className={`mb-3 ${speaker === "User" ? "text-right" : ""}`}>
      <div
        className={`inline-block px-4 py-2 rounded-lg ${
          speaker === "User"
            ? "bg-blue-100 text-blue-800"
            : "bg-gray-100 text-gray-800"
        }`}
      >
        {messages.map((msg, i) => (
          <ReactMarkdown
            key={`msg-${msg.substring(0, 20).replace(/\s/g, "-")}-${i}`}
            rehypePlugins={[rehypeRaw]}
            components={{
              p: "span",
              a: ({ node, ...props }) => (
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

/**
 * Checks if a line indicates a new speaker
 */
function isNewSpeakerLine(line: string): boolean {
  return line.startsWith("User:") || line.startsWith("Assistant:");
}

/**
 * Extracts speaker and message content from a speaker line
 */
function extractSpeakerInfo(line: string): {
  speaker: string;
  content: string;
} {
  const speaker = line.startsWith("User:") ? "User" : "Assistant";
  const content = line.substring(line.indexOf(":") + 1).trim();
  return { speaker, content };
}

/**
 * Processes accumulated messages for a speaker
 */
function processAccumulatedMessages(
  currentSpeaker: string | null,
  currentMessages: string[],
  elements: React.ReactNode[]
): void {
  if (currentSpeaker && currentMessages.length > 0) {
    elements.push(
      renderMessageBubble(
        currentSpeaker,
        currentMessages,
        `message-${elements.length}`
      )
    );
  }
}

/**
 * Format the transcript content into a more readable format with styling
 */
function formatTranscript(content: string): React.ReactNode[] {
  if (!content.trim()) {
    return [<p key="empty">No transcript content available.</p>];
  }

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let currentSpeaker: string | null = null;
  let currentMessages: string[] = [];

  // Process each line
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue; // Skip empty lines
    }

    if (isNewSpeakerLine(line)) {
      // Process any accumulated messages from previous speaker
      processAccumulatedMessages(currentSpeaker, currentMessages, elements);
      currentMessages = [];

      // Set new speaker and add initial content
      const { speaker, content } = extractSpeakerInfo(trimmedLine);
      currentSpeaker = speaker;
      if (content) {
        currentMessages.push(content);
      }
    } else if (currentSpeaker) {
      // Continuation of current speaker's message
      currentMessages.push(trimmedLine);
    }
  }

  // Process any remaining messages
  processAccumulatedMessages(currentSpeaker, currentMessages, elements);

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

  return (
    <div className="bg-white shadow-lg rounded-lg p-4 md:p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Session Transcript
        </h2>
        <div className="flex items-center space-x-3">
          {transcriptUrl && (
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
            type="button"
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

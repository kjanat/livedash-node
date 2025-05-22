"use client";

import { useState } from "react";

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

  // Process each line
  lines.forEach((line) => {
    line = line.trim();
    if (!line) {
      // Empty line, ignore
      return;
    }

    // Check if this is a new speaker line
    if (line.startsWith("User:") || line.startsWith("Assistant:")) {
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
              {currentMessages.map((msg, i) => (
                <p key={i}>{msg}</p>
              ))}
            </div>
          </div>
        );
        currentMessages = [];
      }

      // Set the new current speaker
      currentSpeaker = line.startsWith("User:") ? "User" : "Assistant";
      // Add the content after "User:" or "Assistant:"
      const messageContent = line.substring(line.indexOf(":") + 1).trim();
      if (messageContent) {
        currentMessages.push(messageContent);
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
          {currentMessages.map((msg, i) => (
            <p key={i}>{msg}</p>
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
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div>
      <div className="flex justify-between pt-2">
        <span className="text-gray-600">Transcript:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="text-blue-500 hover:text-blue-700 underline"
          >
            {showTranscript ? "Hide Transcript" : "Show Transcript"}
          </button>
          {transcriptUrl && (
            <a
              href={transcriptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 underline"
            >
              View Source
            </a>
          )}
        </div>
      </div>

      {/* Display transcript content if expanded */}
      {showTranscript && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg max-h-96 overflow-auto">
          <div className="space-y-2">{formatTranscript(transcriptContent)}</div>
        </div>
      )}
    </div>
  );
}

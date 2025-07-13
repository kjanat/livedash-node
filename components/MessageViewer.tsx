"use client";

import type { Message } from "../lib/types";

interface MessageViewerProps {
  messages: Message[];
}

/**
 * Component to display parsed messages in a chat-like format
 */
export default function MessageViewer({ messages }: MessageViewerProps) {
  if (!messages || messages.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-bold text-lg mb-3">Conversation</h3>
        <p className="text-gray-500 italic">No parsed messages available</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-bold text-lg mb-3">
        Conversation ({messages.length} messages)
      </h3>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role.toLowerCase() === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role.toLowerCase() === "user"
                  ? "bg-blue-500 text-white"
                  : message.role.toLowerCase() === "assistant"
                    ? "bg-gray-200 text-gray-800"
                    : "bg-yellow-100 text-yellow-800"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium opacity-75 mr-2">
                  {message.role}
                </span>
                <span className="text-xs opacity-75 ml-2">
                  {message.timestamp
                    ? new Date(message.timestamp).toLocaleTimeString()
                    : "No timestamp"}
                </span>
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {message.content}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t text-sm text-gray-500">
        <div className="flex justify-between">
          <span>
            First message:{" "}
            {messages[0].timestamp
              ? new Date(messages[0].timestamp).toLocaleString()
              : "No timestamp"}
          </span>
          {/* prettier-ignore */}
          <span>
            Last message: {(() => {
              const lastMessage = messages[messages.length - 1];
              return lastMessage.timestamp
                ? new Date(lastMessage.timestamp).toLocaleString()
                : "No timestamp";
            })()}
          </span>
        </div>
      </div>
    </div>
  );
}

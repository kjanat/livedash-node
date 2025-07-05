import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseTranscriptContent } from "../../lib/transcriptParser";

describe("Transcript Parser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseTranscriptContent", () => {
    it("should parse basic transcript with timestamps", () => {
      const transcript = `
[10:00:00] User: Hello, I need help with my account
[10:00:15] Assistant: I'd be happy to help you with your account. What specific issue are you experiencing?
[10:00:45] User: I can't log in to my dashboard
[10:01:00] Assistant: Let me help you troubleshoot that login issue.
      `.trim();

      const messages = parseTranscriptContent(transcript);

      expect(messages).toHaveLength(4);

      expect(messages[0]).toEqual({
        timestamp: new Date("1970-01-01T10:00:00.000Z"),
        role: "User",
        content: "Hello, I need help with my account",
        order: 0,
      });

      expect(messages[1]).toEqual({
        timestamp: new Date("1970-01-01T10:00:15.000Z"),
        role: "Assistant",
        content:
          "I'd be happy to help you with your account. What specific issue are you experiencing?",
        order: 1,
      });

      expect(messages[3].order).toBe(3);
    });

    it("should handle transcript without timestamps", () => {
      const transcript = `
User: Hello there
Assistant: Hi! How can I help you today?
User: I need support
Assistant: I'm here to help.
      `.trim();

      const messages = parseTranscriptContent(transcript);

      expect(messages).toHaveLength(4);
      expect(messages[0].timestamp).toBeNull();
      expect(messages[0].role).toBe("User");
      expect(messages[0].content).toBe("Hello there");
      expect(messages[0].order).toBe(0);
    });

    it("should handle mixed timestamp formats", () => {
      const transcript = `
[2024-01-01 10:00:00] User: Hello
10:00:15 Assistant: Hi there
[10:00:30] User: How are you?
Assistant: I'm doing well, thanks!
      `.trim();

      const messages = parseTranscriptContent(transcript);

      expect(messages).toHaveLength(4);
      expect(messages[0].timestamp).toEqual(
        new Date("2024-01-01T10:00:00.000Z")
      );
      expect(messages[1].timestamp).toEqual(
        new Date("1970-01-01T10:00:15.000Z")
      );
      expect(messages[2].timestamp).toEqual(
        new Date("1970-01-01T10:00:30.000Z")
      );
      expect(messages[3].timestamp).toBeNull();
    });

    it("should handle various role formats", () => {
      const transcript = `
Customer: I have a problem
Support Agent: What can I help with?
USER: My account is locked
ASSISTANT: Let me check that for you
System: Connection established
      `.trim();

      const messages = parseTranscriptContent(transcript);

      expect(messages).toHaveLength(5);
      expect(messages[0].role).toBe("User"); // Customer -> User
      expect(messages[1].role).toBe("Assistant"); // Support Agent -> Assistant
      expect(messages[2].role).toBe("User"); // USER -> User
      expect(messages[3].role).toBe("Assistant"); // ASSISTANT -> Assistant
      expect(messages[4].role).toBe("System"); // System -> System
    });

    it("should handle malformed transcript gracefully", () => {
      const transcript = `
This is not a proper transcript format
No colons here
: Empty role
User:
: Empty content
      `.trim();

      const messages = parseTranscriptContent(transcript);

      // Should still try to parse what it can
      expect(messages.length).toBeGreaterThanOrEqual(0);

      // Check that all messages have required fields
      messages.forEach((message, index) => {
        expect(message).toHaveProperty("role");
        expect(message).toHaveProperty("content");
        expect(message).toHaveProperty("order", index);
        expect(message).toHaveProperty("timestamp");
      });
    });

    it("should preserve message order correctly", () => {
      const transcript = `
User: First message
Assistant: Second message  
User: Third message
Assistant: Fourth message
User: Fifth message
      `.trim();

      const messages = parseTranscriptContent(transcript);

      expect(messages).toHaveLength(5);
      messages.forEach((message, index) => {
        expect(message.order).toBe(index);
      });
    });

    it("should handle empty or whitespace-only transcript", () => {
      expect(parseTranscriptContent("")).toEqual([]);
      expect(parseTranscriptContent("   \n\n   ")).toEqual([]);
      expect(parseTranscriptContent("\t\r\n")).toEqual([]);
    });

    it("should handle special characters in content", () => {
      const transcript = `
User: Hello! How are you? 😊
Assistant: I'm great! Thanks for asking. 🤖
User: Can you help with this: https://example.com/issue?id=123&type=urgent
Assistant: Absolutely! I'll check that URL for you.
      `.trim();

      const messages = parseTranscriptContent(transcript);

      expect(messages).toHaveLength(4);
      expect(messages[0].content).toBe("Hello! How are you? 😊");
      expect(messages[2].content).toBe(
        "Can you help with this: https://example.com/issue?id=123&type=urgent"
      );
    });

    it("should normalize role names consistently", () => {
      const transcript = `
customer: Hello
support: Hi there
CUSTOMER: How are you?
SUPPORT: Good thanks
Client: Great
Agent: Wonderful
      `.trim();

      const messages = parseTranscriptContent(transcript);

      expect(messages[0].role).toBe("User");
      expect(messages[1].role).toBe("Assistant");
      expect(messages[2].role).toBe("User");
      expect(messages[3].role).toBe("Assistant");
      expect(messages[4].role).toBe("User");
      expect(messages[5].role).toBe("Assistant");
    });

    it("should handle long content without truncation", () => {
      const longContent = "A".repeat(5000);
      const transcript = `User: ${longContent}`;

      const messages = parseTranscriptContent(transcript);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe(longContent);
      expect(messages[0].content.length).toBe(5000);
    });
  });
});

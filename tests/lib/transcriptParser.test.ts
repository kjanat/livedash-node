import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseTranscriptToMessages } from "../../lib/transcriptParser";

describe("Transcript Parser", () => {
  const startTime = new Date('2024-01-01T10:00:00Z');
  const endTime = new Date('2024-01-01T10:30:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parseTranscriptToMessages", () => {
    it("should parse basic transcript with timestamps", () => {
      const transcript = `
[10.01.2024 10:00:00] User: Hello, I need help with my account
[10.01.2024 10:00:15] Assistant: I'd be happy to help you with your account. What specific issue are you experiencing?
[10.01.2024 10:00:45] User: I can't log in to my account
      `;

      const result = parseTranscriptToMessages(transcript, startTime, endTime);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(3);
      expect(result.messages![0].role).toBe("User");
      expect(result.messages![0].content).toBe("Hello, I need help with my account");
      expect(result.messages![1].role).toBe("Assistant");
      expect(result.messages![2].role).toBe("User");
      expect(result.messages![2].content).toBe("I can't log in to my account");
    });

    it("should parse transcript without timestamps", () => {
      const transcript = `
User: Hello there
Assistant: Hello! How can I help you today?
User: I need support with my order
      `;

      const result = parseTranscriptToMessages(transcript, startTime, endTime);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(3);
      expect(result.messages![0].role).toBe("User");
      expect(result.messages![0].content).toBe("Hello there");
      expect(result.messages![1].role).toBe("Assistant");
      expect(result.messages![1].content).toBe("Hello! How can I help you today?");
      expect(result.messages![2].role).toBe("User");
      expect(result.messages![2].content).toBe("I need support with my order");
    });

    it("should handle multi-line messages", () => {
      const transcript = `
User: I have a complex question
about my billing
Assistant: I understand your concern.
Let me help you with that billing question.
      `;

      const result = parseTranscriptToMessages(transcript, startTime, endTime);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);
      expect(result.messages![0].role).toBe("User");
      expect(result.messages![0].content).toContain("about my billing");
      expect(result.messages![1].role).toBe("Assistant");
      expect(result.messages![1].content).toContain("Let me help you");
    });

    it("should handle mixed timestamp formats", () => {
      const transcript = `
[10.01.2024 10:00:00] User: First message with timestamp
Assistant: Message without timestamp
[10.01.2024 10:01:00] User: Another message with timestamp
      `;

      const result = parseTranscriptToMessages(transcript, startTime, endTime);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(3);
      expect(result.messages![0].role).toBe("User");
      expect(result.messages![1].role).toBe("Assistant");
      expect(result.messages![2].role).toBe("User");
    });

    it("should assign order values correctly", () => {
      const transcript = `
User: First
Assistant: Second
User: Third
      `;

      const result = parseTranscriptToMessages(transcript, startTime, endTime);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(3);
      expect(result.messages![0].order).toBe(0);
      expect(result.messages![1].order).toBe(1);
      expect(result.messages![2].order).toBe(2);
    });

    it("should distribute timestamps evenly when no timestamps are present", () => {
      const transcript = `
User: First
Assistant: Second
User: Third
      `;

      const result = parseTranscriptToMessages(transcript, startTime, endTime);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(3);

      // First message should be at start time
      expect(result.messages![0].timestamp.getTime()).toBe(startTime.getTime());

      // Last message should be at end time
      expect(result.messages![2].timestamp.getTime()).toBe(endTime.getTime());

      // Middle message should be between start and end
      const midTime = result.messages![1].timestamp.getTime();
      expect(midTime).toBeGreaterThan(startTime.getTime());
      expect(midTime).toBeLessThan(endTime.getTime());
    });

    it("should handle empty content", () => {
      expect(parseTranscriptToMessages("", startTime, endTime)).toEqual({
        success: false,
        error: "Empty transcript content"
      });
      expect(parseTranscriptToMessages("   \n\n   ", startTime, endTime)).toEqual({
        success: false,
        error: "Empty transcript content"
      });
      expect(parseTranscriptToMessages("\t\r\n", startTime, endTime)).toEqual({
        success: false,
        error: "Empty transcript content"
      });
    });

    it("should handle content with no valid messages", () => {
      const transcript = `
Just some random text
without any proper format
      `;

      const result = parseTranscriptToMessages(transcript, startTime, endTime);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No messages found in transcript");
    });

    it("should handle case-insensitive roles", () => {
      const transcript = `
user: Lower case user
ASSISTANT: Upper case assistant
System: Mixed case system
      `;

      const result = parseTranscriptToMessages(transcript, startTime, endTime);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(3);
      expect(result.messages![0].role).toBe("User");
      expect(result.messages![1].role).toBe("Assistant");
      expect(result.messages![2].role).toBe("System");
    });

    it("should parse European date format correctly", () => {
      const transcript = `
[10.01.2024 14:30:45] User: Message with European date format
[10.01.2024 14:31:00] Assistant: Response message
      `;

      const result = parseTranscriptToMessages(transcript, startTime, endTime);

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(2);

      // Check that timestamps were parsed correctly
      const firstTimestamp = result.messages![0].timestamp;
      expect(firstTimestamp.getFullYear()).toBe(2024);
      expect(firstTimestamp.getMonth()).toBe(0); // January (0-indexed)
      expect(firstTimestamp.getDate()).toBe(10);
      expect(firstTimestamp.getHours()).toBe(14);
      expect(firstTimestamp.getMinutes()).toBe(30);
      expect(firstTimestamp.getSeconds()).toBe(45);
    });
  });
});
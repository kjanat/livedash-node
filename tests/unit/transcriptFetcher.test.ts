// Unit tests for transcript fetcher
import { describe, it, expect, beforeEach, vi } from "vitest";
import fetch from "node-fetch";
import {
  fetchTranscriptContent,
  isValidTranscriptUrl,
  extractSessionIdFromTranscript,
} from "../../lib/transcriptFetcher";

// Mock node-fetch
const mockFetch = fetch as any;

describe("Transcript Fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchTranscriptContent", () => {
    it("should successfully fetch transcript content", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("Session transcript content"),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await fetchTranscriptContent(
        "https://example.com/transcript"
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe("Session transcript content");
      expect(result.error).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith("https://example.com/transcript", {
        method: "GET",
        headers: {
          "User-Agent": "LiveDash-Transcript-Fetcher/1.0",
        },
        signal: expect.any(AbortSignal),
      });
    });

    it("should handle authentication with username and password", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("Authenticated transcript"),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await fetchTranscriptContent(
        "https://example.com/transcript",
        "user123",
        "pass456"
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe("Authenticated transcript");

      const expectedAuth =
        "Basic " + Buffer.from("user123:pass456").toString("base64");
      expect(mockFetch).toHaveBeenCalledWith("https://example.com/transcript", {
        method: "GET",
        headers: {
          "User-Agent": "LiveDash-Transcript-Fetcher/1.0",
          Authorization: expectedAuth,
        },
        signal: expect.any(AbortSignal),
      });
    });

    it("should handle HTTP errors", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await fetchTranscriptContent(
        "https://example.com/transcript"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("HTTP 404: Not Found");
      expect(result.content).toBeUndefined();
    });

    it("should handle empty transcript content", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("   "),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await fetchTranscriptContent(
        "https://example.com/transcript"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Empty transcript content");
      expect(result.content).toBeUndefined();
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("ENOTFOUND example.com"));

      const result = await fetchTranscriptContent(
        "https://example.com/transcript"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Domain not found");
      expect(result.content).toBeUndefined();
    });

    it("should handle connection refused errors", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await fetchTranscriptContent(
        "https://example.com/transcript"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection refused");
      expect(result.content).toBeUndefined();
    });

    it("should handle timeout errors", async () => {
      mockFetch.mockRejectedValue(new Error("Request timeout"));

      const result = await fetchTranscriptContent(
        "https://example.com/transcript"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
      expect(result.content).toBeUndefined();
    });

    it("should handle empty URL", async () => {
      const result = await fetchTranscriptContent("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No transcript URL provided");
      expect(result.content).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should trim whitespace from content", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("  \n  Session content  \n  "),
      };
      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await fetchTranscriptContent(
        "https://example.com/transcript"
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe("Session content");
    });
  });

  describe("isValidTranscriptUrl", () => {
    it("should validate HTTP URLs", () => {
      expect(isValidTranscriptUrl("http://example.com/transcript")).toBe(true);
    });

    it("should validate HTTPS URLs", () => {
      expect(isValidTranscriptUrl("https://example.com/transcript")).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(isValidTranscriptUrl("not-a-url")).toBe(false);
      expect(isValidTranscriptUrl("ftp://example.com")).toBe(false);
      expect(isValidTranscriptUrl("")).toBe(false);
      expect(isValidTranscriptUrl(null as any)).toBe(false);
      expect(isValidTranscriptUrl(undefined as any)).toBe(false);
    });

    it("should handle malformed URLs", () => {
      expect(isValidTranscriptUrl("http://")).toBe(false);
      expect(isValidTranscriptUrl("https://")).toBe(false);
      expect(isValidTranscriptUrl("://example.com")).toBe(false);
    });
  });

  describe("extractSessionIdFromTranscript", () => {
    it("should extract session ID from session_id pattern", () => {
      const content = "session_id: abc123def456\nOther content...";
      const result = extractSessionIdFromTranscript(content);
      expect(result).toBe("abc123def456");
    });

    it("should extract session ID from sessionId pattern", () => {
      const content = "sessionId: xyz789\nTranscript data...";
      const result = extractSessionIdFromTranscript(content);
      expect(result).toBe("xyz789");
    });

    it("should extract session ID from id pattern", () => {
      const content = "id: session-12345678\nChat log...";
      const result = extractSessionIdFromTranscript(content);
      expect(result).toBe("session-12345678");
    });

    it("should extract session ID from first line", () => {
      const content = "abc123def456\nUser: Hello\nBot: Hi there";
      const result = extractSessionIdFromTranscript(content);
      expect(result).toBe("abc123def456");
    });

    it("should return null for content without session ID", () => {
      const content = "User: Hello\nBot: Hi there\nUser: How are you?";
      const result = extractSessionIdFromTranscript(content);
      expect(result).toBe(null);
    });

    it("should return null for empty content", () => {
      expect(extractSessionIdFromTranscript("")).toBe(null);
      expect(extractSessionIdFromTranscript(null as any)).toBe(null);
      expect(extractSessionIdFromTranscript(undefined as any)).toBe(null);
    });

    it("should handle case-insensitive patterns", () => {
      const content = "SESSION_ID: ABC123\nContent...";
      const result = extractSessionIdFromTranscript(content);
      expect(result).toBe("ABC123");
    });

    it("should extract the first matching pattern", () => {
      const content = "session_id: first123\nid: second456\nMore content...";
      const result = extractSessionIdFromTranscript(content);
      expect(result).toBe("first123");
    });
  });
});

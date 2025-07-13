/**
 * Dashboard Components Unit Tests
 * Tests for TopQuestionsChart and TranscriptViewer components
 * Note: GeographicMap tests excluded due to react-leaflet/dynamic import issues in test environment
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { TopQuestion } from "../../lib/types";

// Mock ReactMarkdown and rehype-raw for TranscriptViewer
vi.mock("react-markdown", () => ({
  default: ({ children, ...props }: any) => (
    <div data-testid="react-markdown" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("rehype-raw", () => ({
  default: vi.fn(),
}));

// Mock shadcn/ui components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, ...props }: any) => (
    <h3 data-testid="card-title" {...props}>
      {children}
    </h3>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: (props: any) => <hr data-testid="separator" {...props} />,
}));

// Import components after mocks
import TopQuestionsChart from "../../components/TopQuestionsChart";
import TranscriptViewer from "../../components/TranscriptViewer";

describe("Dashboard Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TopQuestionsChart", () => {
    const mockQuestions: TopQuestion[] = [
      { question: "How do I reset my password?", count: 25 },
      { question: "What are the working hours?", count: 20 },
      { question: "How do I request vacation?", count: 15 },
      { question: "Where is the employee handbook?", count: 10 },
      { question: "How do I contact HR?", count: 8 },
    ];

    it("should render chart with questions data", () => {
      render(<TopQuestionsChart data={mockQuestions} />);

      expect(screen.getByTestId("card")).toBeInTheDocument();
      expect(screen.getByTestId("card-title")).toHaveTextContent(
        "Top 5 Asked Questions"
      );
      expect(
        screen.getByText("How do I reset my password?")
      ).toBeInTheDocument();
    });

    it("should render with custom title", () => {
      render(<TopQuestionsChart data={mockQuestions} title="Custom Title" />);

      expect(screen.getByTestId("card-title")).toHaveTextContent(
        "Custom Title"
      );
    });

    it("should handle empty questions data", () => {
      render(<TopQuestionsChart data={[]} />);

      expect(screen.getByTestId("card")).toBeInTheDocument();
      expect(screen.getByTestId("card-title")).toHaveTextContent(
        "Top 5 Asked Questions"
      );
      expect(
        screen.getByText("No questions data available")
      ).toBeInTheDocument();
    });

    it("should display question counts as badges", () => {
      render(<TopQuestionsChart data={mockQuestions} />);

      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
    });

    it("should show all questions with progress bars", () => {
      render(<TopQuestionsChart data={mockQuestions} />);

      // All questions should be rendered
      mockQuestions.forEach((question) => {
        expect(screen.getByText(question.question)).toBeInTheDocument();
        expect(screen.getByText(question.count.toString())).toBeInTheDocument();
      });
    });

    it("should calculate and display total questions", () => {
      render(<TopQuestionsChart data={mockQuestions} />);

      const totalQuestions = mockQuestions.reduce((sum, q) => sum + q.count, 0);
      expect(screen.getByText(totalQuestions.toString())).toBeInTheDocument();
      expect(screen.getByText("Total questions analyzed")).toBeInTheDocument();
    });
  });

  describe("TranscriptViewer", () => {
    const mockTranscriptContent = `User: Hello, I need help with my account
Assistant: I'd be happy to help you with your account. What specific issue are you experiencing?
User: I can't log in to my account
Assistant: Let me help you with that. Can you tell me what error message you're seeing?`;

    const mockTranscriptUrl = "https://example.com/transcript/123";

    it("should render transcript content", () => {
      render(
        <TranscriptViewer
          transcriptContent={mockTranscriptContent}
          transcriptUrl={mockTranscriptUrl}
        />
      );

      expect(screen.getByText("Session Transcript")).toBeInTheDocument();
      expect(
        screen.getByText(/Hello, I need help with my account/)
      ).toBeInTheDocument();
    });

    it("should handle empty transcript content", () => {
      render(
        <TranscriptViewer
          transcriptContent=""
          transcriptUrl={mockTranscriptUrl}
        />
      );

      expect(
        screen.getByText("No transcript content available.")
      ).toBeInTheDocument();
    });

    it("should render without transcript URL", () => {
      render(<TranscriptViewer transcriptContent={mockTranscriptContent} />);

      // Should still render content
      expect(screen.getByText("Session Transcript")).toBeInTheDocument();
      expect(
        screen.getByText(/Hello, I need help with my account/)
      ).toBeInTheDocument();
    });

    it("should toggle between formatted and raw view", () => {
      render(
        <TranscriptViewer
          transcriptContent={mockTranscriptContent}
          transcriptUrl={mockTranscriptUrl}
        />
      );

      // Find the raw text toggle button
      const rawToggleButton = screen.getByText("Raw Text");
      expect(rawToggleButton).toBeInTheDocument();

      // Click to show raw view
      fireEvent.click(rawToggleButton);

      // Should now show "Formatted" button and raw content
      expect(screen.getByText("Formatted")).toBeInTheDocument();
    });

    it("should handle malformed transcript content gracefully", () => {
      const malformedContent = "This is not a properly formatted transcript";

      render(
        <TranscriptViewer
          transcriptContent={malformedContent}
          transcriptUrl={mockTranscriptUrl}
        />
      );

      // Should show "No transcript content available" in formatted view for malformed content
      expect(
        screen.getByText("No transcript content available.")
      ).toBeInTheDocument();

      // But should show the raw content when toggled to raw view
      const rawToggleButton = screen.getByText("Raw Text");
      fireEvent.click(rawToggleButton);
      expect(screen.getByText(malformedContent)).toBeInTheDocument();
    });

    it("should parse and display conversation messages", () => {
      render(
        <TranscriptViewer
          transcriptContent={mockTranscriptContent}
          transcriptUrl={mockTranscriptUrl}
        />
      );

      // Check for message content
      expect(
        screen.getByText(/Hello, I need help with my account/)
      ).toBeInTheDocument();
      expect(screen.getByText(/I'd be happy to help you/)).toBeInTheDocument();
    });

    it("should display transcript URL link when provided", () => {
      render(
        <TranscriptViewer
          transcriptContent={mockTranscriptContent}
          transcriptUrl={mockTranscriptUrl}
        />
      );

      const link = screen.getByText("View Full Raw");
      expect(link).toBeInTheDocument();
      expect(link.closest("a")).toHaveAttribute("href", mockTranscriptUrl);
    });
  });
});

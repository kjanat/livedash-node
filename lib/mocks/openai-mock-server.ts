/**
 * OpenAI API Mock Server
 *
 * Provides a drop-in replacement for OpenAI API calls during development
 * and testing to prevent unexpected costs and enable offline development.
 */

import {
  calculateMockCost,
  generateBatchResponse,
  generateSessionAnalysisResponse,
  MOCK_RESPONSE_GENERATORS,
  type MockBatchResponse,
  type MockChatCompletion,
  type MockResponseType,
} from "./openai-responses";

interface MockOpenAIConfig {
  enabled: boolean;
  baseDelay: number; // Base delay in ms to simulate API latency
  randomDelay: number; // Additional random delay (0 to this value)
  errorRate: number; // Probability of simulated errors (0.0 to 1.0)
  logRequests: boolean; // Whether to log mock requests
}

class OpenAIMockServer {
  private config: MockOpenAIConfig;
  private totalCost = 0;
  private requestCount = 0;
  private activeBatches: Map<string, MockBatchResponse> = new Map();

  constructor(config: Partial<MockOpenAIConfig> = {}) {
    this.config = {
      enabled: process.env.OPENAI_MOCK_MODE === "true",
      baseDelay: 500, // 500ms base delay
      randomDelay: 1000, // 0-1000ms additional delay
      errorRate: 0.02, // 2% error rate
      logRequests: process.env.NODE_ENV === "development",
      ...config,
    };
  }

  /**
   * Check if mock mode is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Simulate network delay
   */
  private async simulateDelay(): Promise<void> {
    const delay =
      this.config.baseDelay + Math.random() * this.config.randomDelay;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Simulate random API errors
   */
  private shouldSimulateError(): boolean {
    return Math.random() < this.config.errorRate;
  }

  /**
   * Log mock requests for debugging
   */
  private logRequest(endpoint: string, data: any): void {
    if (this.config.logRequests) {
      console.log(`[OpenAI Mock] ${endpoint}:`, JSON.stringify(data, null, 2));
    }
  }

  /**
   * Check if this is a session analysis request (comprehensive JSON format)
   */
  private isSessionAnalysisRequest(prompt: string): boolean {
    const promptLower = prompt.toLowerCase();
    return (
      promptLower.includes("session_id") &&
      (promptLower.includes("sentiment") ||
        promptLower.includes("category") ||
        promptLower.includes("language"))
    );
  }

  /**
   * Extract processing type from prompt
   */
  private extractProcessingType(prompt: string): MockResponseType {
    const promptLower = prompt.toLowerCase();

    if (
      promptLower.includes("sentiment") ||
      promptLower.includes("positive") ||
      promptLower.includes("negative")
    ) {
      return "sentiment";
    }
    if (promptLower.includes("category") || promptLower.includes("classify")) {
      return "category";
    }
    if (promptLower.includes("summary") || promptLower.includes("summarize")) {
      return "summary";
    }
    if (promptLower.includes("question") || promptLower.includes("extract")) {
      return "questions";
    }

    // Default to sentiment analysis
    return "sentiment";
  }

  /**
   * Mock chat completions endpoint
   */
  async mockChatCompletion(request: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  }): Promise<MockChatCompletion> {
    this.requestCount++;

    await this.simulateDelay();

    if (this.shouldSimulateError()) {
      throw new Error("Mock OpenAI API error: Rate limit exceeded");
    }

    this.logRequest("/v1/chat/completions", request);

    // Extract the user content to analyze
    const userMessage =
      request.messages.find((msg) => msg.role === "user")?.content || "";
    const systemMessage =
      request.messages.find((msg) => msg.role === "system")?.content || "";

    let response: MockChatCompletion;
    let processingType: string;

    // Check if this is a comprehensive session analysis request
    if (this.isSessionAnalysisRequest(systemMessage)) {
      // Extract session ID from system message for session analysis
      const sessionIdMatch = systemMessage.match(/"session_id":\s*"([^"]+)"/);
      const sessionId = sessionIdMatch?.[1] || `mock-session-${Date.now()}`;
      response = generateSessionAnalysisResponse(userMessage, sessionId);
      processingType = "session_analysis";
    } else {
      // Use simple response generators for other types
      const detectedType = this.extractProcessingType(
        `${systemMessage} ${userMessage}`
      );
      response = MOCK_RESPONSE_GENERATORS[detectedType](userMessage);
      processingType = detectedType;
    }

    // Track costs
    const cost = calculateMockCost(response.usage);
    this.totalCost += cost;

    if (this.config.logRequests) {
      console.log(
        `[OpenAI Mock] Generated ${processingType} response. Cost: $${cost.toFixed(6)}, Total: $${this.totalCost.toFixed(6)}`
      );
    }

    return response;
  }

  /**
   * Mock batch creation endpoint
   */
  async mockCreateBatch(request: {
    input_file_id: string;
    endpoint: string;
    completion_window: string;
    metadata?: Record<string, string>;
  }): Promise<MockBatchResponse> {
    await this.simulateDelay();

    if (this.shouldSimulateError()) {
      throw new Error("Mock OpenAI API error: Invalid file format");
    }

    this.logRequest("/v1/batches", request);

    const batch = generateBatchResponse("validating");
    this.activeBatches.set(batch.id, batch);

    // Simulate batch processing progression
    this.simulateBatchProgression(batch.id);

    return batch;
  }

  /**
   * Mock batch retrieval endpoint
   */
  async mockGetBatch(batchId: string): Promise<MockBatchResponse> {
    await this.simulateDelay();

    const batch = this.activeBatches.get(batchId);
    if (!batch) {
      throw new Error(`Mock OpenAI API error: Batch ${batchId} not found`);
    }

    this.logRequest(`/v1/batches/${batchId}`, { batchId });

    return batch;
  }

  /**
   * Mock file upload endpoint
   */
  async mockUploadFile(request: {
    file: string; // File content
    purpose: string;
  }): Promise<{
    id: string;
    object: string;
    purpose: string;
    filename: string;
  }> {
    await this.simulateDelay();

    if (this.shouldSimulateError()) {
      throw new Error("Mock OpenAI API error: File too large");
    }

    const fileId = `file-mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.logRequest("/v1/files", {
      purpose: request.purpose,
      size: request.file.length,
    });

    return {
      id: fileId,
      object: "file",
      purpose: request.purpose,
      filename: "batch_input.jsonl",
    };
  }

  /**
   * Mock file content retrieval
   */
  async mockGetFileContent(fileId: string): Promise<string> {
    await this.simulateDelay();

    // Find the batch that owns this file
    const batch = Array.from(this.activeBatches.values()).find(
      (b) => b.output_file_id === fileId
    );

    if (!batch) {
      throw new Error(`Mock OpenAI API error: File ${fileId} not found`);
    }

    // Generate mock batch results
    const results: any = [];
    for (let i = 0; i < batch.request_counts.total; i++) {
      const response = MOCK_RESPONSE_GENERATORS.sentiment(`Sample text ${i}`);
      results.push({
        id: `batch-req-${i}`,
        custom_id: `req-${i}`,
        response: {
          status_code: 200,
          request_id: `req-${Date.now()}-${i}`,
          body: response,
        },
      });
    }

    return results.map((r) => JSON.stringify(r)).join("\n");
  }

  /**
   * Simulate batch processing progression over time
   */
  private simulateBatchProgression(batchId: string): void {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return;

    // Validating -> In Progress (after 30 seconds)
    setTimeout(() => {
      const currentBatch = this.activeBatches.get(batchId);
      if (currentBatch && currentBatch.status === "validating") {
        currentBatch.status = "in_progress";
        currentBatch.in_progress_at = Math.floor(Date.now() / 1000);
        this.activeBatches.set(batchId, currentBatch);
      }
    }, 30000);

    // In Progress -> Finalizing (after 2 minutes)
    setTimeout(() => {
      const currentBatch = this.activeBatches.get(batchId);
      if (currentBatch && currentBatch.status === "in_progress") {
        currentBatch.status = "finalizing";
        currentBatch.finalizing_at = Math.floor(Date.now() / 1000);
        this.activeBatches.set(batchId, currentBatch);
      }
    }, 120000);

    // Finalizing -> Completed (after 3 minutes)
    setTimeout(() => {
      const currentBatch = this.activeBatches.get(batchId);
      if (currentBatch && currentBatch.status === "finalizing") {
        currentBatch.status = "completed";
        currentBatch.completed_at = Math.floor(Date.now() / 1000);
        currentBatch.output_file_id = `file-mock-output-${batchId}`;
        currentBatch.request_counts.completed =
          currentBatch.request_counts.total;
        this.activeBatches.set(batchId, currentBatch);
      }
    }, 180000);
  }

  /**
   * Get mock statistics
   */
  getStats(): {
    totalCost: number;
    requestCount: number;
    activeBatches: number;
    isEnabled: boolean;
  } {
    return {
      totalCost: this.totalCost,
      requestCount: this.requestCount,
      activeBatches: this.activeBatches.size,
      isEnabled: this.config.enabled,
    };
  }

  /**
   * Reset statistics (useful for tests)
   */
  resetStats(): void {
    this.totalCost = 0;
    this.requestCount = 0;
    this.activeBatches.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MockOpenAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Global instance
export const openAIMock = new OpenAIMockServer();

/**
 * Drop-in replacement for OpenAI client that uses mocks when enabled
 */
export class MockOpenAIClient {
  private realClient: any;

  constructor(realClient: any) {
    this.realClient = realClient;
  }

  get chat() {
    return {
      completions: {
        create: async (params: any) => {
          if (openAIMock.isEnabled()) {
            return openAIMock.mockChatCompletion(params);
          }
          return this.realClient.chat.completions.create(params);
        },
      },
    };
  }

  get batches() {
    return {
      create: async (params: any) => {
        if (openAIMock.isEnabled()) {
          return openAIMock.mockCreateBatch(params);
        }
        return this.realClient.batches.create(params);
      },
      retrieve: async (batchId: string) => {
        if (openAIMock.isEnabled()) {
          return openAIMock.mockGetBatch(batchId);
        }
        return this.realClient.batches.retrieve(batchId);
      },
    };
  }

  get files() {
    return {
      create: async (params: any) => {
        if (openAIMock.isEnabled()) {
          return openAIMock.mockUploadFile(params);
        }
        return this.realClient.files.create(params);
      },
      content: async (fileId: string) => {
        if (openAIMock.isEnabled()) {
          return openAIMock.mockGetFileContent(fileId);
        }
        return this.realClient.files.content(fileId);
      },
    };
  }
}

export default openAIMock;

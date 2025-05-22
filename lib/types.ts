import { Session as NextAuthSession } from "next-auth";

export interface UserSession extends NextAuthSession {
  user: {
    id?: string;
    name?: string;
    email?: string;
    image?: string;
    companyId: string;
    role: string;
  };
}

export interface Company {
  id: string;
  name: string;
  csvUrl: string;
  csvUsername?: string;
  csvPassword?: string;
  sentimentAlert?: number; // Match Prisma schema naming
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  password: string;
  role: string;
  companyId: string;
  resetToken?: string | null;
  resetTokenExpiry?: Date | null;
  company?: Company;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSession {
  id: string;
  sessionId: string;
  companyId: string;
  userId?: string | null;
  category?: string | null;
  language?: string | null;
  country?: string | null;
  ipAddress?: string | null;
  sentiment?: number | null;
  messagesSent?: number;
  startTime: Date;
  endTime?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Extended session properties that might be used in metrics
  avgResponseTime?: number | null;
  escalated?: boolean;
  forwardedHr?: boolean;
  tokens?: number;
  tokensEur?: number;
  initialMsg?: string;
  fullTranscriptUrl?: string | null;
  transcriptContent?: string | null;
}

export interface SessionQuery {
  searchTerm?: string;
  category?: string;
  language?: string;
  startDate?: string;
  endDate?: string;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface SessionApiResponse {
  sessions: ChatSession[];
  totalSessions: number;
}

export interface SessionFilterOptions {
  categories: string[];
  languages: string[];
}

export interface DayMetrics {
  [day: string]: number;
}

export interface CategoryMetrics {
  [category: string]: number;
}

export interface LanguageMetrics {
  [language: string]: number;
}

export interface CountryMetrics {
  [country: string]: number;
}

export interface WordCloudWord {
  text: string;
  value: number;
}

export interface MetricsResult {
  totalSessions: number;
  avgSessionsPerDay: number;
  avgSessionLength: number | null;
  days: DayMetrics;
  languages: LanguageMetrics;
  categories: CategoryMetrics;
  countries: CountryMetrics; // Added for geographic distribution
  belowThresholdCount: number;
  // Additional properties for dashboard
  escalatedCount?: number;
  forwardedCount?: number;
  avgSentiment?: number;
  avgResponseTime?: number;
  totalTokens?: number;
  totalTokensEur?: number;
  sentimentThreshold?: number | null;
  lastUpdated?: number; // Timestamp for when metrics were last updated

  // New metrics for enhanced dashboard
  sentimentPositiveCount?: number;
  sentimentNeutralCount?: number;
  sentimentNegativeCount?: number;
  tokensByDay?: DayMetrics;
  tokensCostByDay?: DayMetrics;
  wordCloudData?: WordCloudWord[]; // Added for transcript-based word cloud

  // Properties for overview page cards and trends
  uniqueUsers?: number;
  sessionTrend?: number; // e.g., percentage change in totalSessions
  usersTrend?: number; // e.g., percentage change in uniqueUsers
  avgSessionTimeTrend?: number; // e.g., percentage change in avgSessionLength
  avgResponseTimeTrend?: number; // e.g., percentage change in avgResponseTime

  // Debug properties
  totalSessionDuration?: number;
  validSessionsForDuration?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

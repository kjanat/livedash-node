import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  AuditOutcome,
  createAuditContext,
  securityAuditLogger,
} from "@/lib/securityAuditLogger";
import {
  type AlertType,
  type SecurityMetrics,
  securityMonitoring,
  type ThreatLevel,
} from "@/lib/securityMonitoring";

interface ThreatAnalysisResults {
  ipThreatAnalysis?: {
    ipAddress: string;
    threatLevel: ThreatLevel;
    isBlacklisted: boolean;
    riskFactors: string[];
    recommendations: string[];
  };
  timeRangeAnalysis?: {
    timeRange: { start: Date; end: Date };
    securityScore: number;
    threatLevel: string;
    topThreats: Array<{ type: AlertType; count: number }>;
    geoDistribution: Record<string, number>;
    riskUsers: Array<{ userId: string; email: string; riskScore: number }>;
  };
  overallThreatLandscape?: {
    currentThreatLevel: string;
    securityScore: number;
    activeAlerts: number;
    criticalEvents: number;
    recommendations: string[];
  };
}

const threatAnalysisSchema = z.object({
  ipAddress: z.string().optional(),
  userId: z.string().uuid().optional(),
  timeRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const analysis = threatAnalysisSchema.parse(body);
    const context = await createAuditContext(request, session);

    const results: ThreatAnalysisResults = {};

    // IP threat analysis
    if (analysis.ipAddress) {
      const ipThreat = await securityMonitoring.calculateIPThreatLevel(
        analysis.ipAddress
      );
      results.ipThreatAnalysis = {
        ipAddress: analysis.ipAddress,
        ...ipThreat,
      };
    }

    // Time-based analysis
    if (analysis.timeRange) {
      const timeRange = {
        start: new Date(analysis.timeRange.start),
        end: new Date(analysis.timeRange.end),
      };

      const metrics = await securityMonitoring.getSecurityMetrics(timeRange);
      results.timeRangeAnalysis = {
        timeRange,
        securityScore: metrics.securityScore,
        threatLevel: metrics.threatLevel,
        topThreats: metrics.topThreats,
        geoDistribution: metrics.geoDistribution,
        riskUsers: metrics.userRiskScores.slice(0, 5),
      };
    }

    // General threat landscape
    const defaultTimeRange = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: new Date(),
    };

    const overallMetrics =
      await securityMonitoring.getSecurityMetrics(defaultTimeRange);
    results.overallThreatLandscape = {
      currentThreatLevel: overallMetrics.threatLevel,
      securityScore: overallMetrics.securityScore,
      activeAlerts: overallMetrics.activeAlerts,
      criticalEvents: overallMetrics.criticalEvents,
      recommendations: generateThreatRecommendations(overallMetrics),
    };

    // Log threat analysis request
    await securityAuditLogger.logPlatformAdmin(
      "threat_analysis_performed",
      AuditOutcome.SUCCESS,
      {
        ...context,
        metadata: {
          analysisType: Object.keys(analysis),
          threatLevel: results.overallThreatLandscape?.currentThreatLevel,
        },
      }
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error("Threat analysis error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function generateThreatRecommendations(metrics: SecurityMetrics): string[] {
  const recommendations: string[] = [];

  if (metrics.securityScore < 70) {
    recommendations.push(
      "Security score is below acceptable threshold - immediate action required"
    );
  }

  if (metrics.activeAlerts > 5) {
    recommendations.push(
      "High number of active alerts - prioritize alert resolution"
    );
  }

  if (metrics.criticalEvents > 0) {
    recommendations.push(
      "Critical security events detected - investigate immediately"
    );
  }

  const highRiskUsers = metrics.userRiskScores.filter(
    (user) => user.riskScore > 50
  );
  if (highRiskUsers.length > 0) {
    recommendations.push(
      `${highRiskUsers.length} users have elevated risk scores - review accounts`
    );
  }

  // Check for geographic anomalies
  const countries = Object.keys(metrics.geoDistribution);
  if (countries.length > 10) {
    recommendations.push(
      "High geographic diversity detected - review for suspicious activity"
    );
  }

  // Check for common attack patterns
  const bruteForceAlerts = metrics.topThreats.filter(
    (threat) => threat.type === "BRUTE_FORCE_ATTACK"
  );
  if (bruteForceAlerts.length > 0) {
    recommendations.push(
      "Brute force attacks detected - strengthen authentication controls"
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Security posture appears stable - continue monitoring"
    );
  }

  return recommendations;
}

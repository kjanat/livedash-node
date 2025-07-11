import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import {
  AuditOutcome,
  createAuditContext,
  securityAuditLogger,
} from "@/lib/securityAuditLogger";
import { securityMonitoring } from "@/lib/securityMonitoring";

const exportQuerySchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  type: z.enum(["alerts", "metrics"]).default("alerts"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || !session.user.isPlatformUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const query = exportQuerySchema.parse(params);

    const context = await createAuditContext(request, session);

    const timeRange = {
      start: new Date(query.startDate),
      end: new Date(query.endDate),
    };

    let data: string;
    let filename: string;
    let contentType: string;

    if (query.type === "alerts") {
      data = securityMonitoring.exportSecurityData(query.format, timeRange);
      filename = `security-alerts-${query.startDate.split("T")[0]}-to-${query.endDate.split("T")[0]}.${query.format}`;
      contentType = query.format === "csv" ? "text/csv" : "application/json";
    } else {
      // Export metrics
      const metrics = await securityMonitoring.getSecurityMetrics(timeRange);
      data = JSON.stringify(metrics, null, 2);
      filename = `security-metrics-${query.startDate.split("T")[0]}-to-${query.endDate.split("T")[0]}.json`;
      contentType = "application/json";
    }

    // Log data export
    await securityAuditLogger.logPlatformAdmin(
      "security_data_export",
      AuditOutcome.SUCCESS,
      context,
      undefined,
      {
        exportType: query.type,
        format: query.format,
        timeRange,
        dataSize: data.length,
      }
    );

    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": data.length.toString(),
    });

    return new NextResponse(data, { headers });
  } catch (error) {
    console.error("Security data export error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

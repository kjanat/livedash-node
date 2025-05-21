// Functions to calculate metrics over sessions
import { ChatSession, DayMetrics, CategoryMetrics, LanguageMetrics, MetricsResult } from './types';

interface CompanyConfig {
    sentimentAlert?: number;
}

export function sessionMetrics(sessions: ChatSession[], companyConfig: CompanyConfig = {}): MetricsResult {
    const total = sessions.length;
    const byDay: DayMetrics = {};
    const byCategory: CategoryMetrics = {};
    const byLanguage: LanguageMetrics = {};
    let escalated = 0, forwarded = 0;
    let totalSentiment = 0, sentimentCount = 0;
    let totalResponse = 0, responseCount = 0;
    let totalTokens = 0, totalTokensEur = 0;

    // Calculate total session duration in minutes
    let totalDuration = 0;
    let durationCount = 0;

    sessions.forEach(s => {
        const day = s.startTime.toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;

        if (s.category) byCategory[s.category] = (byCategory[s.category] || 0) + 1;
        if (s.language) byLanguage[s.language] = (byLanguage[s.language] || 0) + 1;

        if (s.endTime) {
            const duration = (s.endTime.getTime() - s.startTime.getTime()) / (1000 * 60); // minutes
            totalDuration += duration;
            durationCount++;
        }

        if (s.escalated) escalated++;
        if (s.forwardedHr) forwarded++;

        if (s.sentiment != null) {
            totalSentiment += s.sentiment;
            sentimentCount++;
        }

        if (s.avgResponseTime != null) {
            totalResponse += s.avgResponseTime;
            responseCount++;
        }

        totalTokens += s.tokens || 0;
        totalTokensEur += s.tokensEur || 0;
    });

    // Now add sentiment alert logic:
    let belowThreshold = 0;
    const threshold = companyConfig.sentimentAlert ?? null;
    if (threshold != null) {
        for (const s of sessions) {
            if (s.sentiment != null && s.sentiment < threshold) belowThreshold++;
        }
    }

    // Calculate average sessions per day
    const dayCount = Object.keys(byDay).length;
    const avgSessionsPerDay = dayCount > 0 ? total / dayCount : 0;

    // Calculate average session length
    const avgSessionLength = durationCount > 0 ? totalDuration / durationCount : null;

    return {
        totalSessions: total,
        avgSessionsPerDay,
        avgSessionLength,
        days: byDay,
        languages: byLanguage,
        categories: byCategory,
        belowThresholdCount: belowThreshold,
        // Additional metrics not in the interface - using type assertion
        escalatedCount: escalated,
        forwardedCount: forwarded,
        avgSentiment: sentimentCount ? totalSentiment / sentimentCount : null,
        avgResponseTime: responseCount ? totalResponse / responseCount : null,
        totalTokens,
        totalTokensEur,
        sentimentThreshold: threshold,
    } as MetricsResult;
}

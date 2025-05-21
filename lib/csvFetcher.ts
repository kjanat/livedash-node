// Fetches, parses, and returns chat session data for a company from a CSV URL
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";

// This type is used internally for parsing the CSV records
interface CSVRecord {
    session_id: string;
    start_time: string;
    end_time?: string;
    ip_address?: string;
    country?: string;
    language?: string;
    messages_sent?: string;
    sentiment?: string;
    escalated?: string;
    forwarded_hr?: string;
    full_transcript_url?: string;
    avg_response_time?: string;
    tokens?: string;
    tokens_eur?: string;
    category?: string;
    initial_msg?: string;
    [key: string]: string | undefined;
}

interface SessionData {
    id: string;
    sessionId: string;
    startTime: Date;
    endTime: Date | null;
    ipAddress?: string;
    country?: string;
    language?: string | null;
    messagesSent: number;
    sentiment: number | null;
    escalated: boolean;
    forwardedHr: boolean;
    fullTranscriptUrl?: string | null;
    avgResponseTime: number | null;
    tokens: number;
    tokensEur: number;
    category?: string | null;
    initialMsg?: string;
}

export async function fetchAndParseCsv(url: string, username?: string, password?: string): Promise<Partial<SessionData>[]> {
    const authHeader = username && password
        ? "Basic " + Buffer.from(`${username}:${password}`).toString("base64")
        : undefined;

    const res = await fetch(url, {
        headers: authHeader ? { Authorization: authHeader } : {},
    });
    if (!res.ok) throw new Error("Failed to fetch CSV: " + res.statusText);

    const text = await res.text();

    // Parse without expecting headers, using known order
    const records: CSVRecord[] = parse(text, {
        delimiter: ",",
        columns: [
            "session_id",
            "start_time",
            "end_time",
            "ip_address",
            "country",
            "language",
            "messages_sent",
            "sentiment",
            "escalated",
            "forwarded_hr",
            "full_transcript_url",
            "avg_response_time",
            "tokens",
            "tokens_eur",
            "category",
            "initial_msg",
        ],
        from_line: 1,
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true,
    });

    // Coerce types for relevant columns
    return records.map((r) => ({
        id: r.session_id,
        startTime: new Date(r.start_time),
        endTime: r.end_time ? new Date(r.end_time) : null,
        ipAddress: r.ip_address,
        country: r.country,
        language: r.language,
        messagesSent: Number(r.messages_sent) || 0,
        sentiment: r.sentiment ? parseFloat(r.sentiment) : null,
        escalated: r.escalated === "1" || r.escalated === "true",
        forwardedHr: r.forwarded_hr === "1" || r.forwarded_hr === "true",
        fullTranscriptUrl: r.full_transcript_url,
        avgResponseTime: r.avg_response_time ? parseFloat(r.avg_response_time) : null,
        tokens: Number(r.tokens) || 0,
        tokensEur: r.tokens_eur ? parseFloat(r.tokens_eur) : 0,
        category: r.category,
        initialMsg: r.initial_msg,
    }));
}

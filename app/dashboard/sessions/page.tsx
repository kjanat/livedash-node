"use client";

import { useState, useEffect, useCallback } from "react"; // Added useCallback
import { ChatSession } from "../../../lib/types";
import Link from "next/link";

// Placeholder for a SessionListItem component to be created later
// For now, we'll display some basic info directly.
// import SessionListItem from "../../../components/SessionListItem";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Debounce search term to avoid excessive API calls
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay
    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = debouncedSearchTerm
        ? `?searchTerm=${encodeURIComponent(debouncedSearchTerm)}`
        : "";
      const response = await fetch(`/api/dashboard/sessions${query}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm]); // Depend on debouncedSearchTerm

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]); // fetchSessions is now stable due to useCallback and its dependency

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">
        Chat Sessions
      </h1>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search sessions (ID, category, initial message...)"
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading && <p className="text-gray-600">Loading sessions...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && sessions.length === 0 && (
        <p className="text-gray-600">
          {debouncedSearchTerm
            ? `No sessions found for "${debouncedSearchTerm}".`
            : "No sessions found."}
        </p>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <h2 className="text-lg font-semibold text-sky-700 mb-1">
                Session ID: {session.sessionId || session.id}
              </h2>
              <p className="text-sm text-gray-500 mb-1">
                Start Time: {new Date(session.startTime).toLocaleString()}
              </p>
              {session.category && (
                <p className="text-sm text-gray-700">
                  Category:{" "}
                  <span className="font-medium">{session.category}</span>
                </p>
              )}
              {session.language && (
                <p className="text-sm text-gray-700">
                  Language:{" "}
                  <span className="font-medium">
                    {session.language.toUpperCase()}
                  </span>
                </p>
              )}
              {session.initialMsg && (
                <p className="text-sm text-gray-600 mt-1 truncate">
                  Initial Message: {session.initialMsg}
                </p>
              )}
              <Link
                href={`/dashboard/sessions/${session.id}`}
                className="mt-2 text-sm text-sky-600 hover:text-sky-800 hover:underline inline-block"
              >
                View Details
              </Link>
            </div>
          ))}
        </div>
      )}
      {/* TODO: Add pagination controls */}
    </div>
  );
}

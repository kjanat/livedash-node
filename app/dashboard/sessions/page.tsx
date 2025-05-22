"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatSession } from "../../../lib/types";
import Link from "next/link";

// Placeholder for a SessionListItem component to be created later
// For now, we'll display some basic info directly.
// import SessionListItem from "../../../components/SessionListItem";

// TODO: Consider moving filter/sort types to lib/types.ts if they become complex
interface FilterOptions {
  categories: string[];
  languages: string[];
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter states
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    categories: [],
    languages: [],
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Sort states
  const [sortKey, setSortKey] = useState<string>("startTime"); // Default sort key
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc"); // Default sort order

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

  const fetchFilterOptions = useCallback(async () => {
    // TODO: Implement API endpoint to fetch distinct categories and languages
    // For now, using placeholder data or deriving from fetched sessions if possible
    // This should ideally be a separate API call: GET /api/dashboard/session-filter-options
    try {
      // Simulating fetching filter options. Replace with actual API call.
      // const response = await fetch('/api/dashboard/session-filter-options');
      // if (!response.ok) {
      //   throw new Error('Failed to fetch filter options');
      // }
      // const data = await response.json();
      // setFilterOptions(data);

      // Placeholder - In a real scenario, fetch these from the backend
      // For now, we can extract from all sessions once fetched, but this is not ideal for initial load.
      // This will be improved when the backend endpoint is ready.
      if (sessions.length > 0) {
        const categories = Array.from(
          new Set(sessions.map((s) => s.category).filter(Boolean))
        ) as string[];
        const languages = Array.from(
          new Set(sessions.map((s) => s.language).filter(Boolean))
        ) as string[];
        setFilterOptions({ categories, languages });
      }
    } catch {
      // setError("Failed to load filter options"); // Optionally set an error state
    }
  }, [sessions]); // Re-fetch if sessions change, for placeholder logic.

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.append("searchTerm", debouncedSearchTerm);
      if (selectedCategory) params.append("category", selectedCategory);
      if (selectedLanguage) params.append("language", selectedLanguage);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (sortKey) params.append("sortKey", sortKey);
      if (sortOrder) params.append("sortOrder", sortOrder);

      const response = await fetch(
        `/api/dashboard/sessions?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      const data = await response.json();
      setSessions(data.sessions || []);
      // After fetching sessions, update filter options (temporary solution)
      if (data.sessions && data.sessions.length > 0) {
        const categories = Array.from(
          new Set(
            data.sessions.map((s: ChatSession) => s.category).filter(Boolean)
          )
        ) as string[];
        const languages = Array.from(
          new Set(
            data.sessions.map((s: ChatSession) => s.language).filter(Boolean)
          )
        ) as string[];
        setFilterOptions({ categories, languages });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearchTerm,
    selectedCategory,
    selectedLanguage,
    startDate,
    endDate,
    sortKey,
    sortOrder,
  ]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Fetch initial filter options (or update if sessions change - placeholder)
  useEffect(() => {
    // This is a placeholder. Ideally, filter options are fetched once,
    // or if they are dynamic and dependent on other filters, fetched accordingly.
    // For now, this re-runs if sessions data changes, which is not optimal.
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">
        Chat Sessions
      </h1>

      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search sessions (ID, category, initial message...)"
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Filter and Sort Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg shadow">
        {/* Category Filter */}
        <div>
          <label
            htmlFor="category-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Category
          </label>
          <select
            id="category-filter"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {filterOptions.categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Language Filter */}
        <div>
          <label
            htmlFor="language-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Language
          </label>
          <select
            id="language-filter"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
          >
            <option value="">All Languages</option>
            {filterOptions.languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date Filter */}
        <div>
          <label
            htmlFor="start-date-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Start Date
          </label>
          <input
            type="date"
            id="start-date-filter"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* End Date Filter */}
        <div>
          <label
            htmlFor="end-date-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            End Date
          </label>
          <input
            type="date"
            id="end-date-filter"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Sort Key */}
        <div>
          <label
            htmlFor="sort-key"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Sort By
          </label>
          <select
            id="sort-key"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            <option value="startTime">Start Time</option>
            <option value="category">Category</option>
            <option value="language">Language</option>
            <option value="sentiment">Sentiment</option>
            <option value="messagesSent">Messages Sent</option>
            <option value="avgResponseTime">Avg. Response Time</option>
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <label
            htmlFor="sort-order"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Order
          </label>
          <select
            id="sort-order"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
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
      {/* TODO: Add pagination controls (e.g., using a library or custom component) */}
      {/* TODO: Implement advanced filtering (by date range, category, language, etc.) - Partially done, needs backend support for filter options and robust date filtering */}
      {/* TODO: Implement sorting options for the session list (e.g., by start time, sentiment) - Partially done, needs backend support */}
    </div>
  );
}

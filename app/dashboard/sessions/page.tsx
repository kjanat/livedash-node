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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  const [pageSize, setPageSize] = useState(10); // Or make this configurable

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms delay
    return () => {
      clearTimeout(timerId);
    };
  }, [searchTerm]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard/session-filter-options");
      if (!response.ok) {
        throw new Error("Failed to fetch filter options");
      }
      const data = await response.json();
      setFilterOptions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load filter options"
      );
    }
  }, []);

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
      params.append("page", currentPage.toString());
      params.append("pageSize", pageSize.toString());

      const response = await fetch(
        `/api/dashboard/sessions?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }
      const data = await response.json();
      setSessions(data.sessions || []);
      setTotalPages(Math.ceil((data.totalSessions || 0) / pageSize));
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
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
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
                Start Time{/*  (Local) */}:{" "}
                {new Date(session.startTime).toLocaleString()}
              </p>
              {/* <p className="text-xs text-gray-400 mb-1">
                Start Time (Raw API): {session.startTime.toString()}
              </p> */}
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

      {totalPages > 0 && (
        <div className="mt-6 flex justify-center items-center space-x-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

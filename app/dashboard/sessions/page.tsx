"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatSession } from "../../../lib/types";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Search, 
  Filter, 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Globe,
  Eye,
  ChevronDown,
  ChevronUp
} from "lucide-react";

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

  // UI states
  const [filtersExpanded, setFiltersExpanded] = useState(false);

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
    <div className="space-y-6">
      {/* Page heading for screen readers */}
      <h1 className="sr-only">Sessions Management</h1>
      
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6" />
            <CardTitle as="h2">Chat Sessions</CardTitle>
          </div>
        </CardHeader>
      </Card>

      {/* Search Input */}
      <section aria-labelledby="search-heading">
        <h2 id="search-heading" className="sr-only">Search Sessions</h2>
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search sessions (ID, category, initial message...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                aria-label="Search sessions by ID, category, or message content"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Filter and Sort Controls */}
      <section aria-labelledby="filters-heading">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" aria-hidden="true" />
                <CardTitle as="h2" id="filters-heading" className="text-lg">Filters & Sorting</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="gap-2"
                aria-expanded={filtersExpanded}
                aria-controls="filter-content"
              >
              {filtersExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        {filtersExpanded && (
          <CardContent id="filter-content">
            <fieldset>
              <legend className="sr-only">Session Filters and Sorting Options</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Category Filter */}
                <div className="space-y-2">
                  <Label htmlFor="category-filter">Category</Label>
                  <select
                    id="category-filter"
                    className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    aria-describedby="category-help"
                  >
                    <option value="">All Categories</option>
                    {filterOptions.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <div id="category-help" className="sr-only">
                    Filter sessions by category type
                  </div>
                </div>

                {/* Language Filter */}
                <div className="space-y-2">
                  <Label htmlFor="language-filter">Language</Label>
                  <select
                    id="language-filter"
                    className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    aria-describedby="language-help"
                  >
                    <option value="">All Languages</option>
                    {filterOptions.languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <div id="language-help" className="sr-only">
                    Filter sessions by language
                  </div>
                </div>

                {/* Start Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="start-date-filter">Start Date</Label>
                  <Input
                    type="date"
                    id="start-date-filter"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    aria-describedby="start-date-help"
                  />
                  <div id="start-date-help" className="sr-only">
                    Filter sessions from this date onwards
                  </div>
                </div>

                {/* End Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="end-date-filter">End Date</Label>
                  <Input
                    type="date"
                    id="end-date-filter"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    aria-describedby="end-date-help"
                  />
                  <div id="end-date-help" className="sr-only">
                    Filter sessions up to this date
                  </div>
                </div>

                {/* Sort Key */}
                <div className="space-y-2">
                  <Label htmlFor="sort-key">Sort By</Label>
                  <select
                    id="sort-key"
                    className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value)}
                    aria-describedby="sort-key-help"
                  >
                    <option value="startTime">Start Time</option>
                    <option value="category">Category</option>
                    <option value="language">Language</option>
                    <option value="sentiment">Sentiment</option>
                    <option value="messagesSent">Messages Sent</option>
                    <option value="avgResponseTime">Avg. Response Time</option>
                  </select>
                  <div id="sort-key-help" className="sr-only">
                    Choose field to sort sessions by
                  </div>
                </div>

                {/* Sort Order */}
                <div className="space-y-2">
                  <Label htmlFor="sort-order">Order</Label>
                  <select
                    id="sort-order"
                    className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                    aria-describedby="sort-order-help"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                  <div id="sort-order-help" className="sr-only">
                    Choose ascending or descending order
                  </div>
                </div>
              </div>
            </fieldset>
          </CardContent>
        )}
        </Card>
      </section>

      {/* Results section */}
      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="sr-only">Session Results</h2>
        
        {/* Live region for screen reader announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {loading && "Loading sessions..."}
        {error && `Error loading sessions: ${error}`}
        {!loading && !error && sessions.length > 0 && `Found ${sessions.length} sessions`}
        {!loading && !error && sessions.length === 0 && "No sessions found"}
      </div>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground" aria-hidden="true">
              Loading sessions...
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-destructive" role="alert" aria-hidden="true">
              Error: {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && sessions.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              {debouncedSearchTerm
                ? `No sessions found for "${debouncedSearchTerm}".`
                : "No sessions found."}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sessions List */}
      {!loading && !error && sessions.length > 0 && (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        ID
                      </Badge>
                      <code className="text-sm text-muted-foreground font-mono truncate max-w-24">
                        {session.sessionId || session.id}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(session.startTime).toLocaleDateString()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(session.startTime).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <Link href={`/dashboard/sessions/${session.id}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Eye className="h-4 w-4" />
                      <span className="hidden sm:inline">View Details</span>
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {session.category && session.category !== 'UNRECOGNIZED_OTHER' && session.category !== 'ACCESS_LOGIN' && (
                    <Badge variant="secondary" className="gap-1">
                      <Filter className="h-3 w-3" />
                      {session.category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  )}
                  {session.language && (
                    <Badge variant="outline" className="gap-1">
                      <Globe className="h-3 w-3" />
                      {session.language.toUpperCase()}
                    </Badge>
                  )}
                </div>

                {session.summary ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {session.summary}
                  </p>
                ) : session.initialMsg ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {session.initialMsg}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-center items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      </section>
    </div>
  );
}

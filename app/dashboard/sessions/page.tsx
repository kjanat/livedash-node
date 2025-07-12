"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Eye,
  Filter,
  Globe,
  MessageSquare,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCategory } from "@/lib/format-enums";
import { trpc } from "@/lib/trpc-client";
import type { sessionFilterSchema } from "@/lib/validation";
import type { ChatSession } from "../../../lib/types";

interface FilterOptions {
  categories: string[];
  languages: string[];
}

interface FilterSectionProps {
  filtersExpanded: boolean;
  setFiltersExpanded: (_expanded: boolean) => void;
  searchTerm: string;
  setSearchTerm: (_term: string) => void;
  selectedCategory: string;
  setSelectedCategory: (_category: string) => void;
  selectedLanguage: string;
  setSelectedLanguage: (_language: string) => void;
  startDate: string;
  setStartDate: (_date: string) => void;
  endDate: string;
  setEndDate: (_date: string) => void;
  sortKey: string;
  setSortKey: (_key: string) => void;
  sortOrder: string;
  setSortOrder: (_order: string) => void;
  filterOptions: FilterOptions;
  searchHeadingId: string;
  searchId: string;
  filtersHeadingId: string;
  filterContentId: string;
  categoryFilterId: string;
  categoryHelpId: string;
  languageFilterId: string;
  languageHelpId: string;
  startDateId: string;
  endDateId: string;
  sortById: string;
  sortOrderId: string;
  sortOrderHelpId: string;
}

function FilterSection({
  filtersExpanded,
  setFiltersExpanded,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  selectedLanguage,
  setSelectedLanguage,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  sortKey,
  setSortKey,
  sortOrder,
  setSortOrder,
  filterOptions,
  searchHeadingId,
  searchId,
  filtersHeadingId,
  filterContentId,
  categoryFilterId,
  categoryHelpId,
  languageFilterId,
  languageHelpId,
  startDateId,
  endDateId,
  sortById,
  sortOrderId,
  sortOrderHelpId,
}: FilterSectionProps) {
  return (
    <section aria-labelledby={searchHeadingId}>
      <h2 id={searchHeadingId} className="sr-only">
        Search and Filter Sessions
      </h2>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="relative">
              <Label htmlFor={searchId} className="sr-only">
                Search sessions
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id={searchId}
                  type="text"
                  placeholder="Search sessions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="w-full justify-between"
              aria-expanded={filtersExpanded}
              aria-controls={filterContentId}
              aria-describedby={filtersHeadingId}
            >
              <span id={filtersHeadingId}>Advanced Filters</span>
              {filtersExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>

        {filtersExpanded && (
          <CardContent id={filterContentId}>
            <fieldset>
              <legend className="sr-only">Filter and sort options</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={categoryFilterId}>Category</Label>
                  <select
                    id={categoryFilterId}
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                    aria-describedby={categoryHelpId}
                  >
                    <option value="">All Categories</option>
                    {filterOptions.categories.map((category) => (
                      <option key={category} value={category}>
                        {formatCategory(category)}
                      </option>
                    ))}
                  </select>
                  <div id={categoryHelpId} className="sr-only">
                    Filter sessions by category
                  </div>
                </div>

                <div>
                  <Label htmlFor={languageFilterId}>Language</Label>
                  <select
                    id={languageFilterId}
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                    aria-describedby={languageHelpId}
                  >
                    <option value="">All Languages</option>
                    {filterOptions.languages.map((language) => (
                      <option key={language} value={language}>
                        {language.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <div id={languageHelpId} className="sr-only">
                    Filter sessions by language
                  </div>
                </div>

                <div>
                  <Label htmlFor={startDateId}>Start Date</Label>
                  <Input
                    id={startDateId}
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor={endDateId}>End Date</Label>
                  <Input
                    id={endDateId}
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor={sortById}>Sort By</Label>
                  <select
                    id={sortById}
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value)}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                  >
                    <option value="startTime">Start Time</option>
                    <option value="sessionId">Session ID</option>
                    <option value="category">Category</option>
                    <option value="language">Language</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor={sortOrderId}>Sort Order</Label>
                  <select
                    id={sortOrderId}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                    aria-describedby={sortOrderHelpId}
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>
                  <div id={sortOrderHelpId} className="sr-only">
                    Choose ascending or descending order
                  </div>
                </div>
              </div>
            </fieldset>
          </CardContent>
        )}
      </Card>
    </section>
  );
}

interface SessionListProps {
  sessions: ChatSession[];
  loading: boolean;
  error: string | null;
  resultsHeadingId: string;
}

function SessionList({
  sessions,
  loading,
  error,
  resultsHeadingId,
}: SessionListProps) {
  return (
    <section aria-labelledby={resultsHeadingId}>
      <h2 id={resultsHeadingId} className="sr-only">
        Session Results
      </h2>

      <output aria-live="polite" className="sr-only">
        {loading && "Loading sessions..."}
        {error && `Error loading sessions: ${error}`}
        {!loading &&
          !error &&
          sessions.length > 0 &&
          `Found ${sessions.length} sessions`}
        {!loading && !error && sessions.length === 0 && "No sessions found"}
      </output>

      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div
              className="text-center py-8 text-muted-foreground"
              aria-hidden="true"
            >
              Loading sessions...
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div
              className="text-center py-8 text-destructive"
              role="alert"
              aria-hidden="true"
            >
              Error loading sessions: {error}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && sessions.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No sessions found. Try adjusting your search criteria.
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && sessions.length > 0 && (
        <ul className="space-y-4">
          {sessions.map((session) => (
            <li key={session.id}>
              <Card>
                <CardContent className="pt-6">
                  <article>
                    <header className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium text-base mb-1">
                          Session{" "}
                          {session.sessionId ||
                            `${session.id.substring(0, 8)}...`}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            <Clock
                              className="h-3 w-3 mr-1"
                              aria-hidden="true"
                            />
                            {new Date(session.startTime).toLocaleDateString()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(session.startTime).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <Link href={`/dashboard/sessions/${session.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          aria-label={`View details for session ${session.sessionId || session.id}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          <span className="hidden sm:inline">View Details</span>
                        </Button>
                      </Link>
                    </header>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {session.category && (
                        <Badge variant="secondary" className="gap-1">
                          <Filter className="h-3 w-3" aria-hidden="true" />
                          {formatCategory(session.category)}
                        </Badge>
                      )}
                      {session.language && (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" aria-hidden="true" />
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
                  </article>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (_page: number | ((_prev: number) => number)) => void;
}

function Pagination({
  currentPage,
  totalPages,
  setCurrentPage,
}: PaginationProps) {
  if (totalPages === 0) return null;

  return (
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
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const searchHeadingId = useId();
  const searchId = useId();
  const filtersHeadingId = useId();
  const filterContentId = useId();
  const categoryFilterId = useId();
  const categoryHelpId = useId();
  const languageFilterId = useId();
  const languageHelpId = useId();
  const startDateId = useId();
  const endDateId = useId();
  const sortById = useId();
  const sortOrderId = useId();
  const sortOrderHelpId = useId();
  const resultsHeadingId = useId();

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortKey, setSortKey] = useState("startTime");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize] = useState(10);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    categories: [],
    languages: [],
  });

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timerId);
  }, [searchTerm]);

  // TODO: Implement getSessionFilterOptions in tRPC dashboard router
  // For now, we'll set default filter options
  useEffect(() => {
    setFilterOptions({
      categories: [
        "SCHEDULE_HOURS",
        "LEAVE_VACATION",
        "SICK_LEAVE_RECOVERY",
        "SALARY_COMPENSATION",
      ],
      languages: ["en", "nl", "de", "fr", "es"],
    });
  }, []);

  // tRPC query for sessions
  const {
    data: sessionsData,
    isLoading,
    error: sessionsError,
  } = trpc.dashboard.getSessions.useQuery(
    {
      search: debouncedSearchTerm || undefined,
      category: selectedCategory
        ? (selectedCategory as z.infer<typeof sessionFilterSchema>["category"])
        : undefined,
      // language: selectedLanguage || undefined, // Not supported in schema yet
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      // sortKey: sortKey || undefined, // Not supported in schema yet
      // sortOrder: sortOrder || undefined, // Not supported in schema yet
      page: currentPage,
      limit: pageSize,
    },
    {
      // Enable the query by default
      enabled: true,
    }
  );

  // Update state when data changes
  useEffect(() => {
    if (sessionsData) {
      setSessions(sessionsData.sessions || []);
      setTotalPages(sessionsData.pagination.totalPages);
      setError(null);
    }
  }, [sessionsData]);

  useEffect(() => {
    if (sessionsError) {
      setError(sessionsError.message || "An unknown error occurred");
      setSessions([]);
    }
  }, [sessionsError]);

  // tRPC queries handle data fetching automatically

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Sessions Management</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6" />
            <CardTitle>Chat Sessions</CardTitle>
          </div>
        </CardHeader>
      </Card>

      <FilterSection
        filtersExpanded={filtersExpanded}
        setFiltersExpanded={setFiltersExpanded}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        sortKey={sortKey}
        setSortKey={setSortKey}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        filterOptions={filterOptions}
        searchHeadingId={searchHeadingId}
        searchId={searchId}
        filtersHeadingId={filtersHeadingId}
        filterContentId={filterContentId}
        categoryFilterId={categoryFilterId}
        categoryHelpId={categoryHelpId}
        languageFilterId={languageFilterId}
        languageHelpId={languageHelpId}
        startDateId={startDateId}
        endDateId={endDateId}
        sortById={sortById}
        sortOrderId={sortOrderId}
        sortOrderHelpId={sortOrderHelpId}
      />

      <SessionList
        sessions={sessions}
        loading={isLoading}
        error={error}
        resultsHeadingId={resultsHeadingId}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
      />
    </div>
  );
}

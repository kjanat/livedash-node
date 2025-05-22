"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation"; // Import useRouter
import { useSession } from "next-auth/react"; // Import useSession
import SessionDetails from "../../../../components/SessionDetails";
import TranscriptViewer from "../../../../components/TranscriptViewer";
import { ChatSession } from "../../../../lib/types";
import Link from "next/link";

export default function SessionViewPage() {
  const params = useParams();
  const router = useRouter(); // Initialize useRouter
  const { status } = useSession(); // Get session status, removed unused sessionData
  const id = params?.id as string;
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true); // This will now primarily be for data fetching
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated" && id) {
      const fetchSession = async () => {
        setLoading(true); // Always set loading before fetch
        setError(null);
        try {
          const response = await fetch(`/api/dashboard/session/${id}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error ||
                `Failed to fetch session: ${response.statusText}`
            );
          }
          const data = await response.json();
          setSession(data.session);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "An unknown error occurred"
          );
          setSession(null);
        } finally {
          setLoading(false);
        }
      };
      fetchSession();
    } else if (status === "authenticated" && !id) {
      setError("Session ID is missing.");
      setLoading(false);
    }
  }, [id, status, router]); // session removed from dependencies

  if (status === "loading") {
    return (
      <div className="p-4 md:p-6 flex justify-center items-center min-h-screen">
        <p className="text-gray-600 text-lg">Loading session...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-4 md:p-6 flex justify-center items-center min-h-screen">
        <p className="text-gray-600 text-lg">Redirecting to login...</p>
      </div>
    );
  }

  if (loading && status === "authenticated") {
    return (
      <div className="p-4 md:p-6 flex justify-center items-center min-h-screen">
        <p className="text-gray-600 text-lg">Loading session details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 min-h-screen">
        <p className="text-red-500 text-lg mb-4">Error: {error}</p>
        <Link
          href="/dashboard/sessions"
          className="text-sky-600 hover:underline"
        >
          Back to Sessions List
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-4 md:p-6 min-h-screen">
        <p className="text-gray-600 text-lg mb-4">Session not found.</p>
        <Link
          href="/dashboard/sessions"
          className="text-sky-600 hover:underline"
        >
          Back to Sessions List
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/sessions"
            className="text-sky-700 hover:text-sky-900 hover:underline flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Back to Sessions List
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Session: {session.sessionId || session.id}
        </h1>
        <div className="grid grid-cols-1 gap-6">
          <div>
            <SessionDetails session={session} />
          </div>
          {session.transcriptContent &&
          session.transcriptContent.trim() !== "" ? (
            <div className="mt-0">
              <TranscriptViewer
                transcriptContent={session.transcriptContent}
                transcriptUrl={session.fullTranscriptUrl}
              />
            </div>
          ) : (
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3">Transcript</h3>
              <p className="text-gray-600">
                No transcript content available for this session.
              </p>
              {session.fullTranscriptUrl && (
                <a
                  href={session.fullTranscriptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:underline mt-2 inline-block"
                >
                  View Source Transcript URL
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

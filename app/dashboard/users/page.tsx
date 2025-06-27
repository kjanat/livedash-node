"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface UserItem {
  id: string;
  email: string;
  role: string;
}

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("user");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      fetchUsers();
    }
  }, [status]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/users");
      const data = await res.json();
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      setMessage("Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  async function inviteUser() {
    setMessage("");
    try {
      const res = await fetch("/api/dashboard/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      if (res.ok) {
        setMessage("User invited successfully!");
        setEmail(""); // Clear the form
        // Refresh the user list
        fetchUsers();
      } else {
        const error = await res.json();
        setMessage(
          `Failed to invite user: ${error.message || "Unknown error"}`
        );
      }
    } catch (error) {
      setMessage("Failed to invite user. Please try again.");
      console.error("Error inviting user:", error);
    }
  }

  // Loading state
  if (loading) {
    return <div className="text-center py-10">Loading users...</div>;
  }

  // Check for admin access
  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="text-center py-10 bg-white rounded-xl shadow p-6">
        <h2 className="font-bold text-xl text-red-600 mb-2">Access Denied</h2>
        <p>You don&apos;t have permission to view user management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          User Management
        </h1>

        {message && (
          <div
            className={`p-4 rounded mb-6 ${message.includes("Failed") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
          >
            {message}
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Invite New User</h2>
          <form
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              inviteUser();
            }}
            autoComplete="off" // Disable autofill for the form
          >
            <div className="grid gap-2">
              <label className="font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off" // Disable autofill for this input
              />
            </div>

            <div className="grid gap-2">
              <label className="font-medium text-gray-700">Role</label>
              <select
                className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="user">User</option>
                <option value="ADMIN">Admin</option>
                <option value="AUDITOR">Auditor</option>
              </select>
            </div>

            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-700 text-white py-2 px-4 rounded-lg shadow transition-colors"
            >
              Invite User
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Current Users</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Role
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === "ADMIN"
                              ? "bg-purple-100 text-purple-800"
                              : user.role === "AUDITOR"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {/* For future: Add actions like edit, delete, etc. */}
                        <span className="text-gray-400">
                          No actions available
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

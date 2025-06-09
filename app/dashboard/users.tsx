"use client";
import { useState, useEffect } from "react";
import { UserSession } from "../../lib/types";

interface UserItem {
  id: string;
  email: string;
  role: string;
}

interface UserManagementProps {
  session: UserSession;
}

interface UsersApiResponse {
  users: UserItem[];
}

export default function UserManagement({ session }: UserManagementProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("user");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    fetch("/api/dashboard/users")
      .then((r) => r.json())
      .then((data) => setUsers((data as UsersApiResponse).users));
  }, []);

  async function inviteUser() {
    const res = await fetch("/api/dashboard/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (res.ok) setMsg("User invited.");
    else setMsg("Failed.");
  }

  if (session.user.role !== "admin") return null;

  return (
    <div className="bg-white p-6 rounded-xl shadow mb-6">
      <h2 className="font-bold text-lg mb-4">User Management</h2>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          className="border px-3 py-2 rounded w-full sm:w-auto"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="border px-3 py-2 rounded w-full sm:w-auto"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="auditor">Auditor</option>
        </select>
        <button
          className="bg-blue-600 text-white rounded px-4 py-2 sm:py-0 w-full sm:w-auto"
          onClick={inviteUser}
        >
          Invite
        </button>
      </div>
      <div>{msg}</div>
      <ul className="mt-4">
        {users.map((u) => (
          <li key={u.id} className="flex justify-between border-b py-1">
            {u.email}{" "}
            <span className="text-xs bg-gray-200 px-2 rounded">{u.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { AlertCircle, Eye, Shield, UserPlus, Users } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserItem {
  id: string;
  email: string;
  role: string;
}

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("USER");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const emailId = useId();

  const fetchUsers = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.role === "ADMIN") {
        fetchUsers();
      } else {
        setLoading(false); // Stop loading for non-admin users
      }
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status, session?.user?.role, fetchUsers]);

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
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              Loading users...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check for admin access
  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="font-bold text-xl text-destructive mb-2">
                Access Denied
              </h2>
              <p className="text-muted-foreground">
                You don&apos;t have permission to view user management.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="user-management-page">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            User Management
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Message Alert */}
      {message && (
        <Alert variant={message.includes("Failed") ? "destructive" : "default"}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Invite New User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              inviteUser();
            }}
            autoComplete="off"
            data-testid="invite-form"
          >
            <div className="space-y-2">
              <Label htmlFor={emailId}>Email</Label>
              <Input
                id={emailId}
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="AUDITOR">Auditor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite User
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Current Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Current Users ({users?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "ADMIN"
                              ? "default"
                              : user.role === "AUDITOR"
                                ? "secondary"
                                : "outline"
                          }
                          className="gap-1"
                          data-testid="role-badge"
                        >
                          {user.role === "ADMIN" && (
                            <Shield className="h-3 w-3" />
                          )}
                          {user.role === "AUDITOR" && (
                            <Eye className="h-3 w-3" />
                          )}
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-muted-foreground text-sm">
                          No actions available
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

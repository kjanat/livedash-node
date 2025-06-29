"use client";

import {
  Activity,
  ArrowLeft,
  Calendar,
  Database,
  Mail,
  Save,
  UserPlus,
  Users,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  invitedBy: string | null;
  invitedAt: string | null;
}

interface Company {
  id: string;
  name: string;
  email: string;
  status: string;
  maxUsers: number;
  createdAt: string;
  updatedAt: string;
  users: User[];
  _count: {
    sessions: number;
    imports: number;
  };
}

export default function CompanyManagement() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const companyNameFieldId = useId();
  const companyEmailFieldId = useId();
  const maxUsersFieldId = useId();
  const inviteNameFieldId = useId();
  const inviteEmailFieldId = useId();

  const fetchCompany = useCallback(async () => {
    try {
      const response = await fetch(`/api/platform/companies/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setCompany(data);
        const companyData = {
          name: data.name,
          email: data.email,
          status: data.status,
          maxUsers: data.maxUsers,
        };
        setEditData(companyData);
        setOriginalData(companyData);
      } else {
        toast({
          title: "Error",
          description: "Failed to load company data",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to fetch company:", error);
      toast({
        title: "Error",
        description: "Failed to load company data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [params.id, toast]);

  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Company>>({});
  const [originalData, setOriginalData] = useState<Partial<Company>>({});
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [inviteData, setInviteData] = useState({
    name: "",
    email: "",
    role: "USER",
  });
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  );

  // Function to check if data has been modified
  const hasUnsavedChanges = useCallback(() => {
    // Normalize data for comparison (handle null/undefined/empty string equivalence)
    const normalizeValue = (value: string | number | null | undefined) => {
      if (value === null || value === undefined || value === "") {
        return "";
      }
      return value;
    };

    const normalizedEditData = {
      name: normalizeValue(editData.name),
      email: normalizeValue(editData.email),
      status: normalizeValue(editData.status),
      maxUsers: editData.maxUsers || 0,
    };

    const normalizedOriginalData = {
      name: normalizeValue(originalData.name),
      email: normalizeValue(originalData.email),
      status: normalizeValue(originalData.status),
      maxUsers: originalData.maxUsers || 0,
    };

    return (
      JSON.stringify(normalizedEditData) !==
      JSON.stringify(normalizedOriginalData)
    );
  }, [editData, originalData]);

  // Handle navigation protection - must be at top level
  const handleNavigation = useCallback(
    (url: string) => {
      // Allow navigation within the same company (different tabs, etc.)
      if (url.includes(`/platform/companies/${params.id}`)) {
        router.push(url);
        return;
      }

      // If there are unsaved changes, show confirmation dialog
      if (hasUnsavedChanges()) {
        setPendingNavigation(url);
        setShowUnsavedChangesDialog(true);
      } else {
        router.push(url);
      }
    },
    [router, params.id, hasUnsavedChanges]
  );

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user?.isPlatformUser) {
      router.push("/platform/login");
      return;
    }

    fetchCompany();
  }, [session, status, router, fetchCompany]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/platform/companies/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        const updatedCompany = await response.json();
        setCompany(updatedCompany);
        const companyData = {
          name: updatedCompany.name,
          email: updatedCompany.email,
          status: updatedCompany.status,
          maxUsers: updatedCompany.maxUsers,
        };
        setOriginalData(companyData);
        toast({
          title: "Success",
          description: "Company updated successfully",
        });
      } else {
        throw new Error("Failed to update company");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to update company",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const statusAction = newStatus === "SUSPENDED" ? "suspend" : "activate";

    try {
      const response = await fetch(`/api/platform/companies/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setCompany((prev) => (prev ? { ...prev, status: newStatus } : null));
        setEditData((prev) => ({ ...prev, status: newStatus }));
        toast({
          title: "Success",
          description: `Company ${statusAction}d successfully`,
        });
      } else {
        throw new Error(`Failed to ${statusAction} company`);
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: `Failed to ${statusAction} company`,
        variant: "destructive",
      });
    }
  };

  const confirmNavigation = () => {
    if (pendingNavigation) {
      router.push(pendingNavigation);
      setPendingNavigation(null);
    }
    setShowUnsavedChangesDialog(false);
  };

  const cancelNavigation = () => {
    setPendingNavigation(null);
    setShowUnsavedChangesDialog(false);
  };

  // Protect against browser back/forward and other navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (hasUnsavedChanges()) {
        const confirmLeave = window.confirm(
          "You have unsaved changes. Are you sure you want to leave this page?"
        );
        if (!confirmLeave) {
          // Push the current state back to prevent navigation
          window.history.pushState(null, "", window.location.href);
          e.preventDefault();
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasUnsavedChanges]);

  const handleInviteUser = async () => {
    try {
      const response = await fetch(
        `/api/platform/companies/${params.id}/users`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inviteData),
        }
      );

      if (response.ok) {
        setShowInviteUser(false);
        setInviteData({ name: "", email: "", role: "USER" });
        fetchCompany(); // Refresh company data
        toast({
          title: "Success",
          description: "User invited successfully",
        });
      } else {
        throw new Error("Failed to invite user");
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Failed to invite user",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "default";
      case "TRIAL":
        return "secondary";
      case "SUSPENDED":
        return "destructive";
      case "ARCHIVED":
        return "outline";
      default:
        return "default";
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading company details...</div>
      </div>
    );
  }

  if (!session?.user?.isPlatformUser || !company) {
    return null;
  }

  const canEdit = session.user.platformRole === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleNavigation("/platform/dashboard")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {company.name}
                  </h1>
                  <Badge variant={getStatusBadgeVariant(company.status)}>
                    {company.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Company Management
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteUser(true)}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite User
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {company.users.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {company.maxUsers} maximum
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Sessions
                  </CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {company._count.sessions}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Data Imports
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {company._count.imports}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Created</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {new Date(company.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Company Info */}
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={companyNameFieldId}>Company Name</Label>
                    <Input
                      id={companyNameFieldId}
                      value={editData.name || ""}
                      onChange={(e) =>
                        setEditData((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <Label htmlFor={companyEmailFieldId}>Contact Email</Label>
                    <Input
                      id={companyEmailFieldId}
                      type="email"
                      value={editData.email || ""}
                      onChange={(e) =>
                        setEditData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <Label htmlFor={maxUsersFieldId}>Max Users</Label>
                    <Input
                      id={maxUsersFieldId}
                      type="number"
                      value={editData.maxUsers || 0}
                      onChange={(e) =>
                        setEditData((prev) => ({
                          ...prev,
                          maxUsers: Number.parseInt(e.target.value),
                        }))
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={editData.status}
                      onValueChange={(value) =>
                        setEditData((prev) => ({ ...prev, status: value }))
                      }
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="TRIAL">Trial</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                        <SelectItem value="ARCHIVED">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {canEdit && hasUnsavedChanges() && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditData(originalData);
                      }}
                    >
                      Cancel Changes
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Users ({company.users.length})
                  </span>
                  {canEdit && (
                    <Button size="sm" onClick={() => setShowInviteUser(true)}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite User
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {company.users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                            {user.name?.charAt(0) ||
                              user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">
                            {user.name || "No name"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">{user.role}</Badge>
                        <div className="text-sm text-muted-foreground">
                          Joined {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {company.users.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found. Invite the first user to get started.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400">
                  Danger Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canEdit && (
                  <>
                    <div className="flex items-center justify-between p-4 border border-red-200 dark:border-red-800 rounded-lg">
                      <div>
                        <h3 className="font-medium">Suspend Company</h3>
                        <p className="text-sm text-muted-foreground">
                          Temporarily disable access to this company
                        </p>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            disabled={company.status === "SUSPENDED"}
                          >
                            {company.status === "SUSPENDED"
                              ? "Already Suspended"
                              : "Suspend"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Suspend Company</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to suspend this company?
                              This will disable access for all users.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleStatusChange("SUSPENDED")}
                            >
                              Suspend
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {company.status === "SUSPENDED" && (
                      <div className="flex items-center justify-between p-4 border border-green-200 dark:border-green-800 rounded-lg">
                        <div>
                          <h3 className="font-medium">Reactivate Company</h3>
                          <p className="text-sm text-muted-foreground">
                            Restore access to this company
                          </p>
                        </div>
                        <Button
                          variant="default"
                          onClick={() => handleStatusChange("ACTIVE")}
                        >
                          Reactivate
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Analytics dashboard coming soon...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite User Dialog */}
      {showInviteUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Invite User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor={inviteNameFieldId}>Name</Label>
                <Input
                  id={inviteNameFieldId}
                  value={inviteData.name}
                  onChange={(e) =>
                    setInviteData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="User's full name"
                />
              </div>
              <div>
                <Label htmlFor={inviteEmailFieldId}>Email</Label>
                <Input
                  id={inviteEmailFieldId}
                  type="email"
                  value={inviteData.email}
                  onChange={(e) =>
                    setInviteData((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label htmlFor="inviteRole">Role</Label>
                <Select
                  value={inviteData.role}
                  onValueChange={(value) =>
                    setInviteData((prev) => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowInviteUser(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInviteUser}
                  className="flex-1"
                  disabled={!inviteData.email || !inviteData.name}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invite
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unsaved Changes Dialog */}
      <AlertDialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave this page.
              Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelNavigation}>
              Stay on Page
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigation}>
              Leave Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

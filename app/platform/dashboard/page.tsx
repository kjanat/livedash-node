"use client";

import {
  Activity,
  BarChart3,
  Building2,
  Check,
  Copy,
  Database,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  _count: {
    users: number;
    sessions: number;
    imports: number;
  };
}

interface DashboardData {
  companies: Company[];
  pagination: {
    total: number;
    pages: number;
  };
}

interface PlatformSession {
  user: {
    id: string;
    email: string;
    name?: string;
    isPlatformUser: boolean;
    platformRole: string;
  };
}

// Custom hook for platform session
function usePlatformSession() {
  const [session, setSession] = useState<PlatformSession | null>(null);
  const [status, setStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch("/api/platform/auth/session");
        const sessionData = await response.json();

        if (sessionData?.user?.isPlatformUser) {
          setSession(sessionData);
          setStatus("authenticated");
        } else {
          setSession(null);
          setStatus("unauthenticated");
        }
      } catch (error) {
        console.error("Platform session fetch error:", error);
        setSession(null);
        setStatus("unauthenticated");
      }
    };

    fetchSession();
  }, []);

  return { data: session, status };
}

export default function PlatformDashboard() {
  const { data: session, status } = usePlatformSession();
  const router = useRouter();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newCompanyData, setNewCompanyData] = useState({
    name: "",
    csvUrl: "",
    csvUsername: "",
    csvPassword: "",
    adminEmail: "",
    adminName: "",
    adminPassword: "",
    maxUsers: 10,
  });

  const companyNameId = useId();
  const csvUrlId = useId();
  const csvUsernameId = useId();
  const csvPasswordId = useId();
  const adminNameId = useId();
  const adminEmailId = useId();
  const adminPasswordId = useId();
  const maxUsersId = useId();

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch("/api/platform/companies");
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated" || !session?.user?.isPlatformUser) {
      router.push("/platform/login");
      return;
    }

    fetchDashboardData();
  }, [session, status, router, fetchDashboardData]);

  const copyToClipboard = async (text: string, type: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "email") {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const getFilteredCompanies = () => {
    if (!dashboardData?.companies) return [];

    return dashboardData.companies.filter((company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleCreateCompany = async () => {
    if (
      !newCompanyData.name ||
      !newCompanyData.csvUrl ||
      !newCompanyData.adminEmail ||
      !newCompanyData.adminName
    ) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/platform/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCompanyData),
      });

      if (response.ok) {
        const result = await response.json();
        setShowAddCompany(false);

        const companyName = newCompanyData.name;
        setNewCompanyData({
          name: "",
          csvUrl: "",
          csvUsername: "",
          csvPassword: "",
          adminEmail: "",
          adminName: "",
          adminPassword: "",
          maxUsers: 10,
        });

        fetchDashboardData(); // Refresh the list

        // Show success message with copyable credentials
        if (result.generatedPassword) {
          toast({
            title: "Company Created Successfully!",
            description: (
              <div className="space-y-3">
                <p className="font-medium">
                  Company "{companyName}" has been created.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-muted p-2 rounded">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        Admin Email:
                      </p>
                      <p className="font-mono text-sm">
                        {result.adminUser.email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        copyToClipboard(result.adminUser.email, "email")
                      }
                      className="h-8 w-8 p-0"
                    >
                      {copiedEmail ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between bg-muted p-2 rounded">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        Admin Password:
                      </p>
                      <p className="font-mono text-sm">
                        {result.generatedPassword}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        copyToClipboard(result.generatedPassword, "password")
                      }
                      className="h-8 w-8 p-0"
                    >
                      {copiedPassword ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ),
            duration: 15000, // Longer duration for credentials
          });
        } else {
          toast({
            title: "Success",
            description: `Company "${companyName}" created successfully`,
          });
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to create company");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create company",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
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
        <div className="text-center">Loading platform dashboard...</div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user?.isPlatformUser) {
    return null;
  }

  const filteredCompanies = getFilteredCompanies();
  const totalCompanies = dashboardData?.pagination?.total || 0;
  const totalUsers =
    dashboardData?.companies?.reduce(
      (sum, company) => sum + company._count.users,
      0
    ) || 0;
  const totalSessions =
    dashboardData?.companies?.reduce(
      (sum, company) => sum + company._count.sessions,
      0
    ) || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Platform Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Welcome back, {session.user.name || session.user.email}
              </p>
            </div>
            <div className="flex gap-4 items-center">
              <ThemeToggle />

              {/* Search Filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Companies
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCompanies}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
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
              <div className="text-2xl font-bold">{totalSessions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Companies
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.companies?.filter((c) => c.status === "ACTIVE")
                  .length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Companies List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Companies
                {searchTerm && (
                  <Badge variant="secondary" className="ml-2">
                    {filteredCompanies.length} of {totalCompanies} shown
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {searchTerm && (
                  <Badge variant="outline" className="text-xs">
                    Search: "{searchTerm}"
                  </Badge>
                )}
                <Dialog open={showAddCompany} onOpenChange={setShowAddCompany}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Company
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Company</DialogTitle>
                      <DialogDescription>
                        Create a new company and invite the first administrator.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor={companyNameId}>Company Name *</Label>
                        <Input
                          id={companyNameId}
                          value={newCompanyData.name}
                          onChange={(e) =>
                            setNewCompanyData((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Acme Corporation"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={csvUrlId}>CSV Data URL *</Label>
                        <Input
                          id={csvUrlId}
                          value={newCompanyData.csvUrl}
                          onChange={(e) =>
                            setNewCompanyData((prev) => ({
                              ...prev,
                              csvUrl: e.target.value,
                            }))
                          }
                          placeholder="https://api.company.com/sessions.csv"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={csvUsernameId}>CSV Auth Username</Label>
                        <Input
                          id={csvUsernameId}
                          value={newCompanyData.csvUsername}
                          onChange={(e) =>
                            setNewCompanyData((prev) => ({
                              ...prev,
                              csvUsername: e.target.value,
                            }))
                          }
                          placeholder="Optional HTTP auth username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={csvPasswordId}>CSV Auth Password</Label>
                        <Input
                          id={csvPasswordId}
                          type="password"
                          value={newCompanyData.csvPassword}
                          onChange={(e) =>
                            setNewCompanyData((prev) => ({
                              ...prev,
                              csvPassword: e.target.value,
                            }))
                          }
                          placeholder="Optional HTTP auth password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={adminNameId}>Admin Name *</Label>
                        <Input
                          id={adminNameId}
                          value={newCompanyData.adminName}
                          onChange={(e) =>
                            setNewCompanyData((prev) => ({
                              ...prev,
                              adminName: e.target.value,
                            }))
                          }
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={adminEmailId}>Admin Email *</Label>
                        <Input
                          id={adminEmailId}
                          type="email"
                          value={newCompanyData.adminEmail}
                          onChange={(e) =>
                            setNewCompanyData((prev) => ({
                              ...prev,
                              adminEmail: e.target.value,
                            }))
                          }
                          placeholder="admin@acme.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={adminPasswordId}>Admin Password</Label>
                        <Input
                          id={adminPasswordId}
                          type="password"
                          value={newCompanyData.adminPassword}
                          onChange={(e) =>
                            setNewCompanyData((prev) => ({
                              ...prev,
                              adminPassword: e.target.value,
                            }))
                          }
                          placeholder="Leave empty to auto-generate"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={maxUsersId}>Max Users</Label>
                        <Input
                          id={maxUsersId}
                          type="number"
                          value={newCompanyData.maxUsers}
                          onChange={(e) =>
                            setNewCompanyData((prev) => ({
                              ...prev,
                              maxUsers: Number.parseInt(e.target.value) || 10,
                            }))
                          }
                          min="1"
                          max="1000"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowAddCompany(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateCompany}
                        disabled={isCreating}
                      >
                        {isCreating ? "Creating..." : "Create Company"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredCompanies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold">{company.name}</h3>
                      <Badge variant={getStatusBadgeVariant(company.status)}>
                        {company.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span>{company._count.users} users</span>
                      <span>{company._count.sessions} sessions</span>
                      <span>{company._count.imports} imports</span>
                      <span>
                        Created{" "}
                        {new Date(company.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Analytics
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/platform/companies/${company.id}`)
                      }
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage
                    </Button>
                  </div>
                </div>
              ))}

              {!filteredCompanies.length && (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? (
                    <div className="space-y-2">
                      <p>No companies match "{searchTerm}".</p>
                      <Button
                        variant="link"
                        onClick={() => setSearchTerm("")}
                        className="text-sm"
                      >
                        Clear search to see all companies
                      </Button>
                    </div>
                  ) : (
                    "No companies found. Create your first company to get started."
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

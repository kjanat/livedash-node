"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Users,
  Database,
  Activity,
  Plus,
  Settings,
  BarChart3
} from "lucide-react";
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

// Custom hook for platform session
function usePlatformSession() {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

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
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    name: "",
    adminEmail: "",
    adminName: "",
    adminPassword: "",
    maxUsers: 10,
  });

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated" || !session?.user?.isPlatformUser) {
      router.push("/platform/login");
      return;
    }

    fetchDashboardData();
  }, [session, status, router]);

  const fetchDashboardData = async () => {
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
  };

  const handleCreateCompany = async () => {
    if (!newCompanyData.name || !newCompanyData.adminEmail || !newCompanyData.adminName) {
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
        setNewCompanyData({
          name: "",
          adminEmail: "",
          adminName: "",
          adminPassword: "",
          maxUsers: 10,
        });
        fetchDashboardData(); // Refresh the list
        toast({
          title: "Success",
          description: `Company "${newCompanyData.name}" created successfully`,
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to create company");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create company",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACTIVE": return "default";
      case "TRIAL": return "secondary";
      case "SUSPENDED": return "destructive";
      case "ARCHIVED": return "outline";
      default: return "default";
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

  const totalCompanies = dashboardData?.pagination?.total || 0;
  const totalUsers = dashboardData?.companies?.reduce((sum, company) => sum + company._count.users, 0) || 0;
  const totalSessions = dashboardData?.companies?.reduce((sum, company) => sum + company._count.sessions, 0) || 0;

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
            <div className="flex gap-4">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
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
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        value={newCompanyData.name}
                        onChange={(e) => setNewCompanyData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Acme Corporation"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminName">Admin Name *</Label>
                      <Input
                        id="adminName"
                        value={newCompanyData.adminName}
                        onChange={(e) => setNewCompanyData(prev => ({ ...prev, adminName: e.target.value }))}
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminEmail">Admin Email *</Label>
                      <Input
                        id="adminEmail"
                        type="email"
                        value={newCompanyData.adminEmail}
                        onChange={(e) => setNewCompanyData(prev => ({ ...prev, adminEmail: e.target.value }))}
                        placeholder="admin@acme.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adminPassword">Admin Password</Label>
                      <Input
                        id="adminPassword"
                        type="password"
                        value={newCompanyData.adminPassword}
                        onChange={(e) => setNewCompanyData(prev => ({ ...prev, adminPassword: e.target.value }))}
                        placeholder="Leave empty to auto-generate"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxUsers">Max Users</Label>
                      <Input
                        id="maxUsers"
                        type="number"
                        value={newCompanyData.maxUsers}
                        onChange={(e) => setNewCompanyData(prev => ({ ...prev, maxUsers: parseInt(e.target.value) || 10 }))}
                        min="1"
                        max="1000"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddCompany(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateCompany} disabled={isCreating}>
                      {isCreating ? "Creating..." : "Create Company"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
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
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSessions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboardData?.companies?.filter(c => c.status === "ACTIVE").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Companies List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Companies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData?.companies?.map((company) => (
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
                      <span>Created {new Date(company.createdAt).toLocaleDateString()}</span>
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
                      onClick={() => router.push(`/platform/companies/${company.id}`)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Manage
                    </Button>
                  </div>
                </div>
              ))}

              {!dashboardData?.companies?.length && (
                <div className="text-center py-8 text-muted-foreground">
                  No companies found. Create your first company to get started.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
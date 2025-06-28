"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FC } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  MessageSquare,
  Settings,
  Users,
  ArrowRight,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";

const DashboardPage: FC = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Once session is loaded, redirect appropriately
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      setLoading(false);
    }
  }, [status, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-muted border-t-primary mx-auto"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-primary opacity-20 mx-auto"></div>
          </div>
          <p className="text-lg text-muted-foreground animate-pulse">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const navigationCards = [
    {
      title: "Analytics Overview",
      description:
        "View comprehensive metrics, charts, and insights from your chat sessions",
      icon: <BarChart3 className="h-6 w-6" />,
      href: "/dashboard/overview",
      variant: "primary" as const,
      features: ["Real-time metrics", "Interactive charts", "Trend analysis"],
    },
    {
      title: "Session Browser",
      description:
        "Browse, search, and analyze individual conversation sessions",
      icon: <MessageSquare className="h-6 w-6" />,
      href: "/dashboard/sessions",
      variant: "success" as const,
      features: ["Session search", "Conversation details", "Export data"],
    },
    ...(session?.user?.role === "ADMIN"
      ? [
          {
            title: "Company Settings",
            description:
              "Configure company settings, integrations, and API connections",
            icon: <Settings className="h-6 w-6" />,
            href: "/dashboard/company",
            variant: "warning" as const,
            features: [
              "API configuration",
              "Integration settings",
              "Data management",
            ],
            adminOnly: true,
          },
          {
            title: "User Management",
            description:
              "Invite team members and manage user accounts and permissions",
            icon: <Users className="h-6 w-6" />,
            href: "/dashboard/users",
            variant: "default" as const,
            features: ["User invitations", "Role management", "Access control"],
            adminOnly: true,
          },
        ]
      : []),
  ];

  const getCardClasses = (variant: string) => {
    switch (variant) {
      case "primary":
        return "border-primary/20 bg-linear-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15";
      case "success":
        return "border-green-200 bg-linear-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-150 dark:border-green-800 dark:from-green-950 dark:to-green-900";
      case "warning":
        return "border-amber-200 bg-linear-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-150 dark:border-amber-800 dark:from-amber-950 dark:to-amber-900";
      default:
        return "border-border bg-linear-to-br from-card to-muted/20 hover:from-muted/30 hover:to-muted/40";
    }
  };

  const getIconClasses = (variant: string) => {
    switch (variant) {
      case "primary":
        return "bg-primary/10 text-primary border-primary/20";
      case "success":
        return "bg-green-100 text-green-600 border-green-200 dark:bg-green-900 dark:text-green-400 dark:border-green-800";
      case "warning":
        return "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900 dark:text-amber-400 dark:border-amber-800";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-xl bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent" />
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-foreground to-foreground/70">
                  Welcome back, {session?.user?.name || "User"}!
                </h1>
                <Badge variant="secondary" className="text-xs px-3 py-1 bg-primary/10 text-primary border-primary/20">
                  {session?.user?.role}
                </Badge>
              </div>
              <p className="text-muted-foreground text-lg">
                Choose a section below to explore your analytics dashboard
              </p>
            </div>

            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-muted/50 backdrop-blur-sm">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Secure Dashboard</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {navigationCards.map((card, index) => (
          <Card
            key={index}
            className={`relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer group ${getCardClasses(
              card.variant
            )}`}
            onClick={() => router.push(card.href)}
          >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 bg-linear-to-br from-white/50 to-transparent dark:from-white/5 pointer-events-none" />

            <CardHeader className="relative">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition-all duration-300 group-hover:scale-110 ${getIconClasses(
                        card.variant
                      )}`}
                    >
                      <span className="transition-transform duration-300 group-hover:scale-110">{card.icon}</span>
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold flex items-center gap-2">
                        {card.title}
                        {card.adminOnly && (
                          <Badge variant="outline" className="text-xs">
                            Admin
                          </Badge>
                        )}
                      </CardTitle>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative space-y-4">
              {/* Features List */}
              <div className="space-y-2">
                {card.features.map((feature, featureIndex) => (
                  <div
                    key={featureIndex}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Zap className="h-3 w-3 text-primary/60" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <Button
                className="w-full gap-2 mt-4 group-hover:gap-3 transition-all duration-300"
                variant={card.variant === "primary" ? "default" : "outline"}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(card.href);
                }}
              >
                <span>
                  {card.title === "Analytics Overview" && "View Analytics"}
                  {card.title === "Session Browser" && "Browse Sessions"}
                  {card.title === "Company Settings" && "Manage Settings"}
                  {card.title === "User Management" && "Manage Users"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">Real-time</span>
              </div>
              <p className="text-sm text-muted-foreground">Data updates</p>
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">Secure</span>
              </div>
              <p className="text-sm text-muted-foreground">Data protection</p>
            </div>

            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span className="text-2xl font-bold">Advanced</span>
              </div>
              <p className="text-sm text-muted-foreground">Analytics</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;

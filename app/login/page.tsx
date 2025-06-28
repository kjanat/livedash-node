"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Loader2, Shield, BarChart3, Zap } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.ok) {
        toast.success("Login successful! Redirecting...");
        router.push("/dashboard");
      } else {
        setError("Invalid email or password. Please try again.");
        toast.error("Login failed. Please check your credentials.");
      }
    } catch {
      setError("An error occurred. Please try again.");
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding and Features */}
      <div className="hidden lg:flex lg:flex-1 bg-linear-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent" />
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative flex flex-col justify-center px-12 py-24">
          <div className="max-w-md">
            <Link href="/" className="flex items-center gap-3 mb-8">
              <div className="relative w-12 h-12">
                <Image
                  src="/favicon.svg"
                  alt="LiveDash Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-2xl font-bold text-primary">LiveDash</span>
            </Link>

            <h1 className="text-4xl font-bold tracking-tight mb-6">
              Welcome back to your analytics dashboard
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Monitor, analyze, and optimize your customer conversations with
              AI-powered insights.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <span className="text-muted-foreground">
                  Real-time analytics and insights
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                  <Shield className="h-5 w-5" />
                </div>
                <span className="text-muted-foreground">
                  Enterprise-grade security
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="text-muted-foreground">
                  AI-powered conversation analysis
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <Image
                  src="/favicon.svg"
                  alt="LiveDash Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold text-primary">LiveDash</span>
            </Link>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
              <CardDescription>
                Enter your email and password to access your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Live region for screen reader announcements */}
              <div role="status" aria-live="polite" className="sr-only">
                {isLoading && "Signing in, please wait..."}
                {error && `Error: ${error}`}
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6" role="alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    aria-describedby="email-help"
                    aria-invalid={!!error}
                    className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  />
                  <div id="email-help" className="sr-only">
                    Enter your company email address
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    aria-describedby="password-help"
                    aria-invalid={!!error}
                    className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  />
                  <div id="password-help" className="sr-only">
                    Enter your account password
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full mt-6 h-11 bg-linear-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-200"
                  disabled={isLoading || !email || !password}
                  aria-describedby={isLoading ? "loading-status" : undefined}
                >
                  {isLoading ? (
                    <>
                      <Loader2
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
                {isLoading && (
                  <div
                    id="loading-status"
                    className="sr-only"
                    aria-live="polite"
                  >
                    Authentication in progress, please wait
                  </div>
                )}
              </form>

              <div className="mt-6 space-y-4">
                <div className="text-center">
                  <Link
                    href="/register"
                    className="text-sm text-primary hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
                  >
                    Don&apos;t have a company account? Register here
                  </Link>
                </div>
                <div className="text-center">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
                  >
                    Forgot your password?
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By signing in, you agree to our{" "}
            <Link
              href="/terms"
              className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-sm"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

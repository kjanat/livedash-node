"use client";

import {
  ArrowRight,
  BarChart3,
  Brain,
  Globe,
  MessageCircle,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      router.push("/dashboard");
    }
  }, [session, router]);

  const handleGetStarted = () => {
    setIsLoading(true);
    router.push("/login");
  };

  const handleRequestDemo = () => {
    // For now, redirect to contact - can be enhanced later
    window.open("mailto:demo@notso.ai?subject=LiveDash Demo Request", "_blank");
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="relative z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                LiveDash
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={handleRequestDemo}>
                Request Demo
              </Button>
              <Button onClick={handleGetStarted} disabled={isLoading}>
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-8 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 dark:from-blue-900 dark:to-purple-900 dark:text-blue-200">
              <Sparkles className="w-4 h-4 mr-2" />
              AI-Powered Analytics Platform
            </Badge>

            <h1 className="text-5xl lg:text-7xl font-bold mb-8 bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent leading-tight">
              Transform Customer
              <br />
              Conversations into
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Actionable Insights
              </span>
            </h1>

            <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              LiveDash analyzes your customer support conversations with
              advanced AI to deliver real-time sentiment analysis, automated
              categorization, and powerful analytics that drive better business
              decisions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg"
                onClick={handleGetStarted}
                disabled={isLoading}
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-4 text-lg"
                onClick={handleRequestDemo}
              >
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">
              Powerful Features for Modern Teams
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Everything you need to understand and optimize your customer
              interactions
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {/* Feature Stack */}
            <div className="relative">
              {/* Connection Lines */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-blue-200 via-purple-200 to-transparent dark:from-blue-800 dark:via-purple-800 transform -translate-x-1/2 z-0"></div>

              {/* Feature Cards */}
              <div className="space-y-16 relative z-10">
                {/* AI Sentiment Analysis */}
                <div className="flex items-center gap-8 group">
                  <div className="flex-1 text-right">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                      <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                        AI Sentiment Analysis
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Automatically analyze customer emotions and satisfaction
                        levels across all conversations with 99.9% accuracy
                      </p>
                    </div>
                  </div>
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1"></div>
                </div>

                {/* Smart Categorization */}
                <div className="flex items-center gap-8 group">
                  <div className="flex-1"></div>
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <MessageCircle className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                      <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                        Smart Categorization
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Intelligently categorize conversations by topic,
                        urgency, and department automatically using advanced ML
                      </p>
                    </div>
                  </div>
                </div>

                {/* Real-time Analytics */}
                <div className="flex items-center gap-8 group">
                  <div className="flex-1 text-right">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                      <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                        Real-time Analytics
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Get instant insights with beautiful dashboards and
                        real-time performance metrics that update live
                      </p>
                    </div>
                  </div>
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1"></div>
                </div>

                {/* Enterprise Security */}
                <div className="flex items-center gap-8 group">
                  <div className="flex-1"></div>
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                      <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                        Enterprise Security
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Bank-grade security with GDPR compliance, SOC 2
                        certification, and end-to-end encryption
                      </p>
                    </div>
                  </div>
                </div>

                {/* Lightning Fast */}
                <div className="flex items-center gap-8 group">
                  <div className="flex-1 text-right">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                      <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                        Lightning Fast
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Process thousands of conversations in seconds with our
                        optimized AI pipeline and global CDN
                      </p>
                    </div>
                  </div>
                  <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1"></div>
                </div>

                {/* Global Scale */}
                <div className="flex items-center gap-8 group">
                  <div className="flex-1"></div>
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                    <Globe className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                      <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                        Global Scale
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Multi-language support with global infrastructure for
                        teams worldwide, serving 50+ countries
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-12 text-gray-900 dark:text-white">
            Trusted by Growing Companies
          </h2>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                10,000+
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                Conversations Analyzed Daily
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                99.9%
              </div>
              <div className="text-gray-600 dark:text-gray-300">
                Accuracy Rate
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">50+</div>
              <div className="text-gray-600 dark:text-gray-300">
                Enterprise Customers
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Customer Insights?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of teams already using LiveDash to make data-driven
            decisions and improve customer satisfaction.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg font-semibold"
              onClick={handleGetStarted}
              disabled={isLoading}
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10 px-8 py-4 text-lg"
              onClick={handleRequestDemo}
            >
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">LiveDash</span>
              </div>
              <p className="text-gray-400">
                AI-powered customer conversation analytics for modern teams.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Integrations
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Notso AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

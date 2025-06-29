"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { TopQuestion } from "../lib/types";

interface TopQuestionsChartProps {
  data: TopQuestion[];
  title?: string;
}

export default function TopQuestionsChart({
  data,
  title = "Top 5 Asked Questions",
}: TopQuestionsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No questions data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find the maximum count to calculate relative bar widths
  const maxCount = Math.max(...data.map((q) => q.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((question) => {
            const percentage =
              maxCount > 0 ? (question.count / maxCount) * 100 : 0;

            return (
              <div key={question.question} className="relative pl-8">
                {/* Question text */}
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm font-medium leading-tight pr-4 flex-1 text-foreground">
                    {question.question}
                  </p>
                  <Badge variant="secondary" className="whitespace-nowrap">
                    {question.count}
                  </Badge>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Rank indicator */}
                <div className="absolute -left-1 top-0 w-6 h-6 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
              </div>
            );
          })}
        </div>

        <Separator className="my-6" />

        {/* Summary */}
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Total questions analyzed</span>
          <span className="font-medium text-foreground">
            {data.reduce((sum, q) => sum + q.count, 0)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import React from "react";
import { TopQuestion } from "../lib/types";

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
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center py-8 text-gray-500">
          No questions data available
        </div>
      </div>
    );
  }

  // Find the maximum count to calculate relative bar widths
  const maxCount = Math.max(...data.map((q) => q.count));

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

      <div className="space-y-4">
        {data.map((question, index) => {
          const percentage =
            maxCount > 0 ? (question.count / maxCount) * 100 : 0;

          return (
            <div key={index} className="relative">
              {/* Question text */}
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm text-gray-700 font-medium leading-tight pr-4 flex-1">
                  {question.question}
                </p>
                <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded-md whitespace-nowrap">
                  {question.count}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Rank indicator */}
              <div className="absolute -left-2 top-0 w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {index + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Total questions analyzed</span>
          <span className="font-medium">
            {data.reduce((sum, q) => sum + q.count, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

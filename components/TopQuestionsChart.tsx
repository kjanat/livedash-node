'use client';

import React from 'react';
import { TopQuestion } from '../lib/types';

interface TopQuestionsChartProps {
  data: TopQuestion[];
  title?: string;
}

export default function TopQuestionsChart({ data, title = "Top 5 Asked Questions" }: TopQuestionsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
        <div className="text-center py-12 text-gray-500">
          No questions data available
        </div>
      </div>
    );
  }

  // Find the maximum count to calculate relative bar widths
  const maxCount = Math.max(...data.map(q => q.count));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>

      <div className="space-y-6">
        {data.map((question, index) => {
          const percentage = maxCount > 0 ? (question.count / maxCount) * 100 : 0;

          return (
            <div key={index} className="group">
              {/* Rank and Question */}
              <div className="flex items-start gap-4 mb-3">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 text-gray-900 text-sm font-semibold rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-relaxed mb-2">
                    {question.question}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 min-w-0">
                      {question.count} times
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total questions analyzed</span>
          <span className="text-sm font-semibold text-gray-900">
            {data.reduce((sum, q) => sum + q.count, 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

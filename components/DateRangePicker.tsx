"use client";

import { useState, useEffect } from "react";

interface DateRangePickerProps {
  minDate: string;
  maxDate: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  initialStartDate?: string;
  initialEndDate?: string;
}

export default function DateRangePicker({
  minDate,
  maxDate,
  onDateRangeChange,
  initialStartDate,
  initialEndDate,
}: DateRangePickerProps) {
  const [startDate, setStartDate] = useState(initialStartDate || minDate);
  const [endDate, setEndDate] = useState(initialEndDate || maxDate);

  useEffect(() => {
    // Only notify parent component when dates change, not when the callback changes
    onDateRangeChange(startDate, endDate);
  }, [startDate, endDate]);

  const handleStartDateChange = (newStartDate: string) => {
    // Ensure start date is not before min date
    if (newStartDate < minDate) {
      setStartDate(minDate);
      return;
    }

    // Ensure start date is not after end date
    if (newStartDate > endDate) {
      setEndDate(newStartDate);
    }

    setStartDate(newStartDate);
  };

  const handleEndDateChange = (newEndDate: string) => {
    // Ensure end date is not after max date
    if (newEndDate > maxDate) {
      setEndDate(maxDate);
      return;
    }

    // Ensure end date is not before start date
    if (newEndDate < startDate) {
      setStartDate(newEndDate);
    }

    setEndDate(newEndDate);
  };

  const resetToFullRange = () => {
    setStartDate(minDate);
    setEndDate(maxDate);
  };

  const setLast30Days = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Use the later of 30 days ago or minDate
    const newStartDate = thirtyDaysAgoStr > minDate ? thirtyDaysAgoStr : minDate;
    setStartDate(newStartDate);
    setEndDate(maxDate);
  };

  const setLast7Days = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    // Use the later of 7 days ago or minDate
    const newStartDate = sevenDaysAgoStr > minDate ? sevenDaysAgoStr : minDate;
    setStartDate(newStartDate);
    setEndDate(maxDate);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Date Range:
          </label>

          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <label htmlFor="start-date" className="text-sm text-gray-600">
                From:
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="end-date" className="text-sm text-gray-600">
                To:
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={setLast7Days}
            className="px-3 py-1.5 text-xs font-medium text-sky-600 bg-sky-50 border border-sky-200 rounded-md hover:bg-sky-100 transition-colors"
          >
            Last 7 days
          </button>
          <button
            onClick={setLast30Days}
            className="px-3 py-1.5 text-xs font-medium text-sky-600 bg-sky-50 border border-sky-200 rounded-md hover:bg-sky-100 transition-colors"
          >
            Last 30 days
          </button>
          <button
            onClick={resetToFullRange}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
          >
            All time
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Available data: {new Date(minDate).toLocaleDateString()} - {new Date(maxDate).toLocaleDateString()}
      </div>
    </div>
  );
}

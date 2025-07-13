# Dashboard Component Documentation

This document describes the enhanced components added to the Dashboard for an improved visualization experience.

## New Components

### 1. WordCloud

The WordCloud component visualizes categories or topics based on their frequency. The size of each word corresponds to its frequency in the data.

**File:** `components/WordCloud.tsx`

**Features:**

-   Dynamic sizing based on frequency
-   Colorful display with a pleasing color palette
-   Responsive design
-   Interactive hover effects

### 2. GeographicMap

This component displays a world map with circles representing the number of sessions from each country.

**File:** `components/GeographicMap.tsx`

**Features:**

-   Interactive map using React Leaflet
-   Circle sizes scaled by session count
-   Tooltips showing country names and session counts
-   Responsive design

### 3. MetricCard

A modern, visually appealing card for displaying key metrics.

**File:** `components/MetricCard.tsx`

**Features:**

-   Multiple design variants (default, primary, success, warning, danger)
-   Support for trend indicators
-   Icons and descriptions
-   Clean, modern styling

### 4. DonutChart

An enhanced donut chart with better styling and a central text display capability.

**File:** `components/DonutChart.tsx`

**Features:**

-   Customizable colors
-   Center text area for displaying summaries
-   Interactive tooltips with percentages
-   Well-balanced legend display

### 5. ResponseTimeDistribution

Visualizes the distribution of response times as a histogram.

**File:** `components/ResponseTimeDistribution.tsx`

**Features:**

-   Color-coded bars (green for fast, yellow for medium, red for slow)
-   Target time indicator
-   Automatic binning of response times
-   Clear labeling and scales

## Dashboard Enhancements

The dashboard has been enhanced with:

1.  **Improved Layout**: Better use of space and responsive grid layouts
2.  **Visual Hierarchies**: Clear heading styles and consistent spacing
3.  **Color Coding**: Semantic use of colors to indicate statuses
4.  **Interactive Elements**: Better button styles with loading indicators
5.  **Data Context**: More complete view of metrics with additional visualizations
6.  **Geographic Insights**: Map view of session distribution by country
7.  **Language Analysis**: Improved language distribution visualization
8.  **Category Analysis**: Word cloud for category popularity
9.  **Performance Metrics**: Response time distribution for better insight into system performance

## Usage Notes

-   The geographic map and response time distribution use simulated data where actual data is not available
-   All components are responsive and will adjust to different screen sizes
-   The dashboard automatically refreshes data when using the refresh button
-   Admin users have access to additional controls at the bottom of the dashboard

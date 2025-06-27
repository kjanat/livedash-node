# Session Processing with OpenAI

This document explains how the session processing system works in LiveDash-Node.

## Overview

The system now includes an automated process for analyzing chat session transcripts using OpenAI's API. This process:

1.  Fetches session data from CSV sources
2.  Only adds new sessions that don't already exist in the database
3.  Processes session transcripts with OpenAI to extract valuable insights
4.  Updates the database with the processed information

## How It Works

### Session Fetching

-   The system fetches session data from configured CSV URLs for each company
-   Unlike the previous implementation, it now only adds sessions that don't already exist in the database
-   This prevents duplicate sessions and allows for incremental updates

### Transcript Processing

-   For sessions with transcript content that haven't been processed yet, the system calls OpenAI's API
-   The API analyzes the transcript and extracts the following information:
    -   Primary language used (ISO 639-1 code)
    -   Number of messages sent by the user
    -   Overall sentiment (positive, neutral, negative)
    -   Whether the conversation was escalated
    -   Whether HR contact was mentioned or provided
    -   Best-fitting category for the conversation
    -   Up to 5 paraphrased questions asked by the user
    -   A brief summary of the conversation

### Scheduling

The system includes two schedulers:

1.  **Session Refresh Scheduler**: Runs every 15 minutes to fetch new sessions from CSV sources
2.  **Session Processing Scheduler**: Runs every hour to process unprocessed sessions with OpenAI

## Database Schema

The Session model has been updated with new fields to store the processed data:

-   `processed`: Boolean flag indicating whether the session has been processed
-   `sentimentCategory`: String value ("positive", "neutral", "negative") from OpenAI
-   `questions`: JSON array of questions asked by the user
-   `summary`: Brief summary of the conversation

## Configuration

### OpenAI API Key

To use the session processing feature, you need to add your OpenAI API key to the `.env.local` file:

```ini
OPENAI_API_KEY=your_api_key_here
```

### Running with Schedulers

To run the application with schedulers enabled:

-   Development: `npm run dev`
-   Development (with schedulers disabled): `npm run dev:no-schedulers`
-   Production: `npm run start`

Note: These commands will start a custom Next.js server with the schedulers enabled. You'll need to have an OpenAI API key set in your `.env.local` file for the session processing to work.

## Manual Processing

You can also manually process sessions by running the script:

```
node scripts/process_sessions.mjs
```

This will process all unprocessed sessions that have transcript content.

## Customization

The processing logic can be customized by modifying:

-   `lib/processingScheduler.ts`: Contains the OpenAI processing logic
-   `scripts/process_sessions.ts`: Standalone script for manual processing

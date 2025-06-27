# Scheduler Workflow Documentation

## Overview

The LiveDash system has two main schedulers that work together to fetch and process session data:

1.  **Session Refresh Scheduler** - Fetches new sessions from CSV files
2.  **Processing Scheduler** - Processes session transcripts with AI

## Current Status (as of latest check)

-   **Total sessions**: 107
-   **Processed sessions**: 0  
-   **Sessions with transcript**: 0
-   **Ready for processing**: 0

## How the `processed` Field Works

The ProcessingScheduler picks up sessions where `processed` is **NOT** `true`, which includes:

-   `processed = false`
-   `processed = null`

**Query used:**

```javascript
{ processed: { not: true } } // Either false or null
```

## Complete Workflow

### Step 1: Session Refresh (CSV Fetching)

**What it does:**

-   Fetches session data from company CSV URLs
-   Creates session records in database with basic metadata
-   Sets `transcriptContent = null` initially
-   Sets `processed = null` initially

**Runs:** Every 30 minutes (cron: `*/30 * * * *`)

### Step 2: Transcript Fetching

**What it does:**

-   Downloads full transcript content for sessions
-   Updates `transcriptContent` field with actual conversation data
-   Sessions remain `processed = null` until AI processing

**Runs:** As part of session refresh process

### Step 3: AI Processing

**What it does:**

-   Finds sessions with transcript content where `processed != true`
-   Sends transcripts to OpenAI for analysis
-   Extracts: sentiment, category, questions, summary, etc.
-   Updates session with processed data
-   Sets `processed = true`

**Runs:** Every hour (cron: `0 * * * *`)

## Manual Trigger Commands

### Check Current Status

```bash
node scripts/manual-triggers.js status
```

### Trigger Session Refresh (Fetch new sessions from CSV)

```bash
node scripts/manual-triggers.js refresh
```

### Trigger AI Processing (Process unprocessed sessions)

```bash
node scripts/manual-triggers.js process
```

### Run Both Schedulers

```bash
node scripts/manual-triggers.js both
```

## Troubleshooting

### No Sessions Being Processed?

1.  **Check if sessions have transcripts:**

   ```bash
   node scripts/manual-triggers.js status
   ```

2.  **If "Sessions with transcript" is 0:**
   -   Sessions exist but transcripts haven't been fetched yet
   -   Run session refresh: `node scripts/manual-triggers.js refresh`

3.  **If "Ready for processing" is 0 but "Sessions with transcript" > 0:**
   -   All sessions with transcripts have already been processed
   -   Check if `OPENAI_API_KEY` is set in environment

### Common Issues

#### "No sessions found requiring processing"

-   All sessions with transcripts have been processed (`processed = true`)
-   Or no sessions have transcript content yet

#### "OPENAI_API_KEY environment variable is not set"

-   Add OpenAI API key to `.env.development` file
-   Restart the application

#### "Error fetching transcript: Unauthorized"

-   CSV credentials are incorrect or expired
-   Check company CSV username/password in database

## Database Field Mapping

### Before AI Processing

```javascript
{
  id: "session-uuid",
  transcriptContent: "full conversation text" | null,
  processed: null,
  sentimentCategory: null,
  questions: null,
  summary: null,
  // ... other fields
}
```

### After AI Processing

```javascript
{
  id: "session-uuid", 
  transcriptContent: "full conversation text",
  processed: true,
  sentimentCategory: "positive" | "neutral" | "negative",
  questions: '["question 1", "question 2"]', // JSON string
  summary: "Brief conversation summary",
  language: "en", // ISO 639-1 code
  messagesSent: 5,
  sentiment: 0.8, // Float value (-1 to 1)
  escalated: false,
  forwardedHr: false,
  category: "Schedule & Hours",
  // ... other fields
}
```

## Scheduler Configuration

### Session Refresh Scheduler

-   **File**: `lib/scheduler.js`
-   **Frequency**: Every 30 minutes
-   **Cron**: `*/30 * * * *`

### Processing Scheduler  

-   **File**: `lib/processingScheduler.js`
-   **Frequency**: Every hour
-   **Cron**: `0 * * * *`
-   **Batch size**: 10 sessions per run

## Environment Variables Required

```bash
# Database
DATABASE_URL="postgresql://..."

# OpenAI (for processing)
OPENAI_API_KEY="sk-..."

# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
```

## Next Steps for Testing

1.  **Trigger session refresh** to fetch transcripts:

   ```bash
   node scripts/manual-triggers.js refresh
   ```

2.  **Check status** to see if transcripts were fetched:

   ```bash
   node scripts/manual-triggers.js status
   ```

3.  **Trigger processing** if transcripts are available:

   ```bash
   node scripts/manual-triggers.js process
   ```

4.  **View results** in the dashboard session details pages

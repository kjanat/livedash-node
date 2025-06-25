# Transcript Parsing Implementation

## Overview
Added structured message parsing to the LiveDash system, allowing transcripts to be broken down into individual messages with timestamps, roles, and content. This provides a much better user experience for viewing conversations.

## Database Changes

### New Message Table
```sql
CREATE TABLE Message (
  id        TEXT PRIMARY KEY DEFAULT (uuid()),
  sessionId TEXT NOT NULL,
  timestamp DATETIME NOT NULL,
  role      TEXT NOT NULL,
  content   TEXT NOT NULL,
  order     INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sessionId) REFERENCES Session(id) ON DELETE CASCADE
);

CREATE INDEX Message_sessionId_order_idx ON Message(sessionId, order);
```

### Updated Session Table
- Added `messages` relation to Session model
- Sessions can now have both raw transcript content AND parsed messages

## New Components

### 1. Message Interface (`lib/types.ts`)
```typescript
export interface Message {
  id: string;
  sessionId: string;
  timestamp: Date;
  role: string; // "User", "Assistant", "System", etc.
  content: string;
  order: number; // Order within the conversation (0, 1, 2, ...)
  createdAt: Date;
}
```

### 2. Transcript Parser (`lib/transcriptParser.js`)
- **`parseChatLogToJSON(logString)`** - Parses raw transcript text into structured messages
- **`storeMessagesForSession(sessionId, messages)`** - Stores parsed messages in database
- **`processTranscriptForSession(sessionId, transcriptContent)`** - Complete processing for one session
- **`processAllUnparsedTranscripts()`** - Batch process all unparsed transcripts
- **`getMessagesForSession(sessionId)`** - Retrieve messages for a session

### 3. MessageViewer Component (`components/MessageViewer.tsx`)
- Chat-like interface for displaying parsed messages
- Color-coded by role (User: blue, Assistant: gray, System: yellow)
- Shows timestamps and message order
- Scrollable with conversation metadata

## Updated Components

### 1. Session API (`pages/api/dashboard/session/[id].ts`)
- Now includes parsed messages in session response
- Messages are ordered by `order` field (ascending)

### 2. Session Details Page (`app/dashboard/sessions/[id]/page.tsx`)
- Added MessageViewer component
- Shows both parsed messages AND raw transcript
- Prioritizes parsed messages when available

### 3. ChatSession Interface (`lib/types.ts`)
- Added optional `messages?: Message[]` field

## Parsing Logic

### Supported Format
The parser expects transcript format:
```
[DD.MM.YYYY HH:MM:SS] Role: Message content
[DD.MM.YYYY HH:MM:SS] User: Hello, I need help
[DD.MM.YYYY HH:MM:SS] Assistant: How can I help you today?
```

### Features
- **Multi-line support** - Messages can span multiple lines
- **Timestamp parsing** - Converts DD.MM.YYYY HH:MM:SS to ISO format
- **Role detection** - Extracts sender role from each message
- **Ordering** - Maintains conversation order with explicit order field
- **Sorting** - Messages sorted by timestamp, then by role (User before Assistant)

## Manual Commands

### New Commands Added
```bash
# Parse transcripts into structured messages
node scripts/manual-triggers.js parse

# Complete workflow: refresh → parse → process
node scripts/manual-triggers.js all

# Check status (now shows parsing info)
node scripts/manual-triggers.js status
```

### Updated Commands
- **`status`** - Now shows transcript and parsing statistics
- **`all`** - New command that runs refresh → parse → process in sequence

## Workflow Integration

### Complete Processing Pipeline
1. **Session Refresh** - Fetch sessions from CSV, download transcripts
2. **Transcript Parsing** - Parse raw transcripts into structured messages
3. **AI Processing** - Process sessions with OpenAI for sentiment, categories, etc.

### Database States
```javascript
// After CSV fetch
{
  transcriptContent: "raw text...",
  messages: [], // Empty
  processed: null
}

// After parsing
{
  transcriptContent: "raw text...",
  messages: [Message, Message, ...], // Parsed
  processed: null
}

// After AI processing
{
  transcriptContent: "raw text...",
  messages: [Message, Message, ...], // Parsed
  processed: true,
  sentimentCategory: "positive",
  summary: "Brief summary...",
  // ... other AI fields
}
```

## User Experience Improvements

### Before
- Only raw transcript text in a text area
- Difficult to follow conversation flow
- No clear distinction between speakers

### After
- **Chat-like interface** with message bubbles
- **Color-coded roles** for easy identification
- **Timestamps** for each message
- **Conversation metadata** (first/last message times)
- **Fallback to raw transcript** if parsing fails
- **Both views available** - structured AND raw

## Testing

### Manual Testing Commands
```bash
# Check current status
node scripts/manual-triggers.js status

# Parse existing transcripts
node scripts/manual-triggers.js parse

# Full pipeline test
node scripts/manual-triggers.js all
```

### Expected Results
1. Sessions with transcript content get parsed into individual messages
2. Session detail pages show chat-like interface
3. Both parsed messages and raw transcript are available
4. No data loss - original transcript content preserved

## Technical Benefits

### Performance
- **Indexed queries** - Messages indexed by sessionId and order
- **Efficient loading** - Only load messages when needed
- **Cascading deletes** - Messages automatically deleted with sessions

### Maintainability
- **Separation of concerns** - Parsing logic isolated in dedicated module
- **Type safety** - Full TypeScript support for Message interface
- **Error handling** - Graceful fallbacks when parsing fails

### Extensibility
- **Role flexibility** - Supports any role names (User, Assistant, System, etc.)
- **Content preservation** - Multi-line messages fully supported
- **Metadata ready** - Easy to add message-level metadata in future

## Migration Notes

### Existing Data
- **No data loss** - Original transcript content preserved
- **Backward compatibility** - Pages work with or without parsed messages
- **Gradual migration** - Can parse transcripts incrementally

### Database Migration
- New Message table created with foreign key constraints
- Existing Session table unchanged (only added relation)
- Index created for efficient message queries

This implementation provides a solid foundation for enhanced conversation analysis and user experience while maintaining full backward compatibility.

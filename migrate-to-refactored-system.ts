import { PrismaClient, ProcessingStage, ProcessingStatus } from '@prisma/client';
import { ProcessingStatusManager } from './lib/processingStatusManager';

const prisma = new PrismaClient();

async function migrateToRefactoredSystem() {
  try {
    console.log('=== MIGRATING TO REFACTORED PROCESSING SYSTEM ===\n');
    
    // Get all existing sessions
    const sessions = await prisma.session.findMany({
      include: {
        import: true,
        messages: true,
        sessionQuestions: true,
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${sessions.length} sessions to migrate...\n`);
    
    let migratedCount = 0;
    
    for (const session of sessions) {
      console.log(`Migrating session ${session.import?.externalSessionId || session.id}...`);
      
      // Initialize processing status for this session
      await ProcessingStatusManager.initializeSession(session.id);
      
      // Determine the current state of each stage based on existing data
      
      // 1. CSV_IMPORT - Always completed if session exists
      await ProcessingStatusManager.completeStage(session.id, ProcessingStage.CSV_IMPORT, {
        migratedFrom: 'existing_session',
        importId: session.importId
      });
      
      // 2. TRANSCRIPT_FETCH - Check if transcript content exists
      if (session.import?.rawTranscriptContent) {
        await ProcessingStatusManager.completeStage(session.id, ProcessingStage.TRANSCRIPT_FETCH, {
          migratedFrom: 'existing_transcript',
          contentLength: session.import.rawTranscriptContent.length
        });
      } else if (!session.import?.fullTranscriptUrl) {
        // No transcript URL - skip this stage
        await ProcessingStatusManager.skipStage(session.id, ProcessingStage.TRANSCRIPT_FETCH, 'No transcript URL in original import');
      } else {
        // Has URL but no content - mark as pending for retry
        console.log(`  - Transcript fetch pending for ${session.import.externalSessionId}`);
      }
      
      // 3. SESSION_CREATION - Check if messages exist
      if (session.messages.length > 0) {
        await ProcessingStatusManager.completeStage(session.id, ProcessingStage.SESSION_CREATION, {
          migratedFrom: 'existing_messages',
          messageCount: session.messages.length
        });
      } else if (session.import?.rawTranscriptContent) {
        // Has transcript but no messages - needs reprocessing
        console.log(`  - Session creation pending for ${session.import.externalSessionId} (has transcript but no messages)`);
      } else {
        // No transcript content - skip or mark as pending based on transcript fetch status
        if (!session.import?.fullTranscriptUrl) {
          await ProcessingStatusManager.skipStage(session.id, ProcessingStage.SESSION_CREATION, 'No transcript content available');
        }
      }
      
      // 4. AI_ANALYSIS - Check if AI fields are populated
      const hasAIAnalysis = session.summary || session.sentiment || session.category || session.language;
      if (hasAIAnalysis) {
        await ProcessingStatusManager.completeStage(session.id, ProcessingStage.AI_ANALYSIS, {
          migratedFrom: 'existing_ai_analysis',
          hasSummary: !!session.summary,
          hasSentiment: !!session.sentiment,
          hasCategory: !!session.category,
          hasLanguage: !!session.language
        });
      } else {
        // No AI analysis - mark as pending if session creation is complete
        if (session.messages.length > 0) {
          console.log(`  - AI analysis pending for ${session.import?.externalSessionId}`);
        }
      }
      
      // 5. QUESTION_EXTRACTION - Check if questions exist
      if (session.sessionQuestions.length > 0) {
        await ProcessingStatusManager.completeStage(session.id, ProcessingStage.QUESTION_EXTRACTION, {
          migratedFrom: 'existing_questions',
          questionCount: session.sessionQuestions.length
        });
      } else {
        // No questions - mark as pending if AI analysis is complete
        if (hasAIAnalysis) {
          console.log(`  - Question extraction pending for ${session.import?.externalSessionId}`);
        }
      }
      
      migratedCount++;
      
      if (migratedCount % 10 === 0) {
        console.log(`  Migrated ${migratedCount}/${sessions.length} sessions...`);
      }
    }
    
    console.log(`\n✓ Successfully migrated ${migratedCount} sessions to the new processing system`);
    
    // Show final status
    console.log('\n=== MIGRATION COMPLETE - FINAL STATUS ===');
    const pipelineStatus = await ProcessingStatusManager.getPipelineStatus();
    
    const stages = ['CSV_IMPORT', 'TRANSCRIPT_FETCH', 'SESSION_CREATION', 'AI_ANALYSIS', 'QUESTION_EXTRACTION'];
    
    for (const stage of stages) {
      const stageData = pipelineStatus.pipeline[stage] || {};
      const pending = stageData.PENDING || 0;
      const completed = stageData.COMPLETED || 0;
      const skipped = stageData.SKIPPED || 0;
      
      console.log(`${stage}: ${completed} completed, ${pending} pending, ${skipped} skipped`);
    }
    
  } catch (error) {
    console.error('Error migrating to refactored system:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateToRefactoredSystem();

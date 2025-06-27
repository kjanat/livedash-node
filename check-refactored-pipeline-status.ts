import { PrismaClient } from '@prisma/client';
import { ProcessingStatusManager } from './lib/processingStatusManager';

const prisma = new PrismaClient();

async function checkRefactoredPipelineStatus() {
  try {
    console.log('=== REFACTORED PIPELINE STATUS ===\n');
    
    // Get pipeline status using the new system
    const pipelineStatus = await ProcessingStatusManager.getPipelineStatus();
    
    console.log(`Total Sessions: ${pipelineStatus.totalSessions}\n`);
    
    // Display status for each stage
    const stages = ['CSV_IMPORT', 'TRANSCRIPT_FETCH', 'SESSION_CREATION', 'AI_ANALYSIS', 'QUESTION_EXTRACTION'];
    
    for (const stage of stages) {
      console.log(`${stage}:`);
      const stageData = pipelineStatus.pipeline[stage] || {};
      
      const pending = stageData.PENDING || 0;
      const inProgress = stageData.IN_PROGRESS || 0;
      const completed = stageData.COMPLETED || 0;
      const failed = stageData.FAILED || 0;
      const skipped = stageData.SKIPPED || 0;
      
      console.log(`  PENDING: ${pending}`);
      console.log(`  IN_PROGRESS: ${inProgress}`);
      console.log(`  COMPLETED: ${completed}`);
      console.log(`  FAILED: ${failed}`);
      console.log(`  SKIPPED: ${skipped}`);
      console.log('');
    }
    
    // Show what needs processing
    console.log('=== WHAT NEEDS PROCESSING ===');
    
    for (const stage of stages) {
      const stageData = pipelineStatus.pipeline[stage] || {};
      const pending = stageData.PENDING || 0;
      const failed = stageData.FAILED || 0;
      
      if (pending > 0 || failed > 0) {
        console.log(`• ${stage}: ${pending} pending, ${failed} failed`);
      }
    }
    
    // Show failed sessions if any
    const failedSessions = await ProcessingStatusManager.getFailedSessions();
    if (failedSessions.length > 0) {
      console.log('\n=== FAILED SESSIONS ===');
      failedSessions.slice(0, 5).forEach(failure => {
        console.log(`  ${failure.session.import?.externalSessionId || failure.sessionId}: ${failure.stage} - ${failure.errorMessage}`);
      });
      
      if (failedSessions.length > 5) {
        console.log(`  ... and ${failedSessions.length - 5} more failed sessions`);
      }
    }
    
    // Show sessions ready for AI processing
    const readyForAI = await ProcessingStatusManager.getSessionsNeedingProcessing('AI_ANALYSIS', 5);
    if (readyForAI.length > 0) {
      console.log('\n=== SESSIONS READY FOR AI PROCESSING ===');
      readyForAI.forEach(status => {
        console.log(`  ${status.session.import?.externalSessionId || status.sessionId} (created: ${status.session.createdAt})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking pipeline status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRefactoredPipelineStatus();

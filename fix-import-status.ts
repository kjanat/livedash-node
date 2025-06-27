import { PrismaClient, ProcessingStage, ProcessingStatus } from '@prisma/client';
import { ProcessingStatusManager } from './lib/processingStatusManager';

const prisma = new PrismaClient();

async function fixProcessingStatus() {
  try {
    console.log('=== FIXING PROCESSING STATUS (REFACTORED SYSTEM) ===\n');
    
    // Check for any failed processing stages that might need retry
    const failedSessions = await ProcessingStatusManager.getFailedSessions();
    
    console.log(`Found ${failedSessions.length} failed processing stages`);
    
    if (failedSessions.length > 0) {
      console.log('\nFailed sessions by stage:');
      const failuresByStage: Record<string, number> = {};
      
      failedSessions.forEach(failure => {
        failuresByStage[failure.stage] = (failuresByStage[failure.stage] || 0) + 1;
      });
      
      Object.entries(failuresByStage).forEach(([stage, count]) => {
        console.log(`  ${stage}: ${count} failures`);
      });
      
      // Show sample failed sessions
      console.log('\nSample failed sessions:');
      failedSessions.slice(0, 5).forEach(failure => {
        console.log(`  ${failure.session.import?.externalSessionId || failure.sessionId}: ${failure.stage} - ${failure.errorMessage}`);
      });
      
      // Ask if user wants to reset failed stages for retry
      console.log('\nTo reset failed stages for retry, you can use:');
      console.log('ProcessingStatusManager.resetStageForRetry(sessionId, stage)');
    }
    
    // Check for sessions that might be stuck in IN_PROGRESS
    const stuckSessions = await prisma.sessionProcessingStatus.findMany({
      where: {
        status: ProcessingStatus.IN_PROGRESS,
        startedAt: {
          lt: new Date(Date.now() - 30 * 60 * 1000) // Started more than 30 minutes ago
        }
      },
      include: {
        session: {
          include: {
            import: true
          }
        }
      }
    });
    
    if (stuckSessions.length > 0) {
      console.log(`\nFound ${stuckSessions.length} sessions stuck in IN_PROGRESS state:`);
      stuckSessions.forEach(stuck => {
        console.log(`  ${stuck.session.import?.externalSessionId || stuck.sessionId}: ${stuck.stage} (started: ${stuck.startedAt})`);
      });
      
      console.log('\nThese sessions may need to be reset to PENDING status for retry.');
    }
    
    // Show current pipeline status
    console.log('\n=== CURRENT PIPELINE STATUS ===');
    const pipelineStatus = await ProcessingStatusManager.getPipelineStatus();
    
    const stages = ['CSV_IMPORT', 'TRANSCRIPT_FETCH', 'SESSION_CREATION', 'AI_ANALYSIS', 'QUESTION_EXTRACTION'];
    
    for (const stage of stages) {
      const stageData = pipelineStatus.pipeline[stage] || {};
      const pending = stageData.PENDING || 0;
      const inProgress = stageData.IN_PROGRESS || 0;
      const completed = stageData.COMPLETED || 0;
      const failed = stageData.FAILED || 0;
      const skipped = stageData.SKIPPED || 0;
      
      console.log(`${stage}: ${completed} completed, ${pending} pending, ${inProgress} in progress, ${failed} failed, ${skipped} skipped`);
    }
    
  } catch (error) {
    console.error('Error fixing processing status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixProcessingStatus();

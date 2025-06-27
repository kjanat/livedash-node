import { PrismaClient } from '@prisma/client';
import { ProcessingStatusManager } from './lib/processingStatusManager';

const prisma = new PrismaClient();

async function debugImportStatus() {
  try {
    console.log('=== DEBUGGING PROCESSING STATUS (REFACTORED SYSTEM) ===\n');
    
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
    
    // Check Sessions vs SessionImports
    console.log('=== SESSION IMPORT RELATIONSHIP ===');
    const sessionsWithImports = await prisma.session.count({
      where: { importId: { not: null } }
    });
    const totalSessions = await prisma.session.count();
    
    console.log(`  Sessions with importId: ${sessionsWithImports}`);
    console.log(`  Total sessions: ${totalSessions}`);
    
    // Show failed sessions if any
    const failedSessions = await ProcessingStatusManager.getFailedSessions();
    if (failedSessions.length > 0) {
      console.log('\n=== FAILED SESSIONS ===');
      failedSessions.slice(0, 10).forEach(failure => {
        console.log(`  ${failure.session.import?.externalSessionId || failure.sessionId}: ${failure.stage} - ${failure.errorMessage}`);
      });
      
      if (failedSessions.length > 10) {
        console.log(`  ... and ${failedSessions.length - 10} more failed sessions`);
      }
    } else {
      console.log('\n✓ No failed sessions found');
    }
    
    // Show what needs processing
    console.log('\n=== WHAT NEEDS PROCESSING ===');
    
    for (const stage of stages) {
      const stageData = pipelineStatus.pipeline[stage] || {};
      const pending = stageData.PENDING || 0;
      const failed = stageData.FAILED || 0;
      
      if (pending > 0 || failed > 0) {
        console.log(`• ${stage}: ${pending} pending, ${failed} failed`);
      }
    }
    
  } catch (error) {
    console.error('Error debugging processing status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugImportStatus();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPipelineStatus() {
  try {
    console.log('=== COMPLETE PIPELINE STATUS ===\n');
    
    // Stage 1: SessionImport status
    console.log('1. SessionImport Status:');
    const importCounts = await prisma.sessionImport.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    const totalImports = await prisma.sessionImport.count();
    console.log(`   Total imports: ${totalImports}`);
    importCounts.forEach(({ status, _count }) => {
      console.log(`   ${status}: ${_count.status}`);
    });
    
    // Stage 2: Session creation status
    console.log('\n2. Session Creation Status:');
    const totalSessions = await prisma.session.count();
    const sessionsWithMessages = await prisma.session.count({
      where: { messages: { some: {} } }
    });
    const sessionsWithoutMessages = await prisma.session.count({
      where: { messages: { none: {} } }
    });
    
    console.log(`   Total sessions: ${totalSessions}`);
    console.log(`   Sessions with messages: ${sessionsWithMessages}`);
    console.log(`   Sessions without messages: ${sessionsWithoutMessages}`);
    
    // Stage 3: AI Processing status
    console.log('\n3. AI Processing Status:');
    const processedSessions = await prisma.session.count({
      where: { processed: true }
    });
    const unprocessedSessions = await prisma.session.count({
      where: { processed: false }
    });
    
    console.log(`   Processed sessions: ${processedSessions}`);
    console.log(`   Unprocessed sessions: ${unprocessedSessions}`);
    
    // Stage 4: Questions extracted
    console.log('\n4. Question Extraction Status:');
    const sessionsWithQuestions = await prisma.session.count({
      where: { sessionQuestions: { some: {} } }
    });
    const totalQuestions = await prisma.question.count();
    
    console.log(`   Sessions with questions: ${sessionsWithQuestions}`);
    console.log(`   Total unique questions: ${totalQuestions}`);
    
    // Show what needs processing
    console.log('\n=== WHAT NEEDS PROCESSING ===');
    
    const queuedImports = await prisma.sessionImport.count({
      where: { status: 'QUEUED' }
    });
    console.log(`• ${queuedImports} SessionImports need import processing`);
    
    const sessionsNeedingAI = await prisma.session.count({
      where: {
        AND: [
          { messages: { some: {} } },
          { processed: false }
        ]
      }
    });
    console.log(`• ${sessionsNeedingAI} Sessions need AI processing`);
    
    // Sample of what's pending
    if (queuedImports > 0) {
      console.log('\nSample queued imports:');
      const sampleImports = await prisma.sessionImport.findMany({
        where: { status: 'QUEUED' },
        select: { externalSessionId: true, createdAt: true },
        take: 5
      });
      sampleImports.forEach(imp => {
        console.log(`   ${imp.externalSessionId} (created: ${imp.createdAt})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking pipeline status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPipelineStatus();

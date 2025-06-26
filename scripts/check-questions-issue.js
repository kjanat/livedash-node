// Check why questions aren't being extracted properly
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkQuestionsIssue() {
  console.log('🔍 INVESTIGATING QUESTIONS EXTRACTION ISSUE\n');

  // Find a session with questions stored
  const sessionWithQuestions = await prisma.session.findFirst({
    where: {
      processed: true,
      questions: { not: null }
    },
    include: { messages: true }
  });

  if (sessionWithQuestions) {
    console.log('📋 SAMPLE SESSION WITH QUESTIONS:');
    console.log('Session ID:', sessionWithQuestions.id);
    console.log('Questions stored:', sessionWithQuestions.questions);
    console.log('Summary:', sessionWithQuestions.summary);
    console.log('Messages count:', sessionWithQuestions.messages.length);

    console.log('\n💬 FIRST FEW MESSAGES:');
    sessionWithQuestions.messages.slice(0, 8).forEach((msg, i) => {
      console.log(`  ${i+1}. [${msg.role}]: ${msg.content.substring(0, 150)}...`);
    });
  }

  // Check sessions marked as invalid data
  const invalidSessions = await prisma.session.count({
    where: {
      processed: true,
      questions: '[]'  // Empty questions array
    }
  });

  console.log(`\n⚠️ SESSIONS WITH EMPTY QUESTIONS: ${invalidSessions}`);

  // Find a session with empty questions to analyze
  const emptyQuestionSession = await prisma.session.findFirst({
    where: {
      processed: true,
      questions: '[]'
    },
    include: { messages: true }
  });

  if (emptyQuestionSession) {
    console.log('\n❌ SAMPLE SESSION WITH EMPTY QUESTIONS:');
    console.log('Session ID:', emptyQuestionSession.id);
    console.log('Questions stored:', emptyQuestionSession.questions);
    console.log('Summary:', emptyQuestionSession.summary);
    console.log('Messages count:', emptyQuestionSession.messages.length);

    console.log('\n💬 MESSAGES FROM EMPTY QUESTION SESSION:');
    emptyQuestionSession.messages.slice(0, 8).forEach((msg, i) => {
      console.log(`  ${i+1}. [${msg.role}]: ${msg.content.substring(0, 150)}...`);
    });
  }

  console.log('\n🤖 CURRENT OPENAI MODEL: gpt-4-turbo');
  console.log('🎯 PROMPT INSTRUCTION: "Max 5 user questions in English"');

  await prisma.$disconnect();
}

checkQuestionsIssue();

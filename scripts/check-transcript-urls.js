// Check sessions for transcript URLs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkTranscriptUrls() {
  const sessions = await prisma.session.findMany({
    where: {
      messages: { none: {} },
    },
    select: {
      id: true,
      fullTranscriptUrl: true,
    }
  });

  const withUrl = sessions.filter(s => s.fullTranscriptUrl);
  const withoutUrl = sessions.filter(s => !s.fullTranscriptUrl);

  console.log(`\n📊 Transcript URL Status for Sessions without Messages:`);
  console.log(`✅ Sessions with transcript URL: ${withUrl.length}`);
  console.log(`❌ Sessions without transcript URL: ${withoutUrl.length}`);

  if (withUrl.length > 0) {
    console.log(`\n🔍 Sample URLs:`);
    withUrl.slice(0, 3).forEach(s => {
      console.log(`   ${s.id}: ${s.fullTranscriptUrl}`);
    });
  }

  await prisma.$disconnect();
}

checkTranscriptUrls();

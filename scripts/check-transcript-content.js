// Script to check what's in the transcript files
// Usage: node scripts/check-transcript-content.js

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function checkTranscriptContent() {
  try {
    // Get a few sessions without messages
    const sessions = await prisma.session.findMany({
      where: {
        AND: [
          { fullTranscriptUrl: { not: null } },
          { messages: { none: {} } },
        ]
      },
      include: { company: true },
      take: 3,
    });

    for (const session of sessions) {
      console.log(`\n📄 Checking session ${session.id}:`);
      console.log(`   URL: ${session.fullTranscriptUrl}`);

      try {
        const authHeader = session.company.csvUsername && session.company.csvPassword
          ? "Basic " + Buffer.from(`${session.company.csvUsername}:${session.company.csvPassword}`).toString("base64")
          : undefined;

        const response = await fetch(session.fullTranscriptUrl, {
          headers: authHeader ? { Authorization: authHeader } : {},
          timeout: 10000,
        });

        if (!response.ok) {
          console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
          continue;
        }

        const content = await response.text();
        console.log(`   📏 Content length: ${content.length} characters`);

        if (content.length === 0) {
          console.log(`   ⚠️  Empty file`);
        } else if (content.length < 100) {
          console.log(`   📝 Full content: "${content}"`);
        } else {
          console.log(`   📝 First 200 chars: "${content.substring(0, 200)}..."`);
        }

        // Check if it matches our expected format
        const lines = content.split('\n').filter(line => line.trim());
        const formatMatches = lines.filter(line =>
          line.match(/^\[([^\]]+)\]\s*([^:]+):\s*(.+)$/)
        );

        console.log(`   🔍 Lines total: ${lines.length}, Format matches: ${formatMatches.length}`);

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTranscriptContent();

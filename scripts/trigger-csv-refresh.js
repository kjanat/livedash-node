// Trigger CSV refresh for all companies
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function triggerCsvRefresh() {
  try {
    console.log('🔄 Triggering CSV refresh for all companies...\n');

    // Get all companies
    const companies = await prisma.company.findMany();

    if (companies.length === 0) {
      console.log('❌ No companies found. Run seed script first.');
      return;
    }

    console.log(`🏢 Found ${companies.length} companies:`);

    for (const company of companies) {
      console.log(`📊 Company: ${company.name} (ID: ${company.id})`);
      console.log(`📥 CSV URL: ${company.csvUrl}`);

      try {
        const response = await fetch('http://localhost:3000/api/admin/refresh-sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId: company.id
          })
        });

        const result = await response.json();

        if (response.ok) {
          console.log(`✅ Successfully imported ${result.imported} sessions for ${company.name}`);
        } else {
          console.log(`❌ Error for ${company.name}: ${result.error}`);
        }
      } catch (error) {
        console.log(`❌ Failed to refresh ${company.name}: ${error.message}`);
      }

      console.log(''); // Empty line for readability
    }

  } catch (error) {
    console.error('❌ Error triggering CSV refresh:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
triggerCsvRefresh();

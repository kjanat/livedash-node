// Simple script to test the manual processing trigger
// Usage: node scripts/manual-trigger-test.js

import fetch from 'node-fetch';

async function testManualTrigger() {
  try {
    console.log('Testing manual processing trigger...');

    const response = await fetch('http://localhost:3000/api/admin/trigger-processing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real scenario, you'd need to include authentication cookies
        // For testing, you might need to login first and copy the session cookie
      },
      body: JSON.stringify({
        batchSize: 5,  // Process max 5 sessions
        maxConcurrency: 3  // Use 3 concurrent workers
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Manual trigger successful:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Manual trigger failed:');
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing manual trigger:', error.message);
  }
}

testManualTrigger();

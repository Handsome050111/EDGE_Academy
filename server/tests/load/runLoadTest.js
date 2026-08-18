const autocannon = require('autocannon');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { setupLoadTestContext } = require('./setupAuth');

async function runBenchmark() {
  console.log('\n===============================================================');
  console.log('🚀 TECHNONEX EDGE ACADEMY - ENTERPRISE LOAD TEST RUNNER');
  console.log('===============================================================\n');

  console.log('⚙️ Initializing test authentication context & seeding test entity...');
  const { user, token, moduleId } = await setupLoadTestContext();
  console.log(`✅ Authenticated test engineer: ${user.email} (${user._id})`);
  console.log(`✅ Target Benchmark Module ID: ${moduleId}\n`);

  const port = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${port}`;

  console.log(`🎯 Target API Base URL: ${baseUrl}`);
  console.log(`👥 Concurrency (Virtual Users): 75 concurrent connections`);
  console.log(`⏱️ Duration: 60 seconds (1 minute sustained load)`);
  console.log(`📊 Scenarios Covered:`);
  console.log(`   1. GET  /api/v1/me/dashboard`);
  console.log(`   2. GET  /api/v1/notifications`);
  console.log(`   3. POST /api/v1/modules/${moduleId}/video-progress`);
  console.log(`   4. POST /api/v1/modules/${moduleId}/quiz/start\n`);

  const requests = [
    {
      method: 'GET',
      path: '/api/v1/me/dashboard',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      method: 'GET',
      path: '/api/v1/notifications',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      method: 'POST',
      path: `/api/v1/modules/${moduleId}/video-progress`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        position_sec: 145,
        percent_watched: 98,
        completed: true,
      }),
    },
    {
      method: 'POST',
      path: `/api/v1/modules/${moduleId}/quiz/start`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  ];

  console.log('⏳ Running load test for 60 seconds... Please wait...\n');

  const instance = autocannon(
    {
      url: baseUrl,
      connections: 75, // Concurrency (50-100 learners)
      duration: 60, // 1 minute
      pipelining: 1,
      requests,
    },
    (err, result) => {
      if (err) {
        console.error('❌ Load test failed with error:', err);
        process.exit(1);
      }

      console.log('\n===============================================================');
      console.log('📈 LOAD TEST EXECUTION RESULTS');
      console.log('===============================================================\n');

      console.log(`Total Requests Sent:    ${result.requests.total.toLocaleString()}`);
      console.log(`Duration:               ${result.duration} seconds`);
      console.log(`Throughput (RPS):       ${result.requests.average.toFixed(2)} req/sec`);
      console.log(`Data Transferred:       ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Errors:                 ${result.errors}`);
      console.log(`Timeouts:               ${result.timeouts}`);
      console.log(`Non-2xx / 3xx Responses:${result.non2xx}\n`);

      console.log('⏱️ LATENCY PERCENTILES (ms):');
      console.log(`  Average Latency:      ${result.latency.average.toFixed(2)} ms`);
      console.log(`  Min Latency:          ${result.latency.min} ms`);
      console.log(`  50th Percentile (p50):${result.latency.p50} ms`);
      console.log(`  90th Percentile (p90):${result.latency.p90} ms`);
      console.log(`  95th Percentile (p95):${result.latency.p95} ms`);
      console.log(`  99th Percentile (p99):${result.latency.p99} ms`);
      console.log(`  Max Latency:          ${result.latency.max} ms\n`);

      console.log('📊 STATUS CODE DISTRIBUTION:');
      console.log(`  2xx (Success):        ${result['2xx'] || 0}`);
      console.log(`  4xx (Client error):   ${result['4xx'] || 0}`);
      console.log(`  5xx (Server error):   ${result['5xx'] || 0}`);

      // Save results to file
      const resultsPath = path.join(__dirname, 'loadTestResults.json');
      fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2));
      console.log(`\n💾 Raw results saved to: ${resultsPath}`);

      if (mongoose.connection.readyState !== 0) {
        mongoose.disconnect();
      }
    }
  );

  autocannon.track(instance, { renderProgressBar: true });
}

runBenchmark().catch((err) => {
  console.error('Fatal error running benchmark:', err);
  process.exit(1);
});

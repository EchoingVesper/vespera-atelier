import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:11434';
const VUS = __ENV.VUS || 10;
const DURATION = __ENV.DURATION || '30s';

// Custom metrics
const errorRate = new Rate('errors');

// Test data
const testPrompt = 'Explain the concept of artificial intelligence in one paragraph';
const testOptions = {
  model: 'llama2',
  temperature: 0.7,
  max_tokens: 100,
};

export const options = {
  stages: [
    // Ramp-up from 1 to VUS users over 30 seconds
    { duration: '30s', target: VUS },
    // Stay at VUS users for the test duration
    { duration: DURATION, target: VUS },
    // Ramp-down to 0 users over 30 seconds
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.1'], // <10% errors
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1s
  },
};

export default function () {
  // Test 1: Generate completion
  const completionRes = http.post(
    `${BASE_URL}/api/generate`,
    JSON.stringify({
      prompt: testPrompt,
      ...testOptions,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  // Check if the request was successful
  const completionSuccess = check(completionRes, {
    'status is 200': (r) => r.status === 200,
    'response has text': (r) => r.json('response') && r.json('response').length > 0,
  });

  // Record error if the check failed
  if (!completionSuccess) {
    errorRate.add(1);
    console.error('Completion request failed:', JSON.stringify(completionRes.body));
  }

  // Test 2: List models
  const modelsRes = http.get(`${BASE_URL}/api/tags`);
  
  const modelsSuccess = check(modelsRes, {
    'status is 200': (r) => r.status === 200,
    'has models array': (r) => Array.isArray(r.json('models')),
  });

  if (!modelsSuccess) {
    errorRate.add(1);
    console.error('Models request failed:', JSON.stringify(modelsRes.body));
  }

  // Add a small delay between iterations
  sleep(1);
}

// This function runs once before the test starts
export function setup() {
  console.log(`Starting load test with ${VUS} VUs for ${DURATION}`);
  console.log(`Testing endpoint: ${BASE_URL}`);
  
  // Optional: Verify the endpoint is reachable
  const healthRes = http.get(`${BASE_URL}/api/version`);
  if (healthRes.status !== 200) {
    throw new Error(`Endpoint not reachable: ${healthRes.status} ${healthRes.body}`);
  }
  
  console.log('Endpoint is reachable, starting test...');
}

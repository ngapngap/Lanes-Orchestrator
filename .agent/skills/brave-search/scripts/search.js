#!/usr/bin/env node
/**
 * Brave Search Script
 *
 * Performs web search using Brave Search API
 * Falls back to mock data if API key not available
 */

const https = require('https');

async function braveSearch(options = {}) {
  const {
    query,
    count = 10,
    freshness = null
  } = options;

  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    console.warn('[WARN] BRAVE_API_KEY not set, returning mock results');
    return {
      results: [
        {
          title: 'Mock Result - Set BRAVE_API_KEY for real results',
          url: 'https://example.com',
          description: 'This is a mock result. Please set BRAVE_API_KEY environment variable.',
          age: 'N/A'
        }
      ],
      query,
      total: 0,
      mock: true
    };
  }

  const params = new URLSearchParams({
    q: query,
    count: count.toString()
  });

  if (freshness) {
    params.append('freshness', freshness);
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.search.brave.com',
      path: `/res/v1/web/search?${params.toString()}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const results = (json.web?.results || []).map(r => ({
            title: r.title,
            url: r.url,
            description: r.description,
            age: r.age || 'Unknown'
          }));
          resolve({
            results,
            query,
            total: json.web?.total || 0
          });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    options[key] = key === 'count' ? parseInt(value) : value;
  }

  if (!options.query) {
    console.error('Usage: node search.js --query "search term" [--count 10] [--freshness week]');
    process.exit(1);
  }

  braveSearch(options)
    .then(results => console.log(JSON.stringify(results, null, 2)))
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { braveSearch };

#!/usr/bin/env node
/**
 * Brave Search MCP Server
 *
 * Model Context Protocol server for web search
 */

const readline = require('readline');
const https = require('https');

const JSONRPC_VERSION = '2.0';
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

const TOOLS = [
  {
    name: 'brave_web_search',
    description: 'Search the web using Brave Search API',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Number of results (default: 10, max: 20)' },
        freshness: { type: 'string', enum: ['day', 'week', 'month', 'year'], description: 'Time filter' }
      },
      required: ['query']
    }
  },
  {
    name: 'brave_news_search',
    description: 'Search news using Brave Search API',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Number of results (default: 10)' }
      },
      required: ['query']
    }
  }
];

// Brave Search API call
const braveSearch = (endpoint, params) => {
  return new Promise((resolve, reject) => {
    if (!BRAVE_API_KEY) {
      reject(new Error('BRAVE_API_KEY not set'));
      return;
    }

    const queryString = new URLSearchParams(params).toString();
    const options = {
      hostname: 'api.search.brave.com',
      path: `/res/v1/${endpoint}/search?${queryString}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': BRAVE_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse response'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
};

const toolHandlers = {
  brave_web_search: async (params) => {
    const { query, count = 10, freshness } = params;
    const searchParams = { q: query, count: Math.min(count, 20) };
    if (freshness) searchParams.freshness = freshness;

    const result = await braveSearch('web', searchParams);

    return (result.web?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age
    }));
  },

  brave_news_search: async (params) => {
    const { query, count = 10 } = params;
    const result = await braveSearch('news', { q: query, count: Math.min(count, 20) });

    return (result.news?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
      source: r.meta_url?.hostname,
      age: r.age
    }));
  }
};

const handleRequest = async (request) => {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'brave-search-mcp-server', version: '1.0.0' }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          result: { tools: TOOLS }
        };

      case 'tools/call':
        const { name, arguments: args } = params;
        if (!toolHandlers[name]) {
          throw new Error(`Unknown tool: ${name}`);
        }
        const result = await toolHandlers[name](args);
        return {
          jsonrpc: JSONRPC_VERSION,
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    return {
      jsonrpc: JSONRPC_VERSION,
      id,
      error: { code: -32000, message: error.message }
    };
  }
};

const main = () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line);
      const response = await handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      console.log(JSON.stringify({
        jsonrpc: JSONRPC_VERSION,
        error: { code: -32700, message: 'Parse error' }
      }));
    }
  });
};

main();

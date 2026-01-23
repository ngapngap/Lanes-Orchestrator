#!/usr/bin/env node
/**
 * GitHub MCP Server
 *
 * Model Context Protocol server for GitHub operations
 */

const readline = require('readline');
const { execSync } = require('child_process');

// MCP Protocol constants
const JSONRPC_VERSION = '2.0';

// Tools available
const TOOLS = [
  {
    name: 'github_search_repos',
    description: 'Search GitHub repositories',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default: 10)' },
        language: { type: 'string', description: 'Filter by language' }
      },
      required: ['query']
    }
  },
  {
    name: 'github_repo_info',
    description: 'Get repository information',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository path (owner/repo)' }
      },
      required: ['repo']
    }
  },
  {
    name: 'github_repo_contents',
    description: 'List repository contents',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository path (owner/repo)' },
        path: { type: 'string', description: 'Path within repo (default: root)' }
      },
      required: ['repo']
    }
  },
  {
    name: 'github_create_issue',
    description: 'Create a GitHub issue',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository path (owner/repo)' },
        title: { type: 'string', description: 'Issue title' },
        body: { type: 'string', description: 'Issue body' }
      },
      required: ['repo', 'title']
    }
  }
];

// Execute gh CLI command
const execGh = (args) => {
  try {
    return execSync(`gh ${args}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) {
    throw new Error(`GitHub CLI error: ${error.message}`);
  }
};

// Tool implementations
const toolHandlers = {
  github_search_repos: (params) => {
    const { query, limit = 10, language } = params;
    let args = `search repos "${query}" --limit ${limit} --json fullName,description,stargazersCount,license,primaryLanguage,updatedAt`;
    if (language) args += ` --language ${language}`;

    const output = execGh(args);
    const repos = JSON.parse(output);

    return repos.map(r => ({
      name: r.fullName,
      description: r.description,
      stars: r.stargazersCount,
      license: r.license?.key || 'Unknown',
      language: r.primaryLanguage?.name || 'Unknown',
      updated: r.updatedAt
    }));
  },

  github_repo_info: (params) => {
    const { repo } = params;
    const output = execGh(`repo view ${repo} --json name,description,defaultBranchRef,licenseInfo,stargazerCount,forkCount,repositoryTopics`);
    return JSON.parse(output);
  },

  github_repo_contents: (params) => {
    const { repo, path = '' } = params;
    const output = execGh(`api repos/${repo}/contents/${path}`);
    return JSON.parse(output);
  },

  github_create_issue: (params) => {
    const { repo, title, body = '' } = params;
    const output = execGh(`issue create --repo ${repo} --title "${title}" --body "${body}"`);
    return { url: output.trim() };
  }
};

// Handle JSON-RPC request
const handleRequest = (request) => {
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
            serverInfo: { name: 'github-mcp-server', version: '1.0.0' }
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
        const result = toolHandlers[name](args);
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

// Main - stdio transport
const main = () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    try {
      const request = JSON.parse(line);
      const response = handleRequest(request);
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

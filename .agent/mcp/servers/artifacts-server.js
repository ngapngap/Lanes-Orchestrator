#!/usr/bin/env node
/**
 * Artifacts MCP Server
 *
 * Model Context Protocol server for managing pipeline artifacts
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const JSONRPC_VERSION = '2.0';

// Find repo root
const findRepoRoot = () => {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'AGENTS.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
};

const REPO_ROOT = findRepoRoot();
const ARTIFACTS_DIR = path.join(REPO_ROOT, 'artifacts', 'runs');

const TOOLS = [
  {
    name: 'artifacts_list_runs',
    description: 'List all pipeline runs',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'artifacts_init_run',
    description: 'Initialize a new pipeline run',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Project slug for run ID' }
      },
      required: ['slug']
    }
  },
  {
    name: 'artifacts_get_status',
    description: 'Get status of a pipeline run',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Run ID' }
      },
      required: ['run_id']
    }
  },
  {
    name: 'artifacts_read',
    description: 'Read an artifact from a run',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Run ID' },
        phase: { type: 'string', enum: ['intake', 'research', 'debate', 'spec', 'design', 'verification'] },
        filename: { type: 'string', description: 'Artifact filename' }
      },
      required: ['run_id', 'phase', 'filename']
    }
  },
  {
    name: 'artifacts_write',
    description: 'Write an artifact to a run',
    inputSchema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Run ID' },
        phase: { type: 'string', enum: ['intake', 'research', 'debate', 'spec', 'design', 'verification'] },
        filename: { type: 'string', description: 'Artifact filename' },
        content: { type: 'string', description: 'File content (JSON string for .json files)' }
      },
      required: ['run_id', 'phase', 'filename', 'content']
    }
  }
];

const PHASE_DIRS = {
  intake: '10_intake',
  research: '20_research',
  debate: '30_debate',
  spec: '40_spec',
  design: '45_design',
  verification: '60_verification'
};

const generateRunId = (slug) => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 5).replace(':', '');
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30);
  return `${date}_${time}_${safeSlug}`;
};

const toolHandlers = {
  artifacts_list_runs: () => {
    if (!fs.existsSync(ARTIFACTS_DIR)) {
      return { runs: [] };
    }
    const runs = fs.readdirSync(ARTIFACTS_DIR)
      .filter(f => fs.statSync(path.join(ARTIFACTS_DIR, f)).isDirectory())
      .sort()
      .reverse();
    return { runs, latest: runs[0] || null };
  },

  artifacts_init_run: (params) => {
    const { slug } = params;
    const runId = generateRunId(slug);
    const runDir = path.join(ARTIFACTS_DIR, runId);

    const dirs = [
      runDir,
      path.join(runDir, '10_intake'),
      path.join(runDir, '20_research'),
      path.join(runDir, '30_debate'),
      path.join(runDir, '40_spec'),
      path.join(runDir, '45_design'),
      path.join(runDir, '50_implementation'),
      path.join(runDir, '60_verification')
    ];

    dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

    return { run_id: runId, path: runDir };
  },

  artifacts_get_status: (params) => {
    const { run_id } = params;
    const runDir = path.join(ARTIFACTS_DIR, run_id);

    if (!fs.existsSync(runDir)) {
      throw new Error(`Run not found: ${run_id}`);
    }

    const status = {};
    Object.entries(PHASE_DIRS).forEach(([phase, dir]) => {
      const phasePath = path.join(runDir, dir);
      if (fs.existsSync(phasePath)) {
        const files = fs.readdirSync(phasePath);
        status[phase] = { complete: files.length > 0, files };
      } else {
        status[phase] = { complete: false, files: [] };
      }
    });

    return { run_id, status };
  },

  artifacts_read: (params) => {
    const { run_id, phase, filename } = params;
    const phaseDir = PHASE_DIRS[phase];
    if (!phaseDir) throw new Error(`Unknown phase: ${phase}`);

    const filePath = path.join(ARTIFACTS_DIR, run_id, phaseDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Artifact not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    return { content, path: filePath };
  },

  artifacts_write: (params) => {
    const { run_id, phase, filename, content } = params;
    const phaseDir = PHASE_DIRS[phase];
    if (!phaseDir) throw new Error(`Unknown phase: ${phase}`);

    const dirPath = path.join(ARTIFACTS_DIR, run_id, phaseDir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, filename);
    fs.writeFileSync(filePath, content, 'utf8');

    return { path: filePath, size: content.length };
  }
};

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
            serverInfo: { name: 'artifacts-mcp-server', version: '1.0.0' }
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

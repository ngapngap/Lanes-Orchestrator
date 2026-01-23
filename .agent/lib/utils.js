/**
 * AI Agent Toolkit - Common Utilities
 *
 * Shared utilities for artifact paths, run management, and schema validation
 */

const fs = require('fs');
const path = require('path');

// Get repo root (works from any script location)
const getRepoRoot = () => {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'AGENTS.md'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error('Could not find repo root (AGENTS.md not found)');
};

const REPO_ROOT = getRepoRoot();
const ARTIFACTS_DIR = path.join(REPO_ROOT, 'artifacts', 'runs');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'schemas');

/**
 * Generate a new run ID
 * Format: YYYYMMDD_HHMM_<slug>
 */
const generateRunId = (slug = 'run') => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 5).replace(':', '');
  const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30);
  return `${date}_${time}_${safeSlug}`;
};

/**
 * Get current run ID from environment or generate new one
 */
const getRunId = (slug) => {
  return process.env.RUN_ID || generateRunId(slug);
};

/**
 * Get the artifacts path for a specific run and phase
 */
const getArtifactPath = (runId, phase) => {
  const phases = {
    'user_request': '00_user_request.md',
    'intake': '10_intake',
    'research': '20_research',
    'debate': '30_debate',
    'spec': '40_spec',
    'design': '45_design',
    'implementation': '50_implementation',
    'verification': '60_verification',
    'deploy': 'deploy'
  };

  const phasePath = phases[phase];
  if (!phasePath) {
    throw new Error(`Unknown phase: ${phase}. Valid: ${Object.keys(phases).join(', ')}`);
  }

  return path.join(ARTIFACTS_DIR, runId, phasePath);
};

/**
 * Ensure run directory structure exists
 */
const initRunDir = (runId) => {
  const runDir = path.join(ARTIFACTS_DIR, runId);

  const dirs = [
    runDir,
    path.join(runDir, '10_intake'),
    path.join(runDir, '20_research'),
    path.join(runDir, '30_debate'),
    path.join(runDir, '40_spec'),
    path.join(runDir, '45_design'),
    path.join(runDir, '50_implementation'),
    path.join(runDir, '50_implementation', 'handoff', 'ui'),
    path.join(runDir, '50_implementation', 'handoff', 'api'),
    path.join(runDir, '50_implementation', 'handoff', 'data'),
    path.join(runDir, '50_implementation', 'handoff', 'qa'),
    path.join(runDir, '50_implementation', 'handoff', 'security'),
    path.join(runDir, '60_verification'),
    path.join(runDir, '60_verification', 'logs')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  return runDir;
};

/**
 * Write artifact to correct location
 */
const writeArtifact = (runId, phase, filename, content) => {
  const phasePath = getArtifactPath(runId, phase);

  if (!fs.existsSync(phasePath)) {
    fs.mkdirSync(phasePath, { recursive: true });
  }

  const filePath = path.join(phasePath, filename);

  if (typeof content === 'object') {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  } else {
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return filePath;
};

/**
 * Read artifact from run
 */
const readArtifact = (runId, phase, filename) => {
  const filePath = path.join(getArtifactPath(runId, phase), filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  if (filename.endsWith('.json')) {
    return JSON.parse(content);
  }

  return content;
};

/**
 * Load JSON schema
 */
const loadSchema = (schemaName) => {
  const schemaPath = path.join(SCHEMAS_DIR, schemaName);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema not found: ${schemaName}`);
  }
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
};

/**
 * Simple schema validation (basic checks)
 */
const validateAgainstSchema = (data, schemaName) => {
  const schema = loadSchema(schemaName);
  const errors = [];

  // Check required fields
  if (schema.required) {
    schema.required.forEach(field => {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Get provenance object for artifacts
 */
const getProvenance = () => ({
  timestamp: new Date().toISOString(),
  commit_hash: getGitCommit(),
  toolkit_version: '1.0.0'
});

/**
 * Get current git commit hash
 */
const getGitCommit = () => {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

/**
 * List all runs
 */
const listRuns = () => {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    return [];
  }
  return fs.readdirSync(ARTIFACTS_DIR)
    .filter(f => fs.statSync(path.join(ARTIFACTS_DIR, f)).isDirectory())
    .sort()
    .reverse();
};

/**
 * Get latest run ID
 */
const getLatestRunId = () => {
  const runs = listRuns();
  return runs.length > 0 ? runs[0] : null;
};

module.exports = {
  REPO_ROOT,
  ARTIFACTS_DIR,
  SCHEMAS_DIR,
  generateRunId,
  getRunId,
  getArtifactPath,
  initRunDir,
  writeArtifact,
  readArtifact,
  loadSchema,
  validateAgainstSchema,
  getProvenance,
  getGitCommit,
  listRuns,
  getLatestRunId
};

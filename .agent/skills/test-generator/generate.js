#!/usr/bin/env node
/**
 * Test Generator Script
 *
 * Generates test files from spec and source code analysis.
 */

const fs = require('fs');
const path = require('path');

// Import utils if available
let utils;
try {
  utils = require('../../lib/utils');
} catch (e) {
  utils = {
    getArtifactPath: (runId, phase) => {
      const phases = {
        'spec': '40_spec',
        'implementation': '50_implementation',
        'verification': '60_verification'
      };
      return path.join(process.cwd(), 'artifacts', 'runs', runId, phases[phase] || phase);
    },
    writeArtifact: (runId, phase, filename, content) => {
      const phasePath = utils.getArtifactPath(runId, phase);
      if (!fs.existsSync(phasePath)) {
        fs.mkdirSync(phasePath, { recursive: true });
      }
      const filePath = path.join(phasePath, filename);
      const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : content;
      fs.writeFileSync(filePath, data, 'utf8');
      return filePath;
    },
    readArtifact: (runId, phase, filename) => {
      const filePath = path.join(utils.getArtifactPath(runId, phase), filename);
      if (!fs.existsSync(filePath)) return null;
      const content = fs.readFileSync(filePath, 'utf8');
      return filename.endsWith('.json') ? JSON.parse(content) : content;
    }
  };
}

// Detect testing framework
function detectFramework(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.jest) return { runner: 'jest', ext: 'test.js' };
    if (deps.vitest) return { runner: 'vitest', ext: 'test.ts' };
    if (deps.mocha) return { runner: 'mocha', ext: 'spec.js' };
    if (deps.pytest) return { runner: 'pytest', ext: '_test.py' };
  }

  // Default to Jest
  return { runner: 'jest', ext: 'test.js' };
}

// Extract functions from JS/TS file
function extractFunctions(content) {
  const functions = [];

  // Match function declarations
  const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    functions.push({ name: match[1], type: 'function' });
  }

  // Match arrow functions assigned to const
  const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    functions.push({ name: match[1], type: 'arrow' });
  }

  // Match class methods
  const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
  while ((match = methodRegex.exec(content)) !== null) {
    if (!['if', 'for', 'while', 'switch', 'catch', 'function'].includes(match[1])) {
      functions.push({ name: match[1], type: 'method' });
    }
  }

  return functions;
}

// Generate unit test for a function
function generateUnitTest(funcName, framework) {
  if (framework.runner === 'jest' || framework.runner === 'vitest') {
    return `
describe('${funcName}', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should execute successfully with valid input', () => {
    // Arrange
    const input = {};

    // Act
    const result = ${funcName}(input);

    // Assert
    expect(result).toBeDefined();
  });

  it('should handle edge case: null input', () => {
    expect(() => ${funcName}(null)).toThrow();
  });

  it('should handle edge case: undefined input', () => {
    expect(() => ${funcName}(undefined)).toThrow();
  });

  it('should handle edge case: empty object', () => {
    const result = ${funcName}({});
    expect(result).toBeDefined();
  });
});
`;
  }

  if (framework.runner === 'mocha') {
    return `
describe('${funcName}', function() {
  beforeEach(function() {
    // Setup
  });

  it('should execute successfully with valid input', function() {
    const input = {};
    const result = ${funcName}(input);
    assert.isDefined(result);
  });

  it('should throw on null input', function() {
    assert.throws(() => ${funcName}(null));
  });
});
`;
  }

  return '';
}

// Generate API integration test
function generateApiTest(endpoint, method, framework) {
  const methodUpper = method.toUpperCase();
  return `
describe('${methodUpper} ${endpoint}', () => {
  it('should return 200 for valid request', async () => {
    const response = await request(app)
      .${method.toLowerCase()}('${endpoint}')
      .send({});

    expect(response.status).toBe(200);
  });

  it('should return 400 for invalid request', async () => {
    const response = await request(app)
      .${method.toLowerCase()}('${endpoint}')
      .send({ invalid: true });

    expect(response.status).toBe(400);
  });

  it('should return 401 for unauthorized request', async () => {
    const response = await request(app)
      .${method.toLowerCase()}('${endpoint}');

    expect(response.status).toBe(401);
  });
});
`;
}

// Process source files and generate tests
function processSourceFiles(srcDir, framework) {
  const tests = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.name === 'node_modules' || entry.name.includes('.test.') || entry.name.includes('.spec.')) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(js|ts|jsx|tsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const functions = extractFunctions(content);

        if (functions.length > 0) {
          const testFile = entry.name.replace(/\.(js|ts|jsx|tsx)$/, `.${framework.ext}`);
          let testContent = `// Auto-generated tests for ${entry.name}\n`;
          testContent += `// Framework: ${framework.runner}\n\n`;

          if (framework.runner === 'jest' || framework.runner === 'vitest') {
            testContent += `const { ${functions.map(f => f.name).join(', ')} } = require('./${entry.name.replace(/\.(js|ts|jsx|tsx)$/, '')}');\n\n`;
          }

          functions.forEach(func => {
            testContent += generateUnitTest(func.name, framework);
          });

          tests.push({
            file: testFile,
            source: fullPath,
            type: 'unit',
            functions: functions.map(f => f.name),
            content: testContent
          });
        }
      }
    }
  }

  walk(srcDir);
  return tests;
}

// Generate from spec
function generateFromSpec(runId, framework) {
  const tests = [];
  const spec = utils.readArtifact(runId, 'spec', 'spec.md');
  const taskBreakdown = utils.readArtifact(runId, 'spec', 'task_breakdown.json');

  if (taskBreakdown && taskBreakdown.tasks) {
    // Generate test for each task's validation
    taskBreakdown.tasks.forEach(task => {
      if (task.validation_cmd) {
        tests.push({
          file: `task_${task.node_id}.${framework.ext}`,
          type: 'validation',
          task_id: task.node_id,
          content: `// Validation test for task: ${task.title || task.node_id}\n// Command: ${task.validation_cmd}\n`
        });
      }
    });
  }

  return tests;
}

function main() {
  const args = process.argv.slice(2);
  const runId = process.env.RUN_ID || args.find(a => a.startsWith('--run-id='))?.split('=')[1];
  const srcPath = args.find(a => a.startsWith('--src='))?.split('=')[1] || 'src';
  const projectRoot = process.cwd();

  console.log('Test Generator starting...');
  console.log(`Project: ${projectRoot}`);
  console.log(`Source: ${srcPath}`);
  if (runId) console.log(`Run ID: ${runId}`);

  const framework = detectFramework(projectRoot);
  console.log(`Framework detected: ${framework.runner}`);

  const allTests = [];

  // Generate from source files
  const srcFullPath = path.join(projectRoot, srcPath);
  if (fs.existsSync(srcFullPath)) {
    const sourceTests = processSourceFiles(srcFullPath, framework);
    allTests.push(...sourceTests);
    console.log(`Generated ${sourceTests.length} test files from source analysis`);
  }

  // Generate from spec if run_id provided
  if (runId) {
    const specTests = generateFromSpec(runId, framework);
    allTests.push(...specTests);
    console.log(`Generated ${specTests.length} test files from spec`);
  }

  // Create manifest
  const manifest = {
    generated_at: new Date().toISOString(),
    run_id: runId || null,
    framework,
    tests: allTests.map(t => ({
      file: t.file,
      type: t.type,
      source: t.source || 'spec',
      functions: t.functions || []
    })),
    total_tests: allTests.reduce((sum, t) => sum + (t.functions?.length || 1) * 4, 0) // Estimate 4 tests per function
  };

  // Write outputs
  if (runId) {
    // Write to artifacts
    const testsDir = path.join(utils.getArtifactPath(runId, 'implementation'), 'tests', 'unit');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    allTests.forEach(test => {
      if (test.content) {
        const testPath = path.join(testsDir, test.file);
        fs.writeFileSync(testPath, test.content, 'utf8');
      }
    });

    utils.writeArtifact(runId, 'verification', 'test.manifest.json', manifest);
    console.log(`\nTest files written to artifacts/runs/${runId}/50_implementation/tests/`);
  } else {
    // Write to project test directory
    const testsDir = path.join(projectRoot, '__tests__');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    allTests.forEach(test => {
      if (test.content) {
        const testPath = path.join(testsDir, test.file);
        fs.writeFileSync(testPath, test.content, 'utf8');
      }
    });

    console.log(`\nTest files written to ${testsDir}`);
  }

  console.log('\nManifest:');
  console.log(JSON.stringify(manifest, null, 2));

  console.log('\nTest generation complete.');
}

main();

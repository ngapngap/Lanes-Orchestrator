#!/usr/bin/env node
/**
 * Code Review Script
 *
 * Performs automated code review with security, quality, and standards checks.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import utils if available
let utils;
try {
  utils = require('../../lib/utils');
} catch (e) {
  // Fallback if utils not available
  utils = {
    getArtifactPath: (runId, phase) => {
      const phases = { 'verification': '60_verification' };
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
    }
  };
}

const SEVERITY = {
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
  INFO: 'info'
};

const CATEGORIES = {
  SECURITY: 'security',
  QUALITY: 'quality',
  PERFORMANCE: 'performance',
  STANDARDS: 'standards',
  TESTS: 'tests'
};

// Security patterns to detect
const SECURITY_PATTERNS = [
  {
    id: 'SEC-001',
    pattern: /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/gi,
    message: 'Potential SQL injection - use parameterized queries',
    severity: SEVERITY.CRITICAL
  },
  {
    id: 'SEC-002',
    pattern: /innerHTML\s*=/gi,
    message: 'Potential XSS vulnerability - use textContent or sanitize input',
    severity: SEVERITY.CRITICAL
  },
  {
    id: 'SEC-003',
    pattern: /eval\s*\(/gi,
    message: 'Avoid eval() - potential code injection',
    severity: SEVERITY.CRITICAL
  },
  {
    id: 'SEC-004',
    pattern: /(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]+['"]/gi,
    message: 'Hardcoded credential detected',
    severity: SEVERITY.CRITICAL
  },
  {
    id: 'SEC-005',
    pattern: /exec(?:Sync)?\s*\([^)]*\$\{/gi,
    message: 'Potential command injection',
    severity: SEVERITY.CRITICAL
  }
];

// Quality patterns
const QUALITY_PATTERNS = [
  {
    id: 'QUAL-001',
    pattern: /console\.log\s*\(/g,
    message: 'Remove console.log before production',
    severity: SEVERITY.MINOR
  },
  {
    id: 'QUAL-002',
    pattern: /TODO|FIXME|HACK|XXX/g,
    message: 'Unresolved TODO/FIXME comment',
    severity: SEVERITY.INFO
  },
  {
    id: 'QUAL-003',
    pattern: /debugger;/g,
    message: 'Remove debugger statement',
    severity: SEVERITY.MAJOR
  }
];

function reviewFile(filePath, issues) {
  if (!fs.existsSync(filePath)) return;

  const ext = path.extname(filePath);
  if (!['.js', '.ts', '.jsx', '.tsx', '.py', '.go'].includes(ext)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Check security patterns
  SECURITY_PATTERNS.forEach(pattern => {
    lines.forEach((line, idx) => {
      if (pattern.pattern.test(line)) {
        issues.push({
          id: pattern.id,
          severity: pattern.severity,
          category: CATEGORIES.SECURITY,
          file: filePath,
          line: idx + 1,
          message: pattern.message,
          code_snippet: line.trim().substring(0, 100)
        });
      }
      // Reset regex lastIndex for global patterns
      pattern.pattern.lastIndex = 0;
    });
  });

  // Check quality patterns
  QUALITY_PATTERNS.forEach(pattern => {
    lines.forEach((line, idx) => {
      if (pattern.pattern.test(line)) {
        issues.push({
          id: pattern.id,
          severity: pattern.severity,
          category: CATEGORIES.QUALITY,
          file: filePath,
          line: idx + 1,
          message: pattern.message,
          code_snippet: line.trim().substring(0, 100)
        });
      }
      pattern.pattern.lastIndex = 0;
    });
  });

  // Check function complexity (simple heuristic)
  const functionMatches = content.match(/function\s+\w+|=>\s*\{|async\s+\(/g);
  if (functionMatches && functionMatches.length > 20) {
    issues.push({
      id: 'QUAL-004',
      severity: SEVERITY.MINOR,
      category: CATEGORIES.QUALITY,
      file: filePath,
      line: 1,
      message: `File has ${functionMatches.length} functions - consider splitting`,
      code_snippet: ''
    });
  }
}

function reviewDirectory(dir, issues, ignore = []) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip ignored patterns
    if (ignore.some(pattern => fullPath.includes(pattern))) continue;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;

    if (entry.isDirectory()) {
      reviewDirectory(fullPath, issues, ignore);
    } else {
      reviewFile(fullPath, issues);
    }
  }
}

function generateReport(issues, runId) {
  const summary = {
    review_id: `rev_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now().toString().slice(-4)}`,
    timestamp: new Date().toISOString(),
    files_reviewed: [...new Set(issues.map(i => i.file))].length,
    issues: {
      critical: issues.filter(i => i.severity === SEVERITY.CRITICAL).length,
      major: issues.filter(i => i.severity === SEVERITY.MAJOR).length,
      minor: issues.filter(i => i.severity === SEVERITY.MINOR).length,
      info: issues.filter(i => i.severity === SEVERITY.INFO).length
    },
    passed: issues.filter(i => i.severity === SEVERITY.CRITICAL || i.severity === SEVERITY.MAJOR).length === 0,
    blocking_issues: issues
      .filter(i => i.severity === SEVERITY.CRITICAL || i.severity === SEVERITY.MAJOR)
      .map(i => i.id)
  };

  // Generate markdown report
  let markdown = `# Code Review Report\n\n`;
  markdown += `**Review ID:** ${summary.review_id}\n`;
  markdown += `**Date:** ${summary.timestamp}\n`;
  markdown += `**Status:** ${summary.passed ? 'PASSED' : 'FAILED'}\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `| Severity | Count |\n|----------|-------|\n`;
  markdown += `| Critical | ${summary.issues.critical} |\n`;
  markdown += `| Major | ${summary.issues.major} |\n`;
  markdown += `| Minor | ${summary.issues.minor} |\n`;
  markdown += `| Info | ${summary.issues.info} |\n\n`;

  if (issues.length > 0) {
    markdown += `## Issues\n\n`;

    const grouped = {};
    issues.forEach(issue => {
      if (!grouped[issue.file]) grouped[issue.file] = [];
      grouped[issue.file].push(issue);
    });

    Object.entries(grouped).forEach(([file, fileIssues]) => {
      markdown += `### ${file}\n\n`;
      fileIssues.forEach(issue => {
        markdown += `- **[${issue.severity.toUpperCase()}]** Line ${issue.line}: ${issue.message}\n`;
        if (issue.code_snippet) {
          markdown += `  \`\`\`\n  ${issue.code_snippet}\n  \`\`\`\n`;
        }
      });
      markdown += '\n';
    });
  }

  return { summary, markdown, issues };
}

function main() {
  const args = process.argv.slice(2);
  const runId = process.env.RUN_ID || args.find(a => a.startsWith('--run-id='))?.split('=')[1];
  const targetPath = args.find(a => a.startsWith('--path='))?.split('=')[1] || process.cwd();

  console.log('Starting code review...');
  console.log(`Target: ${targetPath}`);

  const issues = [];

  if (fs.statSync(targetPath).isDirectory()) {
    reviewDirectory(targetPath, issues, ['node_modules', 'dist', 'build', '.git', 'artifacts']);
  } else {
    reviewFile(targetPath, issues);
  }

  const { summary, markdown } = generateReport(issues, runId);

  // Output to artifacts if run_id provided
  if (runId) {
    utils.writeArtifact(runId, 'verification', 'review.summary.json', summary);
    utils.writeArtifact(runId, 'verification', 'review.issues.json', { issues });
    utils.writeArtifact(runId, 'verification', 'review.md', markdown);
    console.log(`Review artifacts saved to artifacts/runs/${runId}/60_verification/`);
  } else {
    // Output to console
    console.log('\n' + markdown);
  }

  console.log(`\nReview complete: ${summary.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Critical: ${summary.issues.critical}, Major: ${summary.issues.major}, Minor: ${summary.issues.minor}, Info: ${summary.issues.info}`);

  // Exit with error if blocking issues found
  process.exit(summary.passed ? 0 : 1);
}

main();

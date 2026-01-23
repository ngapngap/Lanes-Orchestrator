#!/usr/bin/env node
/**
 * Security Skill Script
 *
 * Security scanning and review
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runSecretScan(targetPath = '.') {
  try {
    execSync(`gitleaks detect --source ${targetPath} --no-git -v`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { status: 'pass', findings: [] };
  } catch (error) {
    if (error.status === 1) {
      return { status: 'fail', findings: error.stdout || 'Secrets detected' };
    }
    // gitleaks not installed
    return { status: 'skipped', reason: 'gitleaks not installed' };
  }
}

function runDependencyAudit(projectPath = '.') {
  const results = { npm: null, pip: null };

  // Try npm audit
  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    try {
      execSync('npm audit --json', { cwd: projectPath, encoding: 'utf8', stdio: 'pipe' });
      results.npm = { status: 'pass' };
    } catch (error) {
      const audit = JSON.parse(error.stdout || '{}');
      const critical = audit.metadata?.vulnerabilities?.critical || 0;
      const high = audit.metadata?.vulnerabilities?.high || 0;
      results.npm = {
        status: critical > 0 || high > 0 ? 'fail' : 'pass',
        critical,
        high,
        moderate: audit.metadata?.vulnerabilities?.moderate || 0
      };
    }
  }

  // Try pip-audit
  if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) {
    try {
      execSync('pip-audit', { cwd: projectPath, encoding: 'utf8', stdio: 'pipe' });
      results.pip = { status: 'pass' };
    } catch (error) {
      results.pip = { status: 'fail', output: error.stdout };
    }
  }

  return results;
}

function generateSecurityReview(scanResults) {
  const { secretScan, depAudit } = scanResults;

  let md = `# Security Review

## Scan Results

| Check | Status | Details |
|-------|--------|---------|
| Secret Scan | ${secretScan?.status || 'skipped'} | ${secretScan?.reason || (secretScan?.status === 'pass' ? 'No secrets found' : 'Secrets detected')} |
| npm Audit | ${depAudit?.npm?.status || 'skipped'} | ${depAudit?.npm ? `Critical: ${depAudit.npm.critical || 0}, High: ${depAudit.npm.high || 0}` : 'N/A'} |
| pip Audit | ${depAudit?.pip?.status || 'skipped'} | ${depAudit?.pip?.status === 'pass' ? 'No issues' : depAudit?.pip?.output || 'N/A'} |

`;

  if (secretScan?.status === 'fail') {
    md += `## Secret Findings
\`\`\`
${secretScan.findings}
\`\`\`

`;
  }

  md += `## Recommendations

### Immediate Actions
`;

  if (secretScan?.status === 'fail') {
    md += `- [ ] Remove or rotate exposed secrets
- [ ] Add secrets to .gitignore
- [ ] Use environment variables instead
`;
  }

  if (depAudit?.npm?.status === 'fail') {
    md += `- [ ] Run \`npm audit fix\` to fix vulnerabilities
- [ ] Review and update outdated packages
`;
  }

  md += `
### Ongoing Security Practices
- [ ] Enable Dependabot alerts
- [ ] Set up pre-commit hooks for secret scanning
- [ ] Regular dependency updates

## License Review
[Run license-checker for full license audit]

`;

  return md;
}

// CLI execution
if (require.main === module) {
  const [,, command, ...args] = process.argv;

  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      options[args[i].replace('--', '')] = args[i + 1];
    }
  }

  const commands = {
    'secret-scan': () => {
      const result = runSecretScan(options.path || '.');
      console.log(JSON.stringify(result, null, 2));
    },
    'dep-audit': () => {
      const result = runDependencyAudit(options.path || '.');
      console.log(JSON.stringify(result, null, 2));
    },
    'review': () => {
      const secretScan = runSecretScan(options.path || '.');
      const depAudit = runDependencyAudit(options.path || '.');
      const review = generateSecurityReview({ secretScan, depAudit });

      if (options.output) {
        fs.writeFileSync(options.output, review);
        console.log(`Security review written to: ${options.output}`);
      } else {
        console.log(review);
      }
    }
  };

  if (!command || !commands[command]) {
    console.log('Usage: node security.js <command> [options]');
    console.log('Commands:');
    console.log('  secret-scan [--path .]  Run secret scanning');
    console.log('  dep-audit [--path .]    Run dependency audit');
    console.log('  review [--output file]  Generate security review');
    process.exit(1);
  }

  commands[command]();
}

module.exports = { runSecretScan, runDependencyAudit, generateSecurityReview };

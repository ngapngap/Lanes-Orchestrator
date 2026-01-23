#!/usr/bin/env node
/**
 * Debug Skill Script
 *
 * Root cause analysis for QA failures
 */

const fs = require('fs');
const path = require('path');

function analyzeFailures(report) {
  const failures = [];

  if (report.commands) {
    report.commands.forEach(cmd => {
      const exitCode = cmd.exitCode !== undefined ? cmd.exitCode : cmd.exit_code;
      if (exitCode !== 0) {
        failures.push({
          command: cmd.name,
          cmd: cmd.cmd,
          exit_code: exitCode,
          logs_path: cmd.logs_path
        });
      }
    });
  }

  return failures;
}

function generateDebugReport(report, analysis = {}) {
  const failures = analyzeFailures(report);

  let md = `# Debug Report

## Run Information
- **Run ID:** ${report.run_id || 'Unknown'}
- **Status:** ${report.status}
- **Timestamp:** ${report.provenance?.timestamp || new Date().toISOString()}

## Failure Summary
${failures.length === 0 ? 'No failures detected.' : `Found ${failures.length} failing command(s).`}

`;

  if (failures.length > 0) {
    md += `## Failed Commands

`;
    failures.forEach((f, i) => {
      md += `### ${i + 1}. ${f.command}
- **Command:** \`${f.cmd}\`
- **Exit Code:** ${f.exit_code}
- **Logs:** ${f.logs_path || 'Not available'}

`;
    });
  }

  md += `## Root Cause Analysis

`;

  if (report.summary?.top_failures) {
    report.summary.top_failures.forEach((failure, i) => {
      md += `### Issue ${i + 1}
- **Symptom:** ${failure}
- **Root cause:** [To be analyzed]
- **Evidence:** [See logs]

`;
    });
  } else {
    md += `### Analysis Pending
Please review the logs and identify root causes.

`;
  }

  md += `## Fix Plan

### Immediate Actions
- [ ] Review failed command logs
- [ ] Identify root cause
- [ ] Implement fix

### Regression Prevention
- [ ] Add test coverage for the failure case
- [ ] Update documentation if needed

## New Tasks (feed back to DAG)
- [ ] [Add specific tasks based on analysis]
`;

  return md;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    options[key] = args[i + 1];
  }

  if (!options.report) {
    console.error('Usage: node debug.js --report path/to/report.json [--output debug_report.md]');
    process.exit(1);
  }

  try {
    const reportPath = path.resolve(options.report);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    const debugReport = generateDebugReport(report);

    if (options.output) {
      fs.writeFileSync(options.output, debugReport);
      console.log(`Debug report written to: ${options.output}`);
    } else {
      console.log(debugReport);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { analyzeFailures, generateDebugReport };

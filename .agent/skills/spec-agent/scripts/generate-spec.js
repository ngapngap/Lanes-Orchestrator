#!/usr/bin/env node
/**
 * Spec Agent - Generate Spec Script
 *
 * Transform debate decisions into spec.md
 */

const fs = require('fs');
const path = require('path');

function generateSpec(debate, intake) {
  const chosen = debate.options.find(o => o.id === debate.decision.chosen_option_id);
  const project = intake.project || {};
  const scope = intake.scope || {};
  const constraints = intake.constraints || {};
  const outline = debate.seed_task_outline || [];

  let md = `# spec.md

## Context

${project.description || intake.goal || 'Project goal not specified'}

**Users:** ${(intake.target_users?.primary ? [intake.target_users.primary] : (intake.users || [])) .join(', ')}

**Constraints:**
- Kind: ${project.kind || project.type || 'unknown'}
- Language: ${project.language || constraints.language || 'unknown'}
- Auth: ${constraints.auth || 'none'}
- DB: ${constraints.db || 'none'}
${(Array.isArray(constraints) ? constraints : []).map(c => `- ${c}`).join('\n')}

---

## Scope

### MVP
${(scope.mvp_features || intake.mvp_scope || []).map(s => `- ${s}`).join('\n')}

### Non-goals
${(scope.out_of_scope || intake.non_goals || []).map(n => `- ${n}`).join('\n')}

---

## Decisions (from debate)

### Recommended Approach
${chosen?.summary || 'Not specified'}

**Rationale:** ${debate.decision.tie_break_reason}

### Key Decisions
${debate.assumptions.map(a => `- ${a}`).join('\n')}

### Reference Repos
${debate.options
  .filter(o => o.id === debate.decision.chosen_option_id)
  .flatMap(o => o.references || [])
  .map(r => `- ${r}`)
  .join('\n') || '- See research.shortlist.json'}

---

## Plan & Milestones

### Milestone 0: Foundation
- Set up project structure
- Configure CI/CD
- Baseline verification

### Milestone 1: Core Features
${outline
  .filter(t => !['qa', 'security'].includes(t.owner_lane))
  .map(t => `- [${t.owner_lane}] ${t.title}`)
  .join('\n') || '- No core tasks'}

### Milestone 2: Verification
${outline
  .filter(t => ['qa', 'security'].includes(t.owner_lane))
  .map(t => `- [${t.owner_lane}] ${t.title}`)
  .join('\n') || '- Standard QA'}

---

## Tasks by Lane

### UI Lane
${outline
  .filter(t => t.owner_lane === 'ui')
  .map(t => `- [ ] ${t.title}
  - Acceptance: ${t.acceptance.join(', ')}`)
  .join('\n') || '- No UI tasks'}

### API Lane
${outline
  .filter(t => t.owner_lane === 'api')
  .map(t => `- [ ] ${t.title}
  - Acceptance: ${t.acceptance.join(', ')}`)
  .join('\n') || '- No API tasks'}

### Data Lane
${outline
  .filter(t => t.owner_lane === 'data')
  .map(t => `- [ ] ${t.title}
  - Acceptance: ${t.acceptance.join(', ')}`)
  .join('\n') || '- No Data tasks'}

### QA Lane
${outline
  .filter(t => t.owner_lane === 'qa')
  .map(t => `- [ ] ${t.title}
  - Acceptance: ${t.acceptance.join(', ')}`)
  .join('\n') || '- Standard QA per qa.md'}

### Security Lane
${outline
  .filter(t => t.owner_lane === 'security')
  .map(t => `- [ ] ${t.title}
  - Acceptance: ${t.acceptance.join(', ')}`)
  .join('\n') || '- Standard security checks'}

---

## Verification

See \`qa.md\` for verification profile and commands.

---

## Open Questions

### Blocking
${debate.open_questions
  .filter((_, i) => i < 2)
  .map(q => `- [ ] ${q}`)
  .join('\n') || '- None'}

### Non-blocking
${debate.open_questions
  .filter((_, i) => i >= 2)
  .map(q => `- ${q}`)
  .join('\n') || '- None'}

---

## Provenance

- **Decision Date:** ${debate.provenance.timestamp}
- **Participants:** ${debate.provenance.participants.join(', ')}
- **Mode:** ${debate.provenance.mode}
`;

  return md;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      options[args[i].replace('--', '')] = args[i + 1];
    }
  }

  if (!options.debate) {
    console.error('Usage: node generate-spec.js --debate path/to/debate.json [--intake path/to/intake.json] [--output spec.md]');
    process.exit(1);
  }

  try {
    const debate = JSON.parse(fs.readFileSync(path.resolve(options.debate), 'utf8'));
    const intake = options.intake
      ? JSON.parse(fs.readFileSync(path.resolve(options.intake), 'utf8'))
      : { goal: '', users: [], constraints: [], mvp_scope: [], non_goals: [] };

    const spec = generateSpec(debate, intake);

    if (options.output) {
      fs.writeFileSync(options.output, spec);
      console.log(`Spec written to: ${options.output}`);
    } else {
      console.log(spec);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { generateSpec };

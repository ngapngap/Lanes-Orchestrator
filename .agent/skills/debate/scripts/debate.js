#!/usr/bin/env node
/**
 * Debate Skill Script
 *
 * Council-style debate for decision making
 */

const fs = require('fs');
const path = require('path');

const ROLES = {
  architectA: {
    name: 'Architect A',
    prompt: 'Propose a practical, proven solution based on the research.'
  },
  architectB: {
    name: 'Architect B',
    prompt: 'Propose an alternative approach that might work better.'
  },
  criticC: {
    name: 'Critic C',
    prompt: 'Identify weaknesses and gaps in both proposals.'
  },
  devilD: {
    name: "Devil's Advocate D",
    prompt: 'Challenge the assumptions being made.'
  },
  lead: {
    name: 'Lead',
    prompt: 'Moderate the discussion and make a final decision.'
  }
};

const SCORING_RUBRIC = {
  criteria: ['constraint_compliance', 'practicality', 'risk_awareness', 'clarity'],
  weights: {
    constraint_compliance: 0.30,
    practicality: 0.25,
    risk_awareness: 0.25,
    clarity: 0.20
  }
};

function createDebateTemplate(options) {
  const { candidates = [], assumptions = [], openQuestions = [] } = options;

  return {
    options: candidates.map((c, i) => ({
      id: `opt_${i + 1}`,
      summary: c.summary || `Option ${i + 1}`,
      pros: c.pros || [],
      cons: c.cons || [],
      estimated_cost: c.effort_estimate || 'M',
      risks: c.risks || []
    })),
    scoring_rubric: SCORING_RUBRIC,
    decision: {
      chosen_option_id: '',
      tie_break_reason: ''
    },
    rejected_options: [],
    disagreements: [],
    seed_task_outline: [],
    assumptions,
    open_questions: openQuestions,
    non_goals: [],
    decision_lock: {
      locked: false,
      change_request_process: 'Change requires rerun Debate + update Spec'
    },
    provenance: {
      mode: 'ide',
      participants: Object.values(ROLES).map(r => r.name),
      model_versions: {},
      timestamp: new Date().toISOString()
    }
  };
}

function generateDecisionMd(debate) {
  const chosen = debate.options.find(o => o.id === debate.decision.chosen_option_id);

  return `# Debate Decision

## Summary
**Chosen Option:** ${chosen?.summary || 'Not decided'}

**Rationale:** ${debate.decision.tie_break_reason}

## Options Considered

${debate.options.map(o => `
### ${o.id}: ${o.summary}
**Pros:**
${o.pros.map(p => `- ${p}`).join('\n')}

**Cons:**
${o.cons.map(c => `- ${c}`).join('\n')}

**Estimated Cost:** ${o.estimated_cost}

**Risks:**
${o.risks.map(r => `- ${r}`).join('\n')}
`).join('\n')}

## Rejected Options
${debate.rejected_options.map(r => `- **${r.id}:** ${r.why}`).join('\n')}

## Seed Task Outline
${debate.seed_task_outline.map(t => `- [${t.owner_lane}] ${t.title}`).join('\n')}

## Assumptions
${debate.assumptions.map(a => `- ${a}`).join('\n')}

## Open Questions
${debate.open_questions.map(q => `- ${q}`).join('\n')}

## Decision Lock
- **Locked:** ${debate.decision_lock.locked}
- **Change Process:** ${debate.decision_lock.change_request_process}
`;
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    options[key] = args[i + 1];
  }

  if (options.input) {
    // Read input and create template
    const inputPath = path.resolve(options.input);
    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    const debate = createDebateTemplate({
      candidates: input.candidates || [],
      assumptions: input.assumptions || [],
      openQuestions: input.open_questions || []
    });

    console.log('Debate template created.');
    console.log('Edit the JSON below and save to 30_debate/debate.inputs_for_spec.json');
    console.log('\n' + JSON.stringify(debate, null, 2));
  } else {
    console.log('Usage: node debate.js --input research.shortlist.json [--mode ide|runner]');
    console.log('\nRoles:');
    Object.entries(ROLES).forEach(([key, role]) => {
      console.log(`  ${role.name}: ${role.prompt}`);
    });
  }
}

module.exports = { createDebateTemplate, generateDecisionMd, ROLES, SCORING_RUBRIC };

#!/usr/bin/env node
/**
 * Spec Agent - Generate Tasks Script
 *
 * Generate task_breakdown.json from debate inputs
 */

const fs = require('fs');
const path = require('path');

function generateTaskBreakdown(debate) {
  const tasks = [];
  const milestones = [];

  // Generate tasks from seed_task_outline
  debate.seed_task_outline.forEach((seed, index) => {
    const nodeId = `${seed.owner_lane}-${String(index + 1).padStart(3, '0')}`;

    tasks.push({
      node_id: nodeId,
      title: seed.title,
      owner_lane: seed.owner_lane,
      depends_on: [],
      parallel_group: index < 2 ? 'foundation' : 'core',
      inputs: ['artifacts/runs/<run_id>/40_spec/spec.md'],
      artifact_out: [`artifacts/runs/<run_id>/50_implementation/handoff/${seed.owner_lane}/README.md`],
      exit_criteria: seed.acceptance,
      validation_cmd: ['npm test'],
      rollback_plan: 'Revert related commits'
    });
  });

  // Set up dependencies (simple sequential for same lane)
  const byLane = {};
  tasks.forEach(t => {
    if (!byLane[t.owner_lane]) byLane[t.owner_lane] = [];
    byLane[t.owner_lane].push(t.node_id);
  });

  tasks.forEach(t => {
    const laneIds = byLane[t.owner_lane];
    const myIndex = laneIds.indexOf(t.node_id);
    if (myIndex > 0) {
      t.depends_on = [laneIds[myIndex - 1]];
    }
  });

  // Create milestones
  const foundationTasks = tasks.filter(t => t.parallel_group === 'foundation').map(t => t.node_id);
  const coreTasks = tasks.filter(t => t.parallel_group === 'core').map(t => t.node_id);

  if (foundationTasks.length > 0) {
    milestones.push({
      id: 'M0',
      title: 'Foundation',
      exit_criteria: ['CI green', 'Baseline tests pass'],
      tasks: foundationTasks
    });
  }

  if (coreTasks.length > 0) {
    milestones.push({
      id: 'M1',
      title: 'Core Features',
      exit_criteria: ['All core acceptance criteria met'],
      tasks: coreTasks
    });
  }

  return {
    milestones,
    tasks,
    provenance: {
      timestamp: new Date().toISOString(),
      commit_hash: '<generated>'
    }
  };
}

function validateDAG(breakdown) {
  const errors = [];
  const nodeIds = new Set(breakdown.tasks.map(t => t.node_id));

  // Check unique node_ids
  if (nodeIds.size !== breakdown.tasks.length) {
    errors.push('Duplicate node_ids found');
  }

  // Check depends_on references
  breakdown.tasks.forEach(t => {
    t.depends_on.forEach(dep => {
      if (!nodeIds.has(dep)) {
        errors.push(`Task ${t.node_id} depends on non-existent task ${dep}`);
      }
    });
  });

  // Check for cycles (simple DFS)
  const visited = new Set();
  const recStack = new Set();

  function hasCycle(nodeId) {
    if (recStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recStack.add(nodeId);

    const task = breakdown.tasks.find(t => t.node_id === nodeId);
    if (task) {
      for (const dep of task.depends_on) {
        if (hasCycle(dep)) return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  breakdown.tasks.forEach(t => {
    if (hasCycle(t.node_id)) {
      errors.push(`Cycle detected involving task ${t.node_id}`);
    }
  });

  return errors;
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
    console.error('Usage: node generate-tasks.js --debate path/to/debate.json [--output task_breakdown.json]');
    process.exit(1);
  }

  try {
    const debate = JSON.parse(fs.readFileSync(path.resolve(options.debate), 'utf8'));
    const breakdown = generateTaskBreakdown(debate);

    // Validate
    const errors = validateDAG(breakdown);
    if (errors.length > 0) {
      console.error('Validation errors:');
      errors.forEach(e => console.error(`  - ${e}`));
      process.exit(1);
    }

    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(breakdown, null, 2));
      console.log(`Task breakdown written to: ${options.output}`);
      console.log(`Tasks: ${breakdown.tasks.length}, Milestones: ${breakdown.milestones.length}`);
    } else {
      console.log(JSON.stringify(breakdown, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { generateTaskBreakdown, validateDAG };

/**
 * Assertion Helpers for Regression Tests
 * DoD vNext Section 6.3
 *
 * Provides assertion functions for validating vibe mode outputs.
 */

/**
 * Evaluate a single assertion against artifacts
 * @param {string} assertion - The assertion expression
 * @param {object} artifacts - Loaded artifacts from vibe run
 * @param {object} expected - Expected values from prompt config
 * @returns {{ passed: boolean, assertion: string, reason?: string }}
 */
const evaluateAssertion = (assertion, artifacts, expected) => {
    const { classify, intake, spec, tasks, decisions, research, dockerCompose, envExample, verification } = artifacts;

    try {
        // Simple equality assertions
        if (assertion.startsWith('classify.')) {
            return evaluateClassifyAssertion(assertion, classify);
        }

        if (assertion.startsWith('intake.')) {
            return evaluateIntakeAssertion(assertion, intake);
        }

        if (assertion.startsWith('tasks.')) {
            return evaluateTasksAssertion(assertion, tasks);
        }

        // Content checks
        if (assertion.startsWith('spec contains')) {
            const match = assertion.match(/spec contains '(.+)'/);
            if (match && spec) {
                const found = spec.includes(match[1]);
                return { passed: found, assertion, reason: found ? null : `'${match[1]}' not found in spec` };
            }
        }

        if (assertion.startsWith('spec does not contain')) {
            const match = assertion.match(/spec does not contain '(.+)'/);
            if (match && spec) {
                const found = !spec.includes(match[1]);
                return { passed: found, assertion, reason: found ? null : `'${match[1]}' found in spec but should not be` };
            }
        }

        if (assertion.startsWith('docker-compose does not contain')) {
            const match = assertion.match(/docker-compose does not contain '(.+)'/);
            if (match) {
                if (!dockerCompose) {
                    return { passed: true, assertion, reason: 'docker-compose.yml does not exist (expected)' };
                }
                const found = !dockerCompose.includes(match[1]);
                return { passed: found, assertion, reason: found ? null : `'${match[1]}' found in docker-compose.yml` };
            }
        }

        if (assertion.startsWith('env.example does not contain')) {
            const match = assertion.match(/env\.example does not contain '(.+)'/);
            if (match) {
                if (!envExample) {
                    return { passed: true, assertion, reason: 'env.example does not exist (expected)' };
                }
                const found = !envExample.includes(match[1]);
                return { passed: found, assertion, reason: found ? null : `'${match[1]}' found in env.example` };
            }
        }

        // Complex assertions with OR
        if (assertion.includes(' OR ')) {
            const parts = assertion.split(' OR ').map(p => p.trim());
            for (const part of parts) {
                const result = evaluateAssertion(part, artifacts, expected);
                if (result.passed) {
                    return { passed: true, assertion };
                }
            }
            return { passed: false, assertion, reason: 'None of the OR conditions passed' };
        }

        // Array assertions with 'in'
        if (assertion.includes(' in [')) {
            const match = assertion.match(/(.+) in \[(.+)\]/);
            if (match) {
                const path = match[1].trim();
                const values = match[2].split(',').map(v => v.trim().replace(/'/g, ''));
                const actual = getNestedValue(artifacts, path);
                const passed = values.includes(actual);
                return { passed, assertion, reason: passed ? null : `${path} = '${actual}', expected one of [${values.join(', ')}]` };
            }
        }

        // Unknown assertion type
        return { passed: false, assertion, reason: 'Unknown assertion format' };

    } catch (e) {
        return { passed: false, assertion, reason: `Error evaluating: ${e.message}` };
    }
};

/**
 * Evaluate classify-related assertions
 */
const evaluateClassifyAssertion = (assertion, classify) => {
    if (!classify) {
        return { passed: false, assertion, reason: 'classify.json not found' };
    }

    // classify.project_kind === 'cli'
    const eqMatch = assertion.match(/classify\.([a-z_]+) === '(.+)'/);
    if (eqMatch) {
        const field = eqMatch[1];
        const expected = eqMatch[2];
        const actual = classify.classification?.[field];
        const passed = actual === expected;
        return { passed, assertion, reason: passed ? null : `classify.${field} = '${actual}', expected '${expected}'` };
    }

    // classify.needs_auth !== 'none'
    const neqMatch = assertion.match(/classify\.([a-z_]+) !== '(.+)'/);
    if (neqMatch) {
        const field = neqMatch[1];
        const notExpected = neqMatch[2];
        const actual = classify.classification?.[field];
        const passed = actual !== notExpected;
        return { passed, assertion, reason: passed ? null : `classify.${field} = '${actual}', should not be '${notExpected}'` };
    }

    return { passed: false, assertion, reason: 'Unknown classify assertion format' };
};

/**
 * Evaluate intake-related assertions
 */
const evaluateIntakeAssertion = (assertion, intake) => {
    if (!intake) {
        return { passed: false, assertion, reason: 'intake.json not found' };
    }

    // intake.constraints.auth === 'none'
    const eqMatch = assertion.match(/intake\.([a-z_.]+) === '(.+)'/);
    if (eqMatch) {
        const path = eqMatch[1];
        const expected = eqMatch[2];
        const actual = getNestedValue(intake, path);
        const passed = actual === expected;
        return { passed, assertion, reason: passed ? null : `intake.${path} = '${actual}', expected '${expected}'` };
    }

    // intake.constraints.auth !== 'none'
    const neqMatch = assertion.match(/intake\.([a-z_.]+) !== '(.+)'/);
    if (neqMatch) {
        const path = neqMatch[1];
        const notExpected = neqMatch[2];
        const actual = getNestedValue(intake, path);
        const passed = actual !== notExpected;
        return { passed, assertion, reason: passed ? null : `intake.${path} = '${actual}', should not be '${notExpected}'` };
    }

    // intake.scope.mvp_features.length >= 2
    const lengthMatch = assertion.match(/intake\.([a-z_.]+)\.length >= (\d+)/);
    if (lengthMatch) {
        const path = lengthMatch[1];
        const minLength = parseInt(lengthMatch[2], 10);
        const arr = getNestedValue(intake, path);
        const actual = Array.isArray(arr) ? arr.length : 0;
        const passed = actual >= minLength;
        return { passed, assertion, reason: passed ? null : `intake.${path}.length = ${actual}, expected >= ${minLength}` };
    }

    return { passed: false, assertion, reason: 'Unknown intake assertion format' };
};

/**
 * Evaluate tasks-related assertions
 */
const evaluateTasksAssertion = (assertion, tasks) => {
    if (!tasks) {
        return { passed: false, assertion, reason: 'task_breakdown.json not found' };
    }

    // tasks.total_tasks > 0
    const gtMatch = assertion.match(/tasks\.([a-z_]+) > (\d+)/);
    if (gtMatch) {
        const field = gtMatch[1];
        const minVal = parseInt(gtMatch[2], 10);
        const actual = tasks[field];
        const passed = actual > minVal;
        return { passed, assertion, reason: passed ? null : `tasks.${field} = ${actual}, expected > ${minVal}` };
    }

    return { passed: false, assertion, reason: 'Unknown tasks assertion format' };
};

/**
 * Get nested value from object using dot notation
 */
const getNestedValue = (obj, path) => {
    // Handle prefixes like 'classify.', 'intake.'
    const cleanPath = path.replace(/^(classify|intake|tasks|decisions)\./, '');
    const parts = cleanPath.split('.');

    let current = obj;

    // Special handling for classify
    if (path.startsWith('classify.') && obj.classify) {
        current = obj.classify.classification || obj.classify;
    } else if (path.startsWith('intake.') && obj.intake) {
        current = obj.intake;
        parts.shift(); // Remove 'intake' prefix if present
    }

    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
    }
    return current;
};

/**
 * Run all assertions for a test
 * @param {string[]} assertions - List of assertion expressions
 * @param {object} artifacts - Loaded artifacts
 * @param {object} expected - Expected values
 * @returns {Array<{ passed: boolean, assertion: string, reason?: string }>}
 */
const runAssertions = (assertions, artifacts, expected) => {
    return assertions.map(assertion => evaluateAssertion(assertion, artifacts, expected));
};

module.exports = { runAssertions, evaluateAssertion, getNestedValue };

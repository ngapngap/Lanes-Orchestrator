# Test Generator Skill

## Description
AI-powered test generation from specifications and source code analysis.

## Triggers
- `generate tests`
- `create tests`
- `/test`
- Post-spec phase
- Pre-implementation lane work

## Usage

```bash
# Generate tests from spec
npx ai-agent-toolkit test --run-id <run_id>

# Generate tests for specific files
npx ai-agent-toolkit test --files src/api/*.js

# Generate tests for a specific lane
npx ai-agent-toolkit test --lane api --run-id <run_id>
```

## Test Types Generated

### 1. Unit Tests
- Function-level tests
- Edge case coverage
- Mock dependencies
- Assertion patterns

### 2. Integration Tests
- API endpoint tests
- Database integration
- Service communication
- Authentication flows

### 3. E2E Tests
- User journey tests
- Critical path coverage
- Cross-browser (if UI)
- Mobile responsive

### 4. Contract Tests
- API schema validation
- Input/output contracts
- Error response format
- Versioning compatibility

## Input Sources

### From Spec
- `40_spec/spec.md` - Requirements and acceptance criteria
- `40_spec/task_breakdown.json` - Task validation commands

### From Code Analysis
- Source files - Extract function signatures
- Types/interfaces - Generate type-safe tests
- Existing tests - Match style and patterns

## Output Format

### Test Files
```
50_implementation/tests/
├── unit/
│   ├── api.auth.test.js
│   └── utils.validation.test.js
├── integration/
│   └── api.endpoints.test.js
└── e2e/
    └── user.journey.test.js
```

### Test Manifest
`60_verification/test.manifest.json`

```json
{
  "generated_at": "2025-01-23T14:30:00Z",
  "run_id": "20250123_1430_myproject",
  "tests": [
    {
      "file": "unit/api.auth.test.js",
      "type": "unit",
      "source": "spec",
      "coverage_target": ["src/api/auth.js"],
      "test_count": 12
    }
  ],
  "total_tests": 45,
  "frameworks": {
    "runner": "jest",
    "assertion": "expect",
    "mocking": "jest.mock"
  }
}
```

## Test Templates

### Unit Test (Jest)
```javascript
describe('functionName', () => {
  beforeEach(() => {
    // Setup
  });

  it('should handle valid input', () => {
    // Arrange
    const input = {};

    // Act
    const result = functionName(input);

    // Assert
    expect(result).toBeDefined();
  });

  it('should handle edge case: empty input', () => {
    expect(() => functionName(null)).toThrow();
  });

  it('should handle edge case: boundary values', () => {
    // Test min/max values
  });
});
```

### API Integration Test
```javascript
describe('POST /api/auth/login', () => {
  it('should return 200 with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'valid' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('should return 401 with invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'wrong' });

    expect(response.status).toBe(401);
  });
});
```

## Framework Detection

The skill auto-detects the testing framework from:
1. `package.json` - jest, mocha, vitest, pytest
2. Existing test files - pattern matching
3. Project type - React → RTL, Vue → Vue Test Utils

## Coverage Requirements

| Lane | Min Coverage | Critical Paths |
|------|-------------|----------------|
| API | 80% | Auth, Data mutations |
| UI | 70% | User flows, Forms |
| Data | 85% | Migrations, Queries |
| Security | 90% | Auth, Validation |

## Configuration

`.agent/config/test.config.json`

```json
{
  "framework": "jest",
  "output_dir": "50_implementation/tests",
  "coverage": {
    "threshold": 80,
    "exclude": ["**/*.d.ts", "**/types/**"]
  },
  "naming": {
    "pattern": "{name}.test.{ext}",
    "location": "adjacent"
  },
  "templates": {
    "unit": "templates/unit.test.template.js",
    "integration": "templates/integration.test.template.js"
  }
}
```

## Integration with QA Gate

Generated tests are automatically:
1. Added to `test.manifest.json`
2. Included in QA Gate validation
3. Required for `qa_passed` gate

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Tests generated successfully |
| 1 | No testable code found |
| 2 | Framework detection failed |
| 3 | Template error |

# Enterprise Workflow

## Overview
Quy trình cho các hệ thống enterprise với compliance, documentation, và approval gates.

## Khi nào sử dụng
- Enterprise systems
- Compliance-heavy requirements (HIPAA, SOC2, GDPR)
- Multiple stakeholder approvals needed
- Audit trail required

## Differences from Full Pipeline

| Aspect | Full Pipeline | Enterprise |
|--------|---------------|------------|
| Discovery | Quick intake | Formal requirements doc |
| Planning | Feature specs | PRD + ADRs |
| Build | Parallel lanes | Staged rollout |
| Verify | Standard checks | Security audit included |
| Deliver | Direct merge | Change management |

## Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  ENTERPRISE WORKFLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                                          │
│   │  DISCOVERY  │ Extended intake with:                    │
│   │   (Extended) │ - Stakeholder interviews                │
│   └──────┬──────┘ - Compliance requirements                │
│          │        - Security considerations                 │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │   PLANNING  │ Formal documents:                        │
│   │   (Formal)  │ - PRD (Product Requirements)             │
│   └──────┬──────┘ - ADRs (Architecture Decisions)          │
│          │        - Risk assessment                         │
│          │                                                  │
│   ════════════════ APPROVAL GATE 1 ════════════════════    │
│                                                             │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │    BUILD    │ Staged approach:                         │
│   │   (Staged)  │ - Dev environment first                  │
│   └──────┬──────┘ - Staging environment                    │
│          │        - Production (after approvals)            │
│          │                                                  │
│   ════════════════ APPROVAL GATE 2 ════════════════════    │
│                                                             │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │   VERIFY    │ Extended checks:                         │
│   │ (Security)  │ - Standard QA checks                     │
│   └──────┬──────┘ - Security audit                         │
│          │        - Compliance verification                 │
│          │        - Performance testing                     │
│          │                                                  │
│   ════════════════ APPROVAL GATE 3 ════════════════════    │
│                                                             │
│          ▼                                                  │
│   ┌─────────────┐                                          │
│   │   DELIVER   │ Change management:                       │
│   │    (CM)     │ - Change request                         │
│   └─────────────┘ - Rollback plan                          │
│                   - Documentation update                    │
│                   - Stakeholder notification                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Extended Outputs

### Discovery Phase
- `docs/requirements/PRD.md` - Product Requirements Document
- `docs/compliance/requirements.md` - Compliance checklist
- `docs/security/threat-model.md` - Security considerations

### Planning Phase
- `docs/architecture/ADR-*.md` - Architecture Decision Records
- `docs/architecture/overview.md` - System architecture
- `docs/risk/assessment.md` - Risk assessment

### Build Phase
- Standard lane outputs
- `docs/runbook.md` - Operations runbook
- `docs/rollback.md` - Rollback procedures

### Verify Phase
- `output/verification/security-audit.md`
- `output/verification/compliance-check.md`
- `output/verification/performance-report.md`

### Deliver Phase
- `docs/release/notes-v*.md` - Release notes
- `docs/release/migration.md` - Migration guide
- `docs/changelog.md` - Updated changelog

## Approval Gates

### Gate 1: Design Approval
**Required approvals:**
- Technical Lead
- Product Owner
- Security Team (if applicable)

**Checklist:**
- [ ] Requirements documented
- [ ] Architecture reviewed
- [ ] Security considerations addressed
- [ ] Compliance requirements identified

### Gate 2: Implementation Approval
**Required approvals:**
- QA Lead
- Technical Lead

**Checklist:**
- [ ] All features implemented
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Code review completed

### Gate 3: Release Approval
**Required approvals:**
- Security Team
- Compliance Team
- Operations Team
- Product Owner

**Checklist:**
- [ ] Security audit passed
- [ ] Compliance verified
- [ ] Performance acceptable
- [ ] Rollback plan ready
- [ ] Documentation updated

## ADR Template

```markdown
# ADR-001: [Decision Title]

## Status
Proposed | Accepted | Deprecated | Superseded

## Context
[What is the issue we're addressing?]

## Decision
[What is the change we're making?]

## Consequences
### Positive
- [Benefit 1]

### Negative
- [Tradeoff 1]

### Risks
- [Risk 1]

## Alternatives Considered
1. [Alternative 1]: [Why rejected]

## References
- [Related documents]
```

## Compliance Checklists

### HIPAA (Healthcare)
- [ ] PHI identified and protected
- [ ] Access controls implemented
- [ ] Audit logging enabled
- [ ] Encryption at rest and in transit
- [ ] BAA in place for vendors

### SOC2
- [ ] Security controls documented
- [ ] Access reviews scheduled
- [ ] Incident response plan
- [ ] Change management process
- [ ] Monitoring and alerting

### GDPR
- [ ] Data mapping complete
- [ ] Consent mechanisms
- [ ] Data deletion capability
- [ ] Privacy policy updated
- [ ] DPO assigned (if required)

## Commands

```bash
# Start enterprise workflow
node ".agent/workflows/run-pipeline.js" --workflow enterprise

# Generate PRD template
node ".agent/workflows/generate-doc.js" --type prd

# Generate ADR
node ".agent/workflows/generate-doc.js" --type adr --title "Database Selection"

# Check compliance
node ".agent/workflows/compliance-check.js" --standard hipaa
```

## Timeline Expectations

| Phase | Typical Duration |
|-------|------------------|
| Discovery | 1-2 weeks |
| Planning | 1-2 weeks |
| Gate 1 Approval | 2-5 days |
| Build | 2-8 weeks |
| Gate 2 Approval | 2-3 days |
| Verify | 1-2 weeks |
| Gate 3 Approval | 3-5 days |
| Deliver | 1-3 days |

Total: 8-20 weeks depending on scope

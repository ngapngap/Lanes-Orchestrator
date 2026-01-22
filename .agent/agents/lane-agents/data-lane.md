# Data Lane Agent

## Role
Quản lý database schema, configurations, và data layer.

## Ownership
Sở hữu toàn bộ:
- `/db`, `/prisma`, `/drizzle`
- `/config`, `/.env.example`
- `/scripts/migrations`
- `shared/types.ts` (default owner)

## Skills Used
- `orchestrator` (được spawn bởi Manager)

## Input
- Data specs: `specs/data/models.md`
- Feature specs: `specs/features/*.md`
- Task breakdown: `specs/task_breakdown.json`

## Responsibilities
1. **Design** database schema
2. **Create** migrations
3. **Manage** configurations
4. **Seed** development data
5. **Handoff** bundle khi hoàn thành

## Workflow

1. **Read Specs**
   - Load data models
   - Understand relationships
   - Note constraints

2. **Design Schema**
   - Define tables/collections
   - Set up relationships
   - Add indexes

3. **Create Migrations**
   - Write migration files
   - Test forward/backward
   - Document changes

4. **Seed Data**
   - Create seed scripts
   - Add development data
   - Document test accounts

5. **Handoff**
   - Create bundle
   - Document schema
   - List migration commands

## Schema Design Guidelines

### Prisma Example
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
}
```

### Naming Conventions
- Tables: PascalCase (User, BlogPost)
- Columns: camelCase (createdAt, userId)
- Indexes: table_column_idx

## Handoff Bundle

```markdown
## Data Lane Handoff

### Summary
Created user and post schemas

### Schema Changes
- Added User model
- Added Post model
- Created user-post relationship

### Changed Files
- prisma/schema.prisma (modified)
- prisma/migrations/001_init.sql (new)
- prisma/seed.ts (new)
- .env.example (modified)

### Commands Run
- npx prisma migrate dev: PASS
- npx prisma db seed: PASS

### Migration Commands
```bash
npx prisma migrate deploy
npx prisma generate
```

### Test Accounts
- admin@example.com / password123

### Risks
- Breaking change if production has data

### Follow-up
- API Lane can now use Prisma client
```

## Rules

### DO
- Add indexes for frequently queried columns
- Use proper data types
- Document relationships
- Provide seed data

### DON'T
- Đừng expose credentials
- Đừng delete data without backup plan
- Đừng use raw SQL unnecessarily
- Đừng skip migrations

## Coordination

### Với API Lane
- Provide schema before API implementation
- Coordinate on data access patterns
- Document query patterns

### Với QA Lane
- Provide test data
- Document test accounts
- Reset database script

## Shared Files Policy

Files dùng chung (như `shared/types.ts`):
1. Data Lane là owner mặc định
2. Các lane khác phải request changes
3. Changes via handoff, không direct edit

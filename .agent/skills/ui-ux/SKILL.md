# Skill: UI-UX

## Mô tả
Skill này giúp **thiết kế UI/UX** có cấu trúc, tạo design system và đảm bảo consistency trong giao diện. Lấy cảm hứng từ [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).

## Khi nào sử dụng
- Có UI phức tạp cần design trước
- User yêu cầu giao diện đẹp/professional
- Cần prototype trước khi code
- Đòi hỏi consistency trong design system

## Core Concepts

### 1. Design System Hierarchy
```
MASTER.md (Global Source of Truth)
    │
    ├── Typography
    ├── Colors
    ├── Spacing
    ├── Components
    └── Patterns
        │
        ▼
pages/*.md (Page-specific overrides)
```

### 2. Multi-Domain Search
Khi nhận request, skill sẽ search song song 5 domains:
1. **Product Type**: SaaS, E-commerce, Dashboard...
2. **UI Style**: Glassmorphism, Bento Grid, Minimal...
3. **Color Scheme**: Industry-specific palettes
4. **Patterns**: Cards, Tables, Forms...
5. **Typography**: Font pairings

### 3. Reasoning Engine
Apply rules theo industry và context để generate consistent design.

## Workflow

### Phase 1: Analyze Request
1. Parse requirements từ intake/spec
2. Identify product category
3. Determine complexity level
4. Check existing design context

### Phase 2: Search & Match
1. Multi-domain parallel search
2. Match reasoning rules
3. Filter anti-patterns
4. Rank by relevance

### Phase 3: Generate Design System
1. Create MASTER.md
2. Define color palette
3. Choose typography
4. Specify components
5. Document patterns

### Phase 4: Page Handoffs
1. Create page-specific overrides
2. Generate component specs
3. Prepare developer handoff

## Output Format

### File: `output/design/MASTER.md`

```markdown
# Design System: [Project Name]

## Overview
- **Industry**: [SaaS/E-commerce/Healthcare/...]
- **Style**: [Glassmorphism/Minimal/Bento/...]
- **Complexity**: [Simple/Medium/Complex]

---

## Color Palette

### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Primary | #3B82F6 | Buttons, CTAs, Links |
| Primary Light | #60A5FA | Hover states |
| Primary Dark | #2563EB | Active states |

### Secondary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Secondary | #6366F1 | Accents, badges |

### Neutral Colors
| Name | Hex | Usage |
|------|-----|-------|
| Background | #FFFFFF | Main background |
| Surface | #F9FAFB | Cards, panels |
| Border | #E5E7EB | Borders, dividers |
| Text Primary | #111827 | Headings, body |
| Text Secondary | #6B7280 | Captions, muted |

### Semantic Colors
| Name | Hex | Usage |
|------|-----|-------|
| Success | #10B981 | Success states |
| Warning | #F59E0B | Warning states |
| Error | #EF4444 | Error states |
| Info | #3B82F6 | Info states |

---

## Typography

### Font Family
- **Headings**: Inter, system-ui, sans-serif
- **Body**: Inter, system-ui, sans-serif
- **Mono**: JetBrains Mono, monospace

### Type Scale
| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 | 36px / 2.25rem | 700 | 1.2 |
| H2 | 30px / 1.875rem | 600 | 1.3 |
| H3 | 24px / 1.5rem | 600 | 1.4 |
| H4 | 20px / 1.25rem | 500 | 1.4 |
| Body | 16px / 1rem | 400 | 1.5 |
| Small | 14px / 0.875rem | 400 | 1.5 |
| Caption | 12px / 0.75rem | 400 | 1.4 |

---

## Spacing

### Base Unit
`4px` (0.25rem)

### Scale
| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight spacing |
| sm | 8px | Component internal |
| md | 16px | Component gaps |
| lg | 24px | Section gaps |
| xl | 32px | Large sections |
| 2xl | 48px | Page margins |

---

## Components

### Buttons
```css
.btn-primary {
  background: var(--primary);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
}

.btn-secondary {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
}

.btn-ghost {
  background: transparent;
  color: var(--text-primary);
}
```

### Cards
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

### Inputs
```css
.input {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
}

.input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}
```

---

## Patterns

### Layout
- Max content width: 1280px
- Sidebar width: 256px
- Header height: 64px

### Grid
- 12 column grid
- Gap: 24px (md) / 32px (lg)

### Responsive Breakpoints
| Name | Value |
|------|-------|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |

---

## Anti-patterns to Avoid

1. **Don't** use more than 3 font weights
2. **Don't** mix rounded and sharp corners
3. **Don't** use pure black (#000000) for text
4. **Don't** rely only on color for meaning (accessibility)
5. **Don't** nest cards more than 2 levels

---

## Accessibility Checklist

- [ ] Contrast ratio >= 4.5:1 for text
- [ ] Focus indicators visible
- [ ] Touch targets >= 44x44px
- [ ] No color-only information
- [ ] Semantic HTML used

---

*Generated by UI-UX Skill | [timestamp]*
```

### File: `output/design/pages/dashboard.md`

```markdown
# Page: Dashboard

## Inherits from: MASTER.md

## Overrides

### Colors
- Background: Use Surface (#F9FAFB) instead of pure white

### Layout
- Sidebar: Fixed left, 256px
- Header: Fixed top, 64px
- Content: Scrollable main area

### Components

#### Stats Card
```jsx
<div className="bg-white rounded-lg p-6 shadow-sm border">
  <p className="text-sm text-gray-500">{label}</p>
  <h3 className="text-2xl font-bold mt-1">{value}</h3>
  <span className="text-green-500 text-sm">{change}</span>
</div>
```

#### Chart Container
- Border radius: 12px
- Padding: 24px
- Background: white

## Wireframe

```
┌─────────────────────────────────────────────┐
│ HEADER (Logo, Search, User)                 │
├─────────┬───────────────────────────────────┤
│         │ Stats Row                         │
│         │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│ SIDEBAR │ │ KPI │ │ KPI │ │ KPI │ │ KPI │  │
│         │ └─────┘ └─────┘ └─────┘ └─────┘  │
│ - Nav   │                                   │
│ - Nav   │ Main Chart                        │
│ - Nav   │ ┌─────────────────────────────┐  │
│         │ │                             │  │
│         │ │                             │  │
│         │ └─────────────────────────────┘  │
│         │                                   │
│         │ Table / Recent Activity           │
│         │ ┌─────────────────────────────┐  │
│         │ │ Row 1                       │  │
│         │ │ Row 2                       │  │
│         │ └─────────────────────────────┘  │
└─────────┴───────────────────────────────────┘
```

---

*Page spec for Dashboard*
```

### File: `output/design/handoff.md`

```markdown
# Developer Handoff

## Design System Files
- `MASTER.md` - Global design tokens
- `pages/*.md` - Page-specific specs

## Quick Reference

### CSS Variables
```css
:root {
  --primary: #3B82F6;
  --background: #FFFFFF;
  --surface: #F9FAFB;
  --border: #E5E7EB;
  --text-primary: #111827;
  --text-secondary: #6B7280;
}
```

### Tailwind Config
```js
colors: {
  primary: '#3B82F6',
  surface: '#F9FAFB',
  // ...
}
```

## Implementation Notes

1. Use `Inter` font from Google Fonts
2. All border-radius should be consistent (0.5rem for buttons, 0.75rem for cards)
3. Use CSS Grid for main layout, Flexbox for components
4. Mobile-first approach

## Resources

- [Figma/Design Link]: TBD
- [Icon Set]: Lucide Icons
- [Font]: Google Fonts Inter

---

*Handoff document for developers*
```

## Industry Reasoning Rules

### SaaS / Dashboard
- Clean, minimal design
- Data-focused layouts
- Blue/Purple color schemes
- Sans-serif typography
- Card-based components

### E-commerce
- Product-focused design
- Strong CTAs
- Warm color accents
- Clear pricing display
- Trust indicators

### Healthcare
- Calming color palette (blues, greens)
- High accessibility standards
- Clean, trustworthy typography
- Privacy-focused UI

### Finance
- Professional, conservative design
- Data tables and charts
- Green/Blue color schemes
- Security indicators

## Style Library

| Style | Description | Use Case |
|-------|-------------|----------|
| **Glassmorphism** | Frosted glass effect | Modern dashboards |
| **Neumorphism** | Soft 3D shadows | Minimal apps |
| **Bento Grid** | Grid-based layout | Portfolios, landing |
| **Dark Mode** | Dark backgrounds | Dev tools, media |
| **Minimal** | Clean, lots of whitespace | SaaS, productivity |
| **Brutalism** | Raw, bold typography | Creative, artistic |

## Lệnh thực thi

```bash
# Generate design system từ intake
node ".agent/skills/ui-ux/scripts/generate-design.js"

# Create page spec
node ".agent/skills/ui-ux/scripts/create-page.js" --name dashboard

# Generate handoff
node ".agent/skills/ui-ux/scripts/generate-handoff.js"

# View design system
node ".agent/skills/ui-ux/scripts/view-design.js"
```

## Quy tắc cho UI/UX Agent

### DO
- Start with MASTER.md trước khi page specs
- Maintain consistency across pages
- Consider accessibility từ đầu
- Provide Tailwind/CSS snippets

### DON'T
- Đừng tạo quá nhiều variations
- Đừng bỏ qua mobile responsive
- Đừng dùng color-only indicators
- Đừng mix nhiều design styles

## Integration

### Input từ
- **Intake Skill** - Product type, user context
- **Research Skill** - Design patterns from similar products
- **Spec-Kit** - Feature requirements

### Output cho
- **Lane Agents** - UI Lane uses design/MASTER.md
- **QA-Gate** - Verify accessibility compliance
- **Developers** - handoff.md with implementation details

## Tham khảo
- [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- [Tailwind CSS](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

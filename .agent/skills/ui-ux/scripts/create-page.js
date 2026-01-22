#!/usr/bin/env node
/**
 * Create Page Script
 * Tạo page-specific design spec
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../../../output/design');
const PAGES_DIR = path.join(OUTPUT_DIR, 'pages');

// Ensure directories exist
if (!fs.existsSync(PAGES_DIR)) {
    fs.mkdirSync(PAGES_DIR, { recursive: true });
}

// Page templates
const TEMPLATES = {
    dashboard: `# Page: Dashboard

## Inherits from: MASTER.md

## Layout

\`\`\`
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
│         │ Table / Activity                  │
└─────────┴───────────────────────────────────┘
\`\`\`

## Overrides

### Layout
- Sidebar: Fixed left, 256px wide
- Header: Fixed top, 64px height
- Content: Scrollable, padding 24px

### Components

#### Stats Card
\`\`\`jsx
<div className="bg-white rounded-lg p-6 shadow-sm border">
  <p className="text-sm text-gray-500">{label}</p>
  <h3 className="text-2xl font-bold mt-1">{value}</h3>
  <span className="text-green-500 text-sm">+{change}%</span>
</div>
\`\`\`

#### Chart Container
- Background: white
- Border radius: 12px
- Padding: 24px
- Shadow: sm

#### Data Table
- Striped rows
- Sticky header
- Sortable columns

---

*Page spec for Dashboard*
`,

    landing: `# Page: Landing

## Inherits from: MASTER.md

## Layout

\`\`\`
┌─────────────────────────────────────────────┐
│ NAVBAR (Logo, Links, CTA)                   │
├─────────────────────────────────────────────┤
│                                             │
│              HERO SECTION                   │
│         Headline + Subheadline              │
│            [Primary CTA]                    │
│                                             │
├─────────────────────────────────────────────┤
│         FEATURES (3-4 cards)                │
│   ┌─────┐    ┌─────┐    ┌─────┐           │
│   │     │    │     │    │     │           │
│   └─────┘    └─────┘    └─────┘           │
├─────────────────────────────────────────────┤
│              TESTIMONIALS                   │
├─────────────────────────────────────────────┤
│              PRICING                        │
├─────────────────────────────────────────────┤
│              FOOTER                         │
└─────────────────────────────────────────────┘
\`\`\`

## Overrides

### Hero
- Height: 100vh or 80vh
- Centered content
- Gradient or image background

### Features
- Grid: 3 columns (desktop), 1 column (mobile)
- Card hover effect
- Icon + Title + Description

### CTA Buttons
- Primary: Filled, larger padding
- Secondary: Outlined

---

*Page spec for Landing*
`,

    settings: `# Page: Settings

## Inherits from: MASTER.md

## Layout

\`\`\`
┌─────────────────────────────────────────────┐
│ HEADER (Back, Title, Save)                  │
├─────────────────────────────────────────────┤
│                                             │
│   ┌─────────┐  ┌────────────────────────┐  │
│   │ Tab Nav │  │ Settings Form          │  │
│   │         │  │                        │  │
│   │ Profile │  │ Form Field 1           │  │
│   │ Account │  │ Form Field 2           │  │
│   │ Notif.  │  │ Form Field 3           │  │
│   │ Privacy │  │                        │  │
│   │         │  │ [Save Changes]         │  │
│   └─────────┘  └────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
\`\`\`

## Overrides

### Layout
- Two column: Tab nav (200px) + Content
- Form max-width: 600px

### Components

#### Section Header
\`\`\`jsx
<div className="border-b pb-4 mb-6">
  <h2 className="text-lg font-semibold">{title}</h2>
  <p className="text-sm text-gray-500">{description}</p>
</div>
\`\`\`

#### Form Fields
- Label above input
- Helper text below
- Error state with red border

---

*Page spec for Settings*
`,

    auth: `# Page: Auth (Login/Register)

## Inherits from: MASTER.md

## Layout

\`\`\`
┌─────────────────────────────────────────────┐
│                                             │
│     ┌─────────────────────────────────┐    │
│     │           LOGO                   │    │
│     │                                  │    │
│     │     Login / Register Form        │    │
│     │                                  │    │
│     │     [Email]                      │    │
│     │     [Password]                   │    │
│     │                                  │    │
│     │     [Primary Button]             │    │
│     │                                  │    │
│     │     Or continue with             │    │
│     │     [Google] [GitHub]            │    │
│     │                                  │    │
│     │     Already have account?        │    │
│     └─────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
\`\`\`

## Overrides

### Layout
- Centered card
- Card max-width: 400px
- Optional: split layout with image

### Form
- Clear validation states
- Password visibility toggle
- Social login options

---

*Page spec for Auth*
`
};

// Main function
const createPage = (pageName) => {
    if (!pageName) {
        console.log('Usage: node create-page.js --name [page-name]');
        console.log('\nAvailable templates:');
        console.log('  - dashboard');
        console.log('  - landing');
        console.log('  - settings');
        console.log('  - auth');
        console.log('\nOr use any name to create a blank template.');
        return;
    }

    const template = TEMPLATES[pageName.toLowerCase()];
    const content = template || `# Page: ${pageName}

## Inherits from: MASTER.md

## Layout

\`\`\`
┌─────────────────────────────────────────────┐
│                                             │
│              [Layout here]                  │
│                                             │
└─────────────────────────────────────────────┘
\`\`\`

## Overrides

### Layout
- [Define layout overrides]

### Components
- [Define component overrides]

---

*Page spec for ${pageName}*
`;

    const filePath = path.join(PAGES_DIR, `${pageName.toLowerCase()}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[OK] Created page spec: ${filePath}`);
};

// Parse args
const args = process.argv.slice(2);
let pageName = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) {
        pageName = args[i + 1];
    }
}

createPage(pageName);

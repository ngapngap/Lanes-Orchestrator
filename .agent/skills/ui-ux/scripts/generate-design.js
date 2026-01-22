#!/usr/bin/env node
/**
 * Generate Design System Script
 * Tạo design system từ intake context
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../../../output/design');
const INTAKE_FILE = path.resolve(__dirname, '../../../../output/intake/intake.md');
const MASTER_FILE = path.join(OUTPUT_DIR, 'MASTER.md');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(OUTPUT_DIR, 'pages'))) {
    fs.mkdirSync(path.join(OUTPUT_DIR, 'pages'), { recursive: true });
}

// Industry color palettes
const PALETTES = {
    saas: {
        primary: '#3B82F6',
        primaryLight: '#60A5FA',
        primaryDark: '#2563EB',
        secondary: '#6366F1',
        background: '#FFFFFF',
        surface: '#F9FAFB',
        border: '#E5E7EB',
        textPrimary: '#111827',
        textSecondary: '#6B7280'
    },
    ecommerce: {
        primary: '#F97316',
        primaryLight: '#FB923C',
        primaryDark: '#EA580C',
        secondary: '#0EA5E9',
        background: '#FFFFFF',
        surface: '#FAFAFA',
        border: '#E5E5E5',
        textPrimary: '#171717',
        textSecondary: '#737373'
    },
    healthcare: {
        primary: '#10B981',
        primaryLight: '#34D399',
        primaryDark: '#059669',
        secondary: '#3B82F6',
        background: '#FFFFFF',
        surface: '#F0FDF4',
        border: '#D1FAE5',
        textPrimary: '#064E3B',
        textSecondary: '#6B7280'
    },
    finance: {
        primary: '#1D4ED8',
        primaryLight: '#3B82F6',
        primaryDark: '#1E40AF',
        secondary: '#10B981',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        border: '#E2E8F0',
        textPrimary: '#0F172A',
        textSecondary: '#64748B'
    },
    creative: {
        primary: '#8B5CF6',
        primaryLight: '#A78BFA',
        primaryDark: '#7C3AED',
        secondary: '#EC4899',
        background: '#FFFFFF',
        surface: '#FAF5FF',
        border: '#E9D5FF',
        textPrimary: '#1F2937',
        textSecondary: '#6B7280'
    }
};

// Styles
const STYLES = {
    minimal: {
        borderRadius: '0.5rem',
        shadow: '0 1px 3px rgba(0,0,0,0.1)',
        transition: '150ms ease'
    },
    glassmorphism: {
        borderRadius: '1rem',
        shadow: '0 8px 32px rgba(0,0,0,0.1)',
        backdrop: 'blur(10px)',
        transition: '200ms ease'
    },
    bento: {
        borderRadius: '1.5rem',
        shadow: '0 4px 6px rgba(0,0,0,0.05)',
        transition: '200ms ease'
    }
};

// Detect industry from intake
const detectIndustry = (intakeContent) => {
    const lower = intakeContent.toLowerCase();
    if (lower.includes('healthcare') || lower.includes('medical') || lower.includes('health')) return 'healthcare';
    if (lower.includes('finance') || lower.includes('bank') || lower.includes('payment')) return 'finance';
    if (lower.includes('ecommerce') || lower.includes('shop') || lower.includes('store')) return 'ecommerce';
    if (lower.includes('creative') || lower.includes('portfolio') || lower.includes('agency')) return 'creative';
    return 'saas'; // default
};

// Detect style from intake
const detectStyle = (intakeContent) => {
    const lower = intakeContent.toLowerCase();
    if (lower.includes('glass') || lower.includes('modern')) return 'glassmorphism';
    if (lower.includes('bento') || lower.includes('grid')) return 'bento';
    return 'minimal'; // default
};

// Generate MASTER.md
const generateMaster = (options = {}) => {
    const industry = options.industry || 'saas';
    const style = options.style || 'minimal';
    const projectName = options.projectName || 'Project';

    const palette = PALETTES[industry] || PALETTES.saas;
    const styleConfig = STYLES[style] || STYLES.minimal;

    const timestamp = new Date().toISOString();

    return `# Design System: ${projectName}

## Overview
- **Industry**: ${industry.charAt(0).toUpperCase() + industry.slice(1)}
- **Style**: ${style.charAt(0).toUpperCase() + style.slice(1)}
- **Generated**: ${timestamp}

---

## Color Palette

### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Primary | ${palette.primary} | Buttons, CTAs, Links |
| Primary Light | ${palette.primaryLight} | Hover states |
| Primary Dark | ${palette.primaryDark} | Active states |

### Secondary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Secondary | ${palette.secondary} | Accents, badges |

### Neutral Colors
| Name | Hex | Usage |
|------|-----|-------|
| Background | ${palette.background} | Main background |
| Surface | ${palette.surface} | Cards, panels |
| Border | ${palette.border} | Borders, dividers |
| Text Primary | ${palette.textPrimary} | Headings, body |
| Text Secondary | ${palette.textSecondary} | Captions, muted |

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

### Base Unit: 4px (0.25rem)

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

### Style Tokens
\`\`\`css
--radius: ${styleConfig.borderRadius};
--shadow: ${styleConfig.shadow};
--transition: ${styleConfig.transition};
\`\`\`

### Buttons
\`\`\`css
.btn-primary {
  background: var(--primary);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  font-weight: 500;
  transition: var(--transition);
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-secondary {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
}

.btn-ghost {
  background: transparent;
  color: var(--text-primary);
  padding: 0.5rem 1rem;
}
\`\`\`

### Cards
\`\`\`css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow);
}
\`\`\`

### Inputs
\`\`\`css
.input {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  transition: var(--transition);
}

.input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
  outline: none;
}
\`\`\`

---

## Layout Patterns

### Container
- Max width: 1280px
- Padding: 1rem (mobile) / 2rem (desktop)

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
4. **Don't** rely only on color for meaning
5. **Don't** nest cards more than 2 levels

---

## Accessibility Checklist

- [ ] Contrast ratio >= 4.5:1 for text
- [ ] Focus indicators visible
- [ ] Touch targets >= 44x44px
- [ ] No color-only information
- [ ] Semantic HTML used

---

## CSS Variables

\`\`\`css
:root {
  /* Colors */
  --primary: ${palette.primary};
  --primary-light: ${palette.primaryLight};
  --primary-dark: ${palette.primaryDark};
  --secondary: ${palette.secondary};
  --background: ${palette.background};
  --surface: ${palette.surface};
  --border: ${palette.border};
  --text-primary: ${palette.textPrimary};
  --text-secondary: ${palette.textSecondary};
  --success: #10B981;
  --warning: #F59E0B;
  --error: #EF4444;
  --info: #3B82F6;

  /* Style */
  --radius: ${styleConfig.borderRadius};
  --shadow: ${styleConfig.shadow};
  --transition: ${styleConfig.transition};
}
\`\`\`

---

## Tailwind Config (if using Tailwind)

\`\`\`js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '${palette.primary}',
          light: '${palette.primaryLight}',
          dark: '${palette.primaryDark}',
        },
        secondary: '${palette.secondary}',
        surface: '${palette.surface}',
      },
      borderRadius: {
        DEFAULT: '${styleConfig.borderRadius}',
      },
    },
  },
};
\`\`\`

---

*Generated by UI-UX Skill | ${timestamp}*
`;
};

// Main function
const generateDesign = () => {
    console.log('\n========================================');
    console.log('   DESIGN SYSTEM GENERATOR');
    console.log('========================================\n');

    // Read intake if exists
    let intakeContent = '';
    let projectName = 'Project';

    if (fs.existsSync(INTAKE_FILE)) {
        intakeContent = fs.readFileSync(INTAKE_FILE, 'utf8');
        const nameMatch = intakeContent.match(/# Intake:\s+(.+)/);
        if (nameMatch) projectName = nameMatch[1];
        console.log(`[INFO] Found intake: ${projectName}`);
    } else {
        console.log('[INFO] No intake found, using defaults');
    }

    // Detect settings
    const industry = detectIndustry(intakeContent);
    const style = detectStyle(intakeContent);

    console.log(`[INFO] Industry: ${industry}`);
    console.log(`[INFO] Style: ${style}\n`);

    // Generate
    const content = generateMaster({
        industry,
        style,
        projectName
    });

    fs.writeFileSync(MASTER_FILE, content, 'utf8');
    console.log(`[OK] Design system saved to: ${MASTER_FILE}`);
    console.log('\nNext steps:');
    console.log('  1. Review MASTER.md');
    console.log('  2. Create page specs with create-page.js');
    console.log('  3. Generate handoff with generate-handoff.js');
};

generateDesign();

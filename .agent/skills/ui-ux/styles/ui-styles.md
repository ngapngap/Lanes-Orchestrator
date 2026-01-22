# UI Styles Reference

## 1. Minimal / Clean
**Description**: Simple, lots of whitespace, focus on content
**Best for**: SaaS, Productivity apps, Documentation

```css
.minimal {
  --radius: 0.5rem;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
  --spacing: 1.5rem;
}
```

---

## 2. Glassmorphism
**Description**: Frosted glass effect with blur
**Best for**: Modern dashboards, iOS-style apps

```css
.glass {
  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 1rem;
}
```

---

## 3. Neumorphism
**Description**: Soft, extruded 3D effect
**Best for**: Calculators, minimal apps (use sparingly)

```css
.neumorphic {
  background: #e0e0e0;
  box-shadow:
    8px 8px 16px #bebebe,
    -8px -8px 16px #ffffff;
  border-radius: 1rem;
}
```

---

## 4. Bento Grid
**Description**: Asymmetric grid layout with rounded cards
**Best for**: Portfolios, Landing pages, Feature showcases

```css
.bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.bento-card {
  border-radius: 1.5rem;
  padding: 2rem;
}

.bento-large { grid-column: span 2; grid-row: span 2; }
.bento-wide { grid-column: span 2; }
.bento-tall { grid-row: span 2; }
```

---

## 5. Dark Mode
**Description**: Dark backgrounds with light text
**Best for**: Dev tools, Media apps, Night-time use

```css
.dark {
  --background: #0f172a;
  --surface: #1e293b;
  --border: #334155;
  --text: #f1f5f9;
  --text-muted: #94a3b8;
}
```

---

## 6. Brutalism
**Description**: Raw, bold, unconventional
**Best for**: Creative agencies, Artistic projects

```css
.brutalist {
  border: 3px solid black;
  box-shadow: 5px 5px 0 black;
  font-family: 'IBM Plex Mono', monospace;
}
```

---

## 7. Gradient
**Description**: Colorful gradients as accents
**Best for**: SaaS, Marketing sites, Modern apps

```css
.gradient-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.gradient-sunset {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.gradient-ocean {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}
```

---

## 8. Flat Design
**Description**: No shadows, solid colors, simple shapes
**Best for**: Mobile apps, System interfaces

```css
.flat {
  box-shadow: none;
  border: 2px solid var(--border);
  border-radius: 0.25rem;
}
```

---

## Style Selection Guide

| Use Case | Recommended Style |
|----------|-------------------|
| B2B SaaS | Minimal, Flat |
| Consumer App | Glassmorphism, Gradient |
| Portfolio | Bento, Brutalism |
| Developer Tool | Dark Mode, Minimal |
| Marketing Site | Gradient, Bento |
| Healthcare | Minimal, Flat |
| Finance | Minimal, Flat |

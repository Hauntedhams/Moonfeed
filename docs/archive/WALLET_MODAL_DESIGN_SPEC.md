# 🎨 Wallet Modal - Visual Design Specification

## Design System Alignment

The Wallet Modal now follows the same design patterns as the app's card sections.

## Color System

### Primary Colors
```css
Primary Blue:     #667eea    /* Headers, links, primary actions */
Secondary Purple: #764ba2    /* Hover states, gradients */
Cyan Accent:      #4fc3f7    /* Borders, highlights (rgb: 79, 195, 247) */
```

### Status Colors
```css
Success Green:    #10b981    /* Positive values, profits */
Error Red:        #ef4444    /* Negative values, losses */
Warning:          #f59e0b    /* Alerts, cautions */
```

### Background Colors
```css
Modal Base:       #ffffff    /* Pure white */
Header:           linear-gradient(135deg, rgba(79, 195, 247, 0.08) 0%, rgba(103, 126, 234, 0.08) 100%)
Card Background:  linear-gradient(135deg, rgba(79, 195, 247, 0.05) 0%, rgba(103, 126, 234, 0.05) 100%)
Card Hover:       linear-gradient(135deg, rgba(79, 195, 247, 0.08) 0%, rgba(103, 126, 234, 0.08) 100%)
```

### Border Colors
```css
Default:          rgba(79, 195, 247, 0.2)
Hover:            rgba(79, 195, 247, 0.4)
Strong:           rgba(79, 195, 247, 0.3)
```

### Text Colors
```css
Primary:          rgba(0, 0, 0, 0.9)
Secondary:        rgba(0, 0, 0, 0.8)
Label:            rgba(0, 0, 0, 0.5)
Disabled:         rgba(0, 0, 0, 0.4)
```

## Typography

### Header
```css
Font Size:        1.3rem (20.8px)
Font Weight:      700 (bold)
Color:            #667eea
```

### Section Headings
```css
Font Size:        1rem (16px)
Font Weight:      700 (bold)
Color:            #667eea
Text Transform:   uppercase
Letter Spacing:   0.5px
```

### Stat Labels
```css
Font Size:        11px
Font Weight:      600 (semi-bold)
Color:            rgba(0, 0, 0, 0.5)
Text Transform:   uppercase
Letter Spacing:   0.5px
```

### Stat Values
```css
Font Size:        18px
Font Weight:      700 (bold)
Color:            rgba(0, 0, 0, 0.9)
Special:          Positive (#10b981), Negative (#ef4444)
```

### Wallet Address
```css
Font Family:      'Monaco', 'Courier New', monospace
Font Size:        13px
Font Weight:      600
Color:            #667eea
```

## Spacing

### Modal
```css
Padding:          20px (backdrop)
Max Width:        900px
Max Height:       85vh
```

### Header
```css
Padding:          20px 24px
```

### Content
```css
Padding:          24px
```

### Sections
```css
Margin Bottom:    28px
```

### Cards
```css
Padding:          16px
Gap (grid):       16px
```

## Border Radius

```css
Modal:            12px
Cards:            12px
Close Button:     50% (circle)
Info Box:         12px
```

## Shadows

### Modal
```css
Box Shadow:       0 8px 32px rgba(0, 0, 0, 0.3)
```

### Cards (Hover)
```css
Box Shadow:       0 4px 12px rgba(79, 195, 247, 0.15)
```

### Buttons (Hover)
```css
Box Shadow:       0 6px 16px rgba(102, 126, 234, 0.4)
```

## Animations

### Modal Entry
```css
Duration:         0.3s
Easing:           ease-out
Effect:           slideUp + fadeIn
Transform:        translateY(30px) → translateY(0)
```

### Backdrop
```css
Duration:         0.2s
Easing:           ease-out
Effect:           fadeIn
```

### Card Hover
```css
Duration:         0.3s
Easing:           ease
Transform:        translateY(-2px)
```

### Close Button
```css
Duration:         0.2s
Easing:           default
Transform:        rotate(90deg) on hover
```

## Component Layout

### Grid System
```css
.wallet-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
```

### Card Structure
```
┌─────────────────────────────────────┐
│  STAT LABEL (11px, uppercase)       │
│  Stat Value (18px, bold)            │
└─────────────────────────────────────┘
```

### Modal Structure
```
┌───────────────────────────────────────┐
│  Header (gradient bg)                 │
│  👛 Wallet Tracker            ×       │
├───────────────────────────────────────┤
│  Content (white bg)                   │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ Wallet Address                  │ │
│  │ [address link]                  │ │
│  │ 💡 info message                 │ │
│  └─────────────────────────────────┘ │
│                                       │
│  ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ Label  │ │ Label  │ │ Label  │   │
│  │ Value  │ │ Value  │ │ Value  │   │
│  └────────┘ └────────┘ └────────┘   │
│                                       │
└───────────────────────────────────────┘
```

## Interaction States

### Cards
```css
Default:   transform: none
Hover:     transform: translateY(-2px)
           box-shadow: 0 4px 12px rgba(79, 195, 247, 0.15)
           border-color: rgba(79, 195, 247, 0.4)
```

### Links
```css
Default:   color: #667eea
Hover:     color: #764ba2
           text-shadow: 0 0 8px rgba(102, 126, 234, 0.3)
```

### Close Button
```css
Default:   background: rgba(102, 126, 234, 0.1)
           border: rgba(102, 126, 234, 0.2)
Hover:     background: rgba(102, 126, 234, 0.15)
           border: rgba(102, 126, 234, 0.4)
           transform: rotate(90deg)
```

## Responsive Breakpoints

### Desktop (> 768px)
- Full modal size (900px max-width)
- 3-column grid for stats
- Standard padding

### Tablet (≤ 768px)
```css
Modal:     max-height: 90vh
Header:    padding: 20px
           font-size: 20px
Content:   padding: 20px
Grid:      1 column
```

### Mobile (≤ 480px)
```css
Modal:     border-radius: 0
           height: 100vh
           max-height: 100vh
Backdrop:  padding: 0
```

## Accessibility

- **Focus States**: All interactive elements have focus indicators
- **Color Contrast**: Text meets WCAG AA standards
- **Keyboard Navigation**: Tab order is logical
- **Screen Readers**: Semantic HTML structure

## Consistency with Other Sections

### Matches: Trading Activity
- Card background gradient
- Border colors
- Hover effects
- Grid layout

### Matches: Market Metrics
- Header style
- Color scheme
- Typography
- Spacing

### Matches: Top Traders
- Border radius
- Shadow effects
- Interactive states
- Layout patterns

## Implementation Details

### CSS Variables (Recommended Future Enhancement)
```css
:root {
  --color-primary-blue: #667eea;
  --color-secondary-purple: #764ba2;
  --color-cyan-accent: rgba(79, 195, 247, 0.2);
  --color-success: #10b981;
  --color-error: #ef4444;
  --radius-card: 12px;
  --spacing-card: 16px;
  --shadow-card: 0 4px 12px rgba(79, 195, 247, 0.15);
}
```

## Visual Testing Checklist

- [ ] Modal opens with smooth animation
- [ ] Header displays with wallet icon and correct styling
- [ ] Wallet address is clickable and styled with monospace font
- [ ] Info message box has correct gradient and border
- [ ] Stats cards display in grid layout
- [ ] Hover effects work on cards and links
- [ ] Close button rotates on hover
- [ ] Scrollbar is styled consistently
- [ ] Positive values are green, negative are red
- [ ] Mobile view is full-screen
- [ ] Tablet view has single-column grid
- [ ] All animations are smooth
- [ ] Colors match other card sections

---

**Design System Version**: 1.0  
**Last Updated**: 2024  
**Status**: Production Ready  
**Figma/Design Tool**: N/A (CSS-first approach)

# Design playbook

"Expensive" does not mean gold gradients. It means every choice looks
deliberate: the type, the spacing, the colors, the words. A cheap design
looks like the default of a tool. An expensive one could only belong to this
founder.

## Pass 1: the plan, before any screen

Write `design/plan.md` in the worktree:

1. **Subject.** What world does the founder's product live in? A trial
   tracker lives with receipts, calendars, the small dread of an unexpected
   charge and the relief of cancelling in time. A law tool has paper, seals,
   quiet. The distinctive choices come from here, not from other websites.
2. **Palette.** 4 to 6 named hex values with roles (background, surface,
   text, muted, one accent, one state color). Check text contrast (WCAG AA).
   Define light and dark versions if the product will be used at night.
3. **Type.** One or two families, chosen for this subject, with a clear
   scale (for example 14 / 16 / 20 / 28 / 40 / 64). Check that the font has
   every alphabet the product's languages need.
4. **Layout.** One sentence and a rough ASCII sketch for the main screens.
   Decide alignment.
5. **The one bold move.** Pick one memorable thing: a typographic hero, an
   illustration style, a signature interaction. Keep everything around it
   quiet.

Then reread the plan and replace anything you would have produced for any
other founder. Write down what you changed and why.

## Pass 2: tokens

Put the palette, type scale, spacing scale and radii into one tokens file
(CSS custom properties or the framework's theme). Every screen uses tokens
only. No stray hex values.

## Pass 3: screens

- Use the real copy from `03-hooks.md`: headline, button, empty state,
  error. Never lorem ipsum.
- Design every state: empty, loading, error, success, long text, one item,
  a hundred items.
- Mobile first at 375px, then wider.
- Motion only where it explains a change (something opened, saved, moved).
  One orchestrated moment beats many little effects. Respect
  `prefers-reduced-motion`.
- Visible keyboard focus; hit areas of at least 44px on touch screens.

## Looks that read as "made by AI"

These are fine when the subject truly calls for them, and a giveaway when
they appear by default:

- Warm cream background with a high-contrast serif and a terracotta accent.
- Near-black background with one acid-green or vermilion accent.
- Identical rounded cards with the same soft shadow, gradient washes as
  decoration.
- An all-caps tracked label above every heading; "A · B · C" meta strings;
  arrows appended to every link; monospace for small labels everywhere.
- One word in a headline set in italic or a different color.
- Fade-and-slide-up on every section; hover lift on every card.
- Purple-to-blue gradients, glassmorphism, 3D blobs, stock "team" photos.

## Check your own work

Take screenshots at 375px and 1280px (Playwright, a headless browser, or
whatever screenshot tool you have) and look at them as the founder would.
Remove one decoration before you call it done. Commit the screenshots you
mention in claims under `design/shots/`.

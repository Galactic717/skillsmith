# Screenplay guide

A good screenplay lets three rival teams build the same film without asking
the writer a single question. Every scene says what the audience must see,
and every scene ends with checks a script can run.

## Structure

- **Logline:** who wants what, what stands in the way, what changes. One sentence.
- **Cast:** the protagonist is the main user, named, with a real situation
  from the brief. The antagonist is the problem. Supporting cast: other
  users, the owner, outside services.
- **World:** the technical decisions, explained in plain words first, then a
  short technical appendix. This is where you choose the stack (table below).
- **Contracts:** the fixed points every team must respect so the acceptance
  checks can find things: how to install, build and start; the port; the
  page paths; ids or texts the tests look for. Put them in the World section.
- **Act I, Foundation:** the skeleton that runs: install, start, the first
  screen, the data model.
- **Act II, Core:** every must-have from the brief, one scene each.
- **Act III, Polish and launch:** copy from the hooks file, empty and error
  states, mobile, speed, the README for the client.
- **Cut scenes:** everything from "later" and "not doing". Cutting is a
  feature.

## A scene card

```
### Scene 2.1: "The first order"
- Goal: Marta's customer picks a cake and a date and sees "Order received".
- Who: developer (form, saving), designer (layout, states)
- Depends on: 1.2
- Beats: form with date and phone; validation; save; confirmation screen
- Acceptance: A4, A5
```

The goal is written as something a person sees or does, never as code.

## Choosing the stack

Pick the most boring tool that fully does the job, so the client can find
help later. Default choices:

| The brief says | Default | Why |
|---|---|---|
| Information site, landing page, portfolio | Static HTML/CSS/JS, or Astro | Free hosting, nothing to break |
| Web app with accounts and data | Next.js + SQLite (single owner) or Postgres via Supabase with row-level security on every table | Common, well documented, cheap to host |
| Online shop | Shopify, or a static site + Stripe Payment Links | Payments and taxes are not a weekend project |
| Telegram bot | Node.js + grammY, or Python + aiogram | Mature libraries, free hosting options |
| Internal tool on spreadsheets | Google Sheets + Apps Script | The client already lives there |
| Phone app | A responsive web app (PWA) first; Expo only if the store is a must | One codebase, no store review to start |

Write the reason in one plain sentence in the World section.

## Acceptance checks

Write them before any code exists. Each check is a promise to the client
that a script can test. Types (`04-acceptance.json`):

| Type | Use it for | Example |
|---|---|---|
| `command` | build, unit tests, linters, a test script you wrote | `{"type":"command","run":"npm run build","expect":{"exit":0}}` |
| `http` | a page or endpoint answers on a local server | `{"type":"http","start":"npm run start","url":"http://localhost:3000/","expect":{"status":200,"includes":"Order a cake"},"timeout":90}` |
| `file_exists` / `file_absent` | a README, a manifest, no debug files | `{"type":"file_exists","path":"README.md"}` |
| `file_contains` | key content or config | `{"type":"file_contains","path":"README.md","pattern":"npm run start"}` |
| `not_contains` | no secrets, no lorem ipsum | `{"type":"not_contains","glob":"src/**/*.{js,ts,tsx}","pattern":"sk_live_"}` |

Rules:

1. Every must-have in the brief has at least one check.
2. Test behaviour from the outside (HTTP, the command line, files), not
   private function names. Teams must be free to build it their way.
3. For behaviour a single request cannot show (a form that rejects an empty
   phone, a flow across pages), write a small test script under
   `tests/acceptance/` (plain Node, or Playwright if the project already
   uses it) and call it from a `command` check. List `tests/acceptance/**`
   under `protected`.
4. `setup` lists the install commands every clean copy needs (for example
   `npm install`). Teams own `package.json`, so name the scripts the checks
   call in your contracts (`build`, `start`, `test`).
5. Give each check a plain-language `title` and a `scene`. Use `weight` 1 to 5
   for how much the client would care if it broke.
6. Include at least one check that a lazy demo fails: real data saved and
   read back, a second page, an error state. This is how "building to the
   test" gets caught.
7. Checks must fail on the empty project. If one passes before any code
   exists, it tests nothing.
8. Never point a check at the internet; only local URLs are allowed.

# Screenplay: TrialGuard

<!-- ss:logline -->
## Logline

Sam keeps paying for trials he forgot; TrialGuard puts every end date in one list and warns him in time.

<!-- ss:cast -->
## Cast

- **Protagonist:** Sam, a student with four free trials running.
- **Antagonist:** the quiet auto-renewal.
- **Supporting:** Maya, the founder, who reads the README.

<!-- ss:world -->
## World

A tiny Node.js server that serves one page, plus a module that keeps the list in order. Contracts:
`src/trials.mjs` exports `addTrial(list, {name, endsOn})` and returns a new list sorted by `endsOn`;
`node server.mjs` serves the home page on the port in the PORT environment variable.

<!-- ss:act1 -->
## Act I: Foundation

### Scene 1.1: "The first trial"
- **Goal:** Sam adds "Netflix, ends 20 December" and sees it in order.
- **Requirements:** R1
- **Acceptance:** A1

<!-- ss:act2 -->
## Act II: Core

### Scene 2.1: "The home page"
- **Goal:** the headline says what TrialGuard does.
- **Requirements:** R2
- **Acceptance:** A2

<!-- ss:act3 -->
## Act III: Hand-over

### Scene 3.1: "Maya runs it"
- **Goal:** the README gives one command to start it.
- **Requirements:** R3
- **Acceptance:** A3, A4

<!-- ss:acceptance -->
## Acceptance checks

See `04-acceptance.json`. Two more checks are sealed and hidden from the builders.

# PDP 5-Phase Development Plan

## Goal
Turn the product detail page into a premium, high-conversion experience for four buying contexts:
- Clinicas
- Laboratorios
- Estudiantes
- Mayoristas

The plan is split into five phases so design, copy, security, automation, and performance evolve without destabilizing the Odoo website.

## Phase 1: Visual QA and Layout Closure

### Goal
Close the current design pass on QAS across desktop, tablet, and mobile.

### Work
- Review 5-8 representative SKUs across categories.
- Tune gallery balance, sticky purchase area, tabs, FAQ, related cards, and final CTA.
- Fix breakpoint issues, overflow, spacing, and typography hierarchy.
- Validate real-world content density: short descriptions, long descriptions, many thumbnails, no thumbnails.

### Deliverables
- Stable premium PDP layout on desktop and mobile.
- SKU validation checklist.
- Final design issue list reduced to edge cases only.

### Acceptance
- No broken gallery or collapsed card shells.
- No overlapping or clipped content at 1440px, 1024px, 768px, 390px.
- The PDP supports sparse and dense product content without visual failure.

## Phase 2: Persona and Category Adaptation

### Goal
Make the PDP change its sales narrative depending on who is buying and what is being sold.

### Work
- Resolve persona from query, session, partner profile, and product context.
- Support four PDP personas: clinica, laboratorio, estudiantes, mayorista.
- Use path-based persona routes for public PDP variants so CDN/proxy cache does not collapse persona views into one HTML response.
- Adapt summary, reassurance blocks, CTA tone, FAQ framing, and WhatsApp copy.
- Add category-aware copy lenses for equipment, replacement items, training products, and infrastructure.
- Optionally add persona persistence per session for better browsing continuity.

### Deliverables
- Persona-aware PDP server context.
- Audience switcher in the PDP hero.
- Copy matrix by persona and market segment.

### Acceptance
- The same SKU reads differently for each persona without changing the layout.
- Session/query persona selection works consistently.
- WhatsApp CTA reflects the active persona context.

## Phase 3: Security Hardening

### Goal
Reduce CSP exposure without breaking Odoo frontend behavior.

### Work
- Keep nonce-based protection for inline scripts on HTML responses.
- Continue CSP report collection and review real violations from QAS traffic.
- Audit whether specific frontend bundles or widgets can be isolated from `unsafe-eval`.
- Review inline style usage and decide if style nonce or hash migration is realistic.
- Document which CSP relaxations are Odoo-core constraints versus project code constraints.

### Deliverables
- CSP nonce for inline scripts.
- Security audit notes for remaining `unsafe-eval`.
- Decision document for the next hardening step.

### Acceptance
- `unsafe-inline` is removed from `script-src`.
- Browser flows remain functional after deployment.
- Remaining CSP exceptions are justified by runtime evidence, not guesses.

## Phase 4: Deployment and Validation Automation

### Goal
Standardize the release cycle so every PDP change is deployed and verified the same way.

### Work
- Automate module deploy, frontend audit, PDP smoke check, and remote log inspection.
- Keep one command that runs the post-deploy verification cycle.
- Fail fast on missing headers, PDP structure regressions, HTTP errors, or recent tracebacks.
- Keep browser review manual for final UX sign-off, but automate the rest.

### Deliverables
- Release verification script for PDP changes.
- Repeatable deploy checklist.
- Reduced manual validation time per iteration.

### Acceptance
- A single script runs deploy verification end to end.
- The script checks QAS status, key URLs, PDP structure, and recent logs.
- Engineers still do a quick visual pass, but no longer rely on ad hoc command sequences.

## Phase 5: Performance and Asset Optimization

### Goal
Make the premium PDP feel fast, especially on mobile and slower networks.

### Work
- Audit image sizes and convert oversized assets to lighter formats where possible.
- Review lazy-loading strategy for gallery and related products.
- Reduce unnecessary DOM weight and frontend work on first render.
- Re-check `/descargas` and other slow routes during the same performance pass.
- Establish baseline metrics for response time and rendered weight on core routes.

### Deliverables
- Smaller payload on PDP hero/gallery.
- Performance fixes for the slowest public routes.
- Before/after measurements.

### Acceptance
- PDP remains visually rich but loads faster on mobile.
- Public pages avoid obvious oversized asset regressions.
- QAS audit stays within expected latency thresholds outside restart windows.

## Recommended Execution Order
1. Phase 1 visual QA closure.
2. Phase 2 persona/category adaptation.
3. Phase 4 deployment automation.
4. Phase 3 security hardening follow-up.
5. Phase 5 performance optimization.

## Implemented Foundation
- Premium Bader-AR-style PDP shell.
- QAS deployment cycle with audit.
- CSP nonce hardening for inline scripts.
- PDP smoke check.
- Persona-aware PDP foundation for clinica, laboratorio, estudiantes, and mayorista.

## Current Sprint Scope
- Formalize this roadmap.
- Deliver persona-aware PDP messaging and switching.
- Deliver a post-deploy verification script for PDP releases.

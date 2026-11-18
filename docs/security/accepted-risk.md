# Security exception register

## GHSA-fc5q-39xc-vjpf — picomatch ReDoS

- **Reviewed:** 2026-11-17
- **Status:** Temporary exception; no patched npm release was identified during the review.
- **Affected package:** `picomatch <= 4.0.7`
- **Dependency path:** `@sentry/nextjs -> @rollup/plugin-commonjs -> picomatch`
- **Severity reported by GitHub:** High
- **Why it is accepted temporarily:** The vulnerable package is reached through Sentry's Rollup bundler integration. The glob patterns used by this integration are part of repository/build configuration, not values supplied by public booking customers or other untrusted end users. The upstream maintainer has publicly disputed the advisory and recommends not allowing untrusted users to define patterns. The advisory has not been treated as fixed by this exception.
- **Scope of exception:** Only `GHSA-fc5q-39xc-vjpf`. All other high/critical production advisories continue to fail CI.
- **Required follow-up:** Remove this exception as soon as a patched `picomatch` release or a Sentry dependency update removes the affected path. Re-review the actual dependency path whenever `@sentry/nextjs` or `@rollup/plugin-commonjs` changes.

This is a documented risk acceptance, not a claim that the package has been patched. Do not add broad package-name or severity-based ignores.

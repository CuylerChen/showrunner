# Showrunner Security and Stability Fixes Design

Date: 2026-06-07
Status: Approved for planning

## Scope

This pass fixes the highest-risk issues found in the project review without expanding the product surface. The goal is to make the current MVP safer and more consistent, not to complete a full paid billing system or revive the legacy click-recording pipeline.

In scope:
- Upgrade vulnerable runtime dependencies where compatible.
- Enforce ownership checks on login-session proxy APIs.
- Add URL safety validation before website fetches, screenshots, and browser sessions.
- Fail fast in production when required secrets are missing.
- Make demo creation quota handling safer around queue failures.
- Align payment and login-session UI/API behavior with what is actually supported.
- Add focused tests or verification scripts for these guards where practical.

Out of scope:
- Full LemonSqueezy checkout and webhook implementation.
- A full authenticated-app recorder revival.
- Large UI redesign.
- Migrating the entire worker schema sharing model.

## Architecture

### Security Guards

Add a shared URL safety utility in `web` and a matching worker-side utility. The guard accepts only `http:` and `https:` URLs, rejects credentials in URLs, resolves hostnames, and blocks loopback, private, link-local, multicast, and metadata-service address ranges. It also follows redirects only if each redirected URL passes the same policy.

Use this guard in:
- `POST /api/demos`
- login-session start/navigation APIs
- worker website analysis fetches
- worker screenshot capture navigation

### Ownership Checks

All `/api/demos/[id]/login-session*` routes must verify that the current user owns the demo before forwarding requests to the worker or mutating the DB. This matches the existing ownership pattern used by normal demo detail and step routes.

The save route must query by both `id` and `user_id`, and its update must also use both conditions.

### Required Configuration

`JWT_SECRET` must be required in production. Development may keep the existing fallback, but production startup or first import should throw with a clear message if it is missing or still set to the example value.

OAuth routes should fail gracefully if provider env vars are not configured instead of building provider URLs with `undefined`.

### Quota and Queue Consistency

Demo creation should avoid permanently charging quota when enqueueing fails. The minimal implementation is:
- Insert demo.
- Try enqueue.
- Increment quota only after enqueue succeeds.
- If enqueue fails, mark demo failed or delete it, and return an internal error.

If MySQL transaction support is straightforward in the local Drizzle setup, use a transaction around the DB changes. If not, keep the operation explicit and add queue-failure cleanup.

Quota race hardening should use an atomic conditional update such as `demos_used_this_month < demos_limit OR demos_limit = -1`, then check affected rows before creating the demo.

### Payment Consistency

Payment remains unsupported in this pass. Keep checkout/webhook returning 404, but remove or soften UI/API messages that tell users to upgrade through a non-existent checkout. Quota errors should say the project currently has no self-serve upgrade flow.

### Login-State Feature Consistency

The old login-session flow currently saves browser storage state but the promotional parser ignores it. This pass should avoid implying that login state changes generated scenes. The safest MVP behavior is:
- Hide or disable remote login-session controls in the demo list/detail UI.
- Keep direct cookie storage endpoints only if they are not surfaced as a main workflow.
- Add comments or user-facing copy only where needed to avoid a misleading path.

### Dependency Updates

Update vulnerable dependencies with the smallest compatible bumps:
- `next` to the patched 16.2.x line.
- `eslint-config-next` to match `next`.
- `drizzle-orm` to the patched 0.45.x line in both packages.
- `bullmq` to a patched version in both packages.
- Worker transitive issues should be addressed by `npm audit fix` where it does not force breaking changes; otherwise update direct parents conservatively.

After dependency updates, run package installs and builds for both packages.

## Error Handling

API errors should continue using the existing `{ success: false, error: { code, message } }` response shape where those helpers are already used.

Worker URL validation failures should produce actionable errors and mark demos failed only after retry attempts are exhausted. Validation errors that will never succeed should not retry if BullMQ job options can reasonably distinguish them; otherwise the error message must be clear.

SSE status route should avoid double-closing its stream controller on client abort and terminal status. Use a `closed` flag around `controller.close()`.

## Testing and Verification

Add focused coverage where the project already has tooling:
- For pure URL utilities, add small TypeScript test scripts or colocated unit tests if introducing a test runner is not necessary.
- For API ownership and quota behavior, prefer focused route-level helper tests only if they can run without live MySQL. Otherwise document verification with build and manual code-path checks.

Required verification before completion:
- `npm run lint` in `web`
- `npm run build` in `web`
- `npm run build` in `worker`
- `npm audit --audit-level=moderate` in both packages after dependency updates
- `git status --short`

Manual end-to-end video generation is not required for this pass because it depends on external browser, TTS, and AI services. If it is run, treat it as extra verification, not the primary gate.

## Acceptance Criteria

- A logged-in user cannot start, inspect, save, input to, or screenshot another user's login browser session.
- Unsafe URLs are rejected before the web app or worker fetches or opens them.
- Production cannot run with a default JWT secret.
- Creating a demo does not consume quota when enqueueing fails.
- Quota checks are not trivially bypassed by concurrent create requests.
- The UI and API no longer imply that self-serve paid upgrade or login-state reparse is available when it is not.
- `web` and `worker` build successfully after dependency updates.
- Remaining audit findings, if any, are explicitly reported with reason and next action.

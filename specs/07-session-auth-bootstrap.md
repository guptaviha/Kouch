# Ticket 07 — Add signed session bootstrap between web and realtime apps

## Objective
Ensure the PartyKit room trusts only web-issued session claims for host and player identity, role, and room permissions.

## Why this ticket exists
The current implementation trusts client-provided `userId`, `playerId`, `hostId`, and room commands. That is acceptable for a local prototype but not for a Durable Object runtime exposed on the public internet.

## Scope
- Create web-owned bootstrap endpoints for host/player session creation.
- Mint signed, short-lived session tokens for realtime joins.
- Validate claims in the PartyKit room before attaching connections.

## Recommended flow
1. Browser requests a host/player realtime session from `apps/web`.
2. Web app validates the action and generates a signed token.
3. Browser connects to PartyKit with that token in query params, headers, or an initial message.
4. PartyKit verifies signature, expiry, room code, role, and user identity.
5. Room attaches the participant and returns the authoritative snapshot.

## Technical requirements
- Token contents should include at minimum:
  - `sub` or participant ID
  - `role`
  - `roomCode`
  - `displayName`
  - `avatar`
  - `protocolVersion`
  - `exp`
  - optional `nonce` / `issuedAt`
- Use a signing method supported in both runtimes. HMAC or JWT with Web Crypto is a good fit.
- Keep token lifetime short for join/bootstrap flows.
- Separate permissions for:
  - host-only commands
  - player gameplay commands
  - reconnect/resume commands
- Add anti-abuse basics such as room code normalization and invalid token throttling.

## Implementation notes
- Store minimal identity locally in the browser; do not let the browser invent authorization-critical fields.
- PartyKit should derive `participantId` and `role` from verified claims, not from message payloads.
- If anonymous play is allowed, the web app should still mint the participant identity.
- Keep host promotion or transfer rules explicit if they are supported.

## Deliverables
- Web bootstrap endpoint(s) for signed realtime sessions.
- Shared token payload type and verifier utilities.
- PartyKit-side claim verification on connect.
- Permission checks around host-only actions.

## Acceptance criteria
- A browser cannot become host by changing a client payload locally.
- Invalid or expired realtime session tokens are rejected.
- Room commands are authorized against verified session role, not raw message input.
- Reconnect works by minting or resuming a valid session path.

## Dependencies
- Tickets 02, 04, and 06.

## Out of scope
- Full account system.
- Moderation tooling.

# AI Game Mobile UX Spec

## Goal

Mobile play should feel like a chat-first game. The chat window is the main surface, and game controls appear only when the current phase needs a decision.

## Layout Principles

- Keep the message list as the primary area.
- Keep the input bar visible at the bottom whenever speaking is allowed.
- Do not use chat/info tabs on mobile.
- Do not use a persistent full information panel on mobile.
- Use phase-based action cards near the input area.
- Cards must not cover messages or push the input off screen.
- Avoid horizontal overflow and fixed-width controls.

## Phase Cards

### Waiting

Show a compact card with the player count, start button, and room ID copy action.

### Playing

Show only the current player's private prompt, vote entry, and reveal action.
Do not show the full player list by default.

### Voting

Expand the vote picker. Candidate selection should be compact and scroll inside the card if it grows.

### Revealed

Show a compact result card with identities, summary, share, and new-game action.

## Mobile Constraints

- Default action card height should stay small.
- Expanded card content should scroll internally.
- The input bar remains outside the card and below it.
- Player candidates use a responsive grid with no horizontal scrolling.
- Any long text must truncate or scroll inside the card.

## Desktop

Desktop keeps the full right-side control panel. Mobile and desktop should reuse the same business state and action handlers, but their layouts may differ.

## Campaign Mode

The undercover campaign uses the same in-room chat UI. The level map lives on the AI game home page. Each level starts a normal undercover room with level-specific player count, duration, title, and difficulty copy.

Progress can start as local-only state. A level is cleared when the player's final judgment succeeds. Clearing a level unlocks the next level and shows a compact result card with replay and next-level actions.

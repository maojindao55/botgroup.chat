---
version: "alpha"
name: BotGroup Game Console
description: Chat-first interface for BotGroup AI games.
colors:
  primary: "#18181B"
  secondary: "#71717A"
  accent: "#C2410C"
  accent-hover: "#9A3412"
  background: "#FFFFFF"
  surface: "#FFFFFF"
  muted: "#F4F4F5"
  success: "#15803D"
  warning: "#A16207"
  danger: "#DC2626"
  on-primary: "#FFFFFF"
  on-accent: "#FFFFFF"
typography:
  title:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: Inter, system-ui, sans-serif
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.35
rounded:
  sm: 4px
  md: 8px
  lg: 10px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
components:
  action-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
  app-background:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
  meta-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
  muted-panel:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
  bordered-control:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 8px
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: 8px
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  message-own:
    backgroundColor: "#2563EB"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  message-other:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
  status-success:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.success}"
  status-warning:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.warning}"
  status-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
---

## Overview

BotGroup AI games use a chat-first console. The interface should feel like a fast group chat with light game controls, not a dashboard. Players should keep reading messages while game actions appear only when the phase needs input.

## Colors

Use neutral surfaces for the chat area and cards. The orange accent is reserved for primary game actions: start, submit vote, share result, and new game. Blue is only for the current user's chat bubble.

## Typography

Use compact, readable system typography. Mobile controls should use small labels and clear button text. Avoid large display text inside cards.

## Layout

Mobile keeps the chat list as the main visual surface. The input bar stays visible at the bottom. Phase cards appear directly above the input bar and remain compact by default. Expanded candidate lists scroll inside the card.

Desktop keeps a two-column layout: chat on the left, full control panel on the right.

## Elevation & Depth

Use subtle borders and shadows only for actionable cards. Avoid layered cards inside cards. The game controls should read as part of the chat tool, not as a floating modal.

## Shapes

Cards use 8px radius. Buttons and candidate options use 8px radius. Message bubbles use 8px radius.

## Components

Action cards contain one current task. Candidate lists use compact two-column grids on mobile. Primary buttons use the orange accent. Secondary buttons remain outline buttons.

## Do's and Don'ts

- Do keep the input bar visible.
- Do show controls based on the current game phase.
- Do keep mobile cards short by default.
- Do scroll expanded content inside the card.
- Do not use mobile chat/info tabs.
- Do not place a persistent control panel above the chat.
- Do not allow horizontal overflow.
- Do not hide messages behind fixed panels.

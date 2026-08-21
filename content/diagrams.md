---
title: Diagram Examples
summary: Working Mermaid examples for game-design flows, interactions, and state transitions.
eyebrow: Wiki reference
status: reference
---

Mermaid diagrams are authored directly in Markdown with a fenced `mermaid` code block. These examples also suggest useful diagram types for the GDD.

## Core loop flowchart

Use flowcharts to show repeated player activity and the feedback connecting each step.

```mermaid
flowchart LR
    Observe[Observe the situation] --> Decide[Choose an action]
    Decide --> Act[Act]
    Act --> Feedback[Read feedback]
    Feedback --> Consequence[Accept consequences]
    Consequence --> Observe
```

## Encounter sequence

Use sequence diagrams when timing and responsibility across actors matter.

```mermaid
sequenceDiagram
    actor Player
    participant Game
    participant Enemy
    Player->>Game: Commit action
    Game->>Enemy: Resolve effect
    Enemy-->>Game: React
    Game-->>Player: Present new state
```

## Production state

Use state diagrams to describe lifecycle rules without turning the GDD into a task checklist.

```mermaid
stateDiagram-v2
    [*] --> Question
    Question --> Prototype: needs evidence
    Question --> Decided: resolved by discussion
    Prototype --> Decided: validated
    Prototype --> Rejected: disproved
    Decided --> Documented
    Rejected --> Documented
    Documented --> [*]
```

## Authoring note

Mermaid syntax errors fail visibly instead of silently falling back to a code block. See the [Mermaid documentation](https://mermaid.js.org/intro/) for supported diagram types and syntax.

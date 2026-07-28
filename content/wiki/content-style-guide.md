---
title: Wiki Content Style Guide
summary: Rules for choosing clear, visual, mathematical, and structured formats when authoring wiki pages.
eyebrow: Wiki guide
status: reference
---

This guide defines how content makers should present information in the wiki. Its purpose is to make pages quick to scan, easy to compare, and less dependent on long prose.

## Format priority

Use the highest suitable format in this order:

1. **Chart** — quantitative values, proportions, distributions, trends, or comparisons.
2. **Schema** — relationships, flows, sequences, states, hierarchies, or system structure.
3. **Image** — appearance, composition, spatial reference, mood, or visual target.
4. **Table** — structured facts, repeated attributes, matrices, or exact values.
5. **Formula** — calculations, transformations, constraints, probabilities, or mathematical relationships.
6. **Text** — context, rationale, nuance, constraints, or information that the formats above cannot communicate clearly.

Do not begin with prose by default. First ask whether the information can be communicated accurately by a chart, schema, image, table, or formula. Use text only for what those formats cannot show, and keep supporting prose concise.

## Charts before prose

Prefer a chart whenever the reader needs to understand quantitative information visually.

Use charts to show, for example:

- crew-member stat profiles with a radar chart;
- item or enemy drop rates with a pie chart;
- damage, cost, or progression comparisons with a bar chart;
- changes over time or level with a line chart.

Choose a chart type that matches the question being answered. Include clear labels, units, and a short statement explaining the intended takeaway. Do not use a chart when exact values or small differences would be clearer in a table.

## Schemas before prose

Prefer a schema whenever the reader needs to understand how concepts connect or how a system behaves. Author schemas as Mermaid diagrams so they remain editable with the page.

Use schemas to show, for example:

- gameplay loops with a flowchart;
- interactions between actors or systems with a sequence diagram;
- entity or content relationships with an entity-relationship diagram;
- progression or dependency structure with a graph;
- lifecycle rules with a state diagram.

A schema should replace a prose walkthrough, not duplicate it. Add only the text needed to define constraints, exceptions, or decisions that the schema cannot express.

## Images before prose

Prefer an image when the subject is primarily visual or spatial.

Use images to communicate, for example:

- character, environment, prop, or UI appearance;
- composition, scale, silhouette, or layout;
- mood, lighting, color, or art direction;
- annotated spatial relationships.

Every image must have descriptive alt text and should state whether it is a target, reference, concept, mock-up, or current implementation. Use annotations when the reader must notice specific details.

### Required image placeholders

If a page requires an image, the page must contain a real, dedicated image file at that position. When final artwork, assets, screenshots, or designer input are not yet available, create a placeholder image instead of leaving a prose note or a **Needs image** marker.

The placeholder itself must visually describe what should replace it. It may contain text, a rough composition, example content, required dimensions, or other production direction. Keep the placeholder at the intended final path and aspect ratio so a designer can replace the file without editing the Markdown page.

Replacement instructions belong inside the placeholder image—not in page prose, captions, or alt text. Page-level alt text and captions must describe the image's lasting purpose and remain correct after the final asset replaces the placeholder.

## Tables before prose

Prefer a table when information shares a consistent set of fields or must be scanned and compared precisely.

Use tables to show, for example:

- stats and tuning values;
- feature or character comparisons;
- rules with conditions and outcomes;
- inventories, content lists, and status matrices.

Keep one kind of value per column, include units in headings, and use consistent terminology across rows. If a table becomes difficult to scan, split it by concern rather than converting it into paragraphs.

## Formulas before prose

Prefer mathematical notation when it expresses a calculation, relationship, or constraint more precisely than prose. A single formula or matrix can replace a long verbal explanation while making the rule easier to verify and implement.

Use formulas to show, for example:

- damage, score, economy, or progression calculations;
- probability and drop-rate rules;
- scaling curves and balancing relationships;
- vectors, matrices, and spatial transformations;
- bounds, invariants, and other mathematical constraints.

Define every variable, include units where relevant, and state rounding or clamping behavior explicitly. Introduce the formula with one sentence describing its purpose; do not narrate the same calculation step by step unless an example is needed to remove ambiguity.

## Text as support

Use text for rationale, intent, nuance, exceptions, and transitions between structured artifacts. Prefer short paragraphs and lists over uninterrupted blocks of prose.

Text should explain **why** something exists, clarify **how to interpret** an artifact, or record information that cannot be represented faithfully in a more structured format. It should not restate every value, connection, or detail already visible in a chart, schema, image, or table.

## Authoring check

Before publishing or updating a page, check:

- Could any quantitative comparison become a chart?
- Could any relationship, process, state, or hierarchy become a Mermaid schema?
- Could any visual or spatial description become an image?
- Does every required image have a dedicated final or placeholder file embedded in the page?
- Are placeholder replacement instructions contained inside the image rather than the page content?
- Could any repeated fields or comparable facts become a table?
- Could any calculation, transformation, or mathematical relationship become a formula or matrix?
- Does the remaining text add rationale or nuance instead of duplicating the artifacts?
- Are charts, schemas, images, tables, and formulas clearly titled, labeled, and introduced?

See [[Wiki/Diagrams|Diagram examples]] for Mermaid authoring examples, [[Wiki/Formulas|Formula examples]] for mathematical notation, and [[Wiki/Markdown Cheat Sheet|Markdown cheat sheet]] for tables and images.

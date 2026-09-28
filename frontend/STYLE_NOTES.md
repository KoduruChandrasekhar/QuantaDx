# Style notes

No previous project was supplied, so the visual language follows the idea deck.

- **Tokens** (`src/index.css`): navy #1F497D, classical blue #0070C0, quantum purple #7B3FA0, hybrid teal #0E8C8C, green #1E9C48, saffron #E8770E, red #C0392B; tints for surfaces; light default, dark theme via `.dark`.
- **Type**: Inter (UI), Source Serif 4 (page titles), JetBrains Mono (circuits, code, gate labels), tabular numerals for metrics.
- **Layout**: gradient navy sidebar with grouped nav, sticky blurred top bar, pipeline stepper on pipeline pages, 1440 px content width.
- **Motion** (Framer Motion + CSS, off under reduced motion): site-wide quantum particle field, cursor-tracking card glow, animated gradient borders, scramble-in page titles with orbiting atom marks, count-ups, spring layouts, route progress bar, 3D tilt, scroll reveals, circuit marquee, particle bursts on completion.
- **Family encoding**: classical = blue shades, quantum = purple, hybrid = teal; dash patterns distinguish models within a family.
- **Gates**: H saffron, phase purple, rotations blue (data-encoding gates hatched, trainable solid), two-qubit navy, measurement green.

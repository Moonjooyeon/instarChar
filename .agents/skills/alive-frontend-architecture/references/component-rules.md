# Component Rules

## Responsibility

A component should primarily render UI and coordinate user interaction. Move pure transformations to `domain`, network calls to `api`, and multi-step effects to a focused hook.

Split a component when one of these is true:

- a conditional branch represents a distinct user journey;
- a child has a meaningful independent interaction or loading state;
- the parent is passing props through without using them;
- the same visual behavior has two real consumers;
- the component cannot be understood without scrolling across unrelated concerns.

Do not split solely because a JSX block is long. Keep tightly coupled markup together when splitting would hide the behavior.

## Props

- Use explicit, domain-named props.
- Prefer `onAction` callbacks over generic `onChange` when the event has semantic meaning.
- Pass the smallest data shape the component needs, not the entire controller context.
- Avoid boolean prop combinations that create ambiguous states; use a discriminated union when modes are mutually exclusive.
- Keep provider/API types out of presentational component props; map them at the feature boundary.

## Conditional UI

Separate materially different states into named components such as `LoadingState`, `EmptyState`, `ErrorState`, and `ContentState`. Keep tiny visual conditions inline.

## Declarative interactions

Use declarative wrappers for repeated behavior such as overlays, impressions, analytics, and multi-step flows. The abstraction must reduce cognitive load and have a stable interface; otherwise keep the local implementation.

## Performance and accessibility floor

Adapted selectively from [Vercel React Best Practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) and [Web Interface Guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines):

- Start independent async work together when the user flow allows it; avoid accidental request waterfalls in effects.
- Do not add `memo`, `useMemo`, or `useCallback` without a measured render or dependency reason.
- Interactive controls need semantic elements, keyboard reachability, visible focus, accessible names, and a clear loading/disabled state.
- Overlays must define focus entry, escape/close behavior, and focus return; use the overlay skill/library only when it improves these invariants.

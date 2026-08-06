# Frontend Folder Rules

## Placement decision

| Code | Location | Rule |
|---|---|---|
| Screen/page composition | `src/features/<area>/<Area>Screen.tsx` or `src/app/*Route.tsx` | Owns layout and feature composition, not reusable business rules |
| Feature-only component | `src/features/<area>/components/` | Used by one product area; keep it near the feature |
| App shell composition | `src/app/` | Routes, cross-feature panels, and modal composition only |
| Shared visual primitive | `src/components/ui/` | Must have at least two real consumers or be an obvious design primitive |
| Feature stateful behavior | `src/hooks/use<Area>*.ts` | Owns effects, mutations, async state, and persistence orchestration |
| Pure business rule | `src/domain/<area>/` | No React, DOM, network, or storage side effects |
| API request/adapter | `src/api/<resource>.ts` | Owns HTTP details and response mapping |
| Feature-specific style | colocate or `src/styles/screens/` | Keep tokens in shared theme; avoid new global selectors |
| Test | beside pure logic or `tests/domain`/`tests/e2e` | Match the project's current test layer; do not add a new runner casually |

## Component folder policy

Do not create a directory for every trivial component. Start with one file. Create a folder only when the component has colocated tests, styles, subcomponents, or types that improve discoverability.

Preferred shape:

```text
FeatureCard/
├── FeatureCard.tsx
├── FeatureCard.test.tsx      # only when component-level testing exists
├── FeatureCard.types.ts      # only for non-trivial public types
└── FeatureCard.css           # only for local styles
```

Avoid `index.ts` barrels until there is a real import-boundary benefit. Do not create `containers/`, `managers/`, or `utils/` folders as default dumping grounds.

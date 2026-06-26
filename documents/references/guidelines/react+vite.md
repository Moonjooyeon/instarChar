## TypeScript General Guidelines

### Basic Principles

- Use English for all code and documentation.
- Always declare the type of each variable and function (parameters and return value).
- Avoid using `any`. Use `unknown` if the type is truly unknown.
- Create necessary types and interfaces.
- Don't leave blank lines within a function.
- One export per file (except for utility files and barrel exports).

### Nomenclature

- Use PascalCase for classes, interfaces, types, and React components.
- Use camelCase for variables, functions, and methods.
- Use kebab-case for file and directory names.
- Use SCREAMING_SNAKE_CASE for environment variables and constants.
- Avoid magic numbers and define constants.
- Start each function with a verb.
- Use verbs for boolean variables. Example: `isLoading`, `hasError`, `canDelete`, etc.
- Use complete words instead of abbreviations and correct spelling.
  - Except for standard abbreviations like API, URL, HTTP, etc.
  - Except for well-known abbreviations: `i`, `j` for loops, `err` for errors, `ctx` for contexts.

### Functions

- Write short functions with a single purpose. Less than 20 instructions.
- Name functions with a verb and something else.
  - If it returns a boolean, use `isX` or `hasX`, `canX`, etc.
  - If it doesn't return anything, use `executeX` or `saveX`, etc.
- Avoid nesting blocks by using early checks and returns or extraction to utility functions.
- Use higher-order functions (map, filter, reduce, etc.) to avoid function nesting.
- Use arrow functions for simple functions (less than 3 instructions).
- Use named functions for non-simple functions.
- Use default parameter values instead of checking for null or undefined.
- Reduce function parameters using RO-RO (Receive Object, Return Object).
- Use a single level of abstraction.
- Prefer async/await over Promise chains.

### Data

- Don't abuse primitive types and encapsulate data in composite types.
- Avoid data validations in functions and use classes/types with internal validation.
- Prefer immutability for data.
- Use `readonly` for data that doesn't change.
- Use `as const` for literals that don't change.
- Prefer interfaces for object shapes, types for unions/intersections.

### Exceptions

- Use exceptions to handle errors you don't expect.
- If you catch an exception, it should be to fix an expected problem, add context, or use a global handler (React Error Boundary).
- Use custom error classes for domain-specific errors.

### Testing

- Follow the Arrange-Act-Assert convention for tests.
- Name test variables clearly. Follow the convention: `inputX`, `mockX`, `actualX`, `expectedX`, etc.
- Write unit tests for each public function and custom hook.
- Write component tests using React Testing Library.
- Use test doubles (mocks, stubs, spies) to simulate dependencies.

## React Specific Guidelines

### Basic Principles

- Use functional components with hooks exclusively.
- Keep components focused and single-purpose.
- Extract business logic into custom hooks.
- Use composition over prop drilling.
- Prefer controlled components for form inputs.

### Component Structure

Follow this order in components:

1. Imports
2. Types/Interfaces
3. Constants (if any)
4. Component definition
5. Hooks (useState, useEffect, custom hooks)
6. Derived state / memoized values
7. Event handlers
8. Render helpers
9. Return JSX

Keep components under 200 lines. Break down large components into smaller, reusable ones.

### State Management

- Use `useState` / `useReducer` for local component state.
- Use **Zustand** for global client state (UI state, auth, preferences).
- Avoid prop drilling deeper than 2 levels — use Context or Zustand.
- Keep state as close to where it's used as possible.

### Performance

- Use `React.memo` for expensive components that re-render often.
- Use `useMemo` for expensive calculations.
- Use `useCallback` for functions passed as props.
- Avoid inline object/array creation in JSX.
- Use code-splitting with `React.lazy` and `Suspense` for route-level components.
- Avoid deeply nested component trees — extract and flatten where possible.

### Styling

- Use **Tailwind CSS** utility classes as the primary styling approach.
- Avoid inline styles unless absolutely necessary (e.g., dynamic values).
- Use `clsx` or `cn` utility for conditional class composition.

### Fabric.js (Canvas) Guidelines

- Encapsulate all Fabric.js canvas logic inside custom hooks (e.g., `useCanvas`, `useAssetEditor`).
- Never directly access `fabric.Canvas` from React components — always go through hooks.
- Clean up canvas event listeners and dispose canvas in `useEffect` cleanup.
- Use `useRef` to hold the canvas instance, not `useState`, to avoid re-renders.

### Accessibility

- Use semantic HTML elements.
- Include proper ARIA labels and roles.
- Ensure keyboard navigation works.
- Maintain proper heading hierarchy.

## API & Data Fetching Guidelines

### Generated API Client

- Always use the typed API client from `packages/api-client/` to call backend APIs.
- Never call `fetch` or `axios` directly from components — go through the client.
- API contracts (TypeScript types) are auto-generated from OpenAPI specs in `packages/contracts/`. Regenerate after backend schema changes:

```bash
make contracts
```

### Environment Variables

- Prefix all client-side env variables with `VITE_`.
- Define types for `import.meta.env` in `src/types/env.d.ts`.
- Never commit `.env` files — use `.env.example` as a reference.

### Path Aliases

Use the `@/` alias for `src/` to avoid long relative import paths.

```ts
// ✅ Good
import { Button } from '@/components/ui/Button';

// ❌ Bad
import { Button } from '../../../components/ui/Button';
```
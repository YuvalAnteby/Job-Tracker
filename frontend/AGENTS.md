# Frontend Agent Instructions

These instructions apply when working under `frontend/`. They add to the
repository-wide guidance in the root `AGENTS.md`.

## Frontend Rules

- Use functional React components with hooks; never add class components.
- Use TypeScript for every prop, state value, event handler, and return type.
- Define component props with an interface named `[ComponentName]Props` above
  the component.
- Use named exports for components. Use default exports only for route-level
  page components.
- Keep component implementation and its test together.
- Avoid `index.ts` barrel files; import directly from the named file.
- Use `useReducer` for more than two related state values or complex
  transitions.
- Add cleanup in `useEffect` when subscribing to events, timers, or external
  resources.
- Use React Hook Form for forms with two or more fields or submission logic; do
  not build those forms with manual `useState` state.
- Handle loading, error, and success states explicitly for async operations.
- Keep business logic in hooks or utilities, not components.
- Do not use `useEffect` to synchronize state derived from props or other state;
  derive it inline or with `useMemo`.
- Never use array indexes as keys for lists that can be reordered or filtered.
- Prefer Tailwind utility classes.
- Use the existing global stylesheet at `src/index.css` when global CSS is necessary.
- Do not add per-component CSS files unless the styling cannot reasonably be
  expressed with the existing approach.
- Use Vite environment syntax (`import.meta.env.VITE_*`), never `process.env`.
- Keep server state in TanStack Query. Do not fetch server data directly in
  `useEffect`.
- Use the configured Axios client at `src/api/client.ts` for API calls from
  query and mutation functions.
- Do not call bare Axios directly from components.

## Structure And Naming

- Components use `PascalCase.tsx`.
- Pages use `PascalCase.tsx` inside their own page directory when the page has
  multiple files.
- Custom hooks use `camelCase.ts` names beginning with `use`.
- Routes are currently defined in `src/App.tsx`; update that file when adding a
  route unless the routing structure is deliberately refactored.

When creating a component, include its typed component file, co-located smoke
test, and a co-located custom hook when it needs server data. When creating a
page, include the page file, route wiring, and a typed React Query data hook
when needed. Do not stop after creating only the first file.

## Testing

- Co-locate tests next to the file under test.
- Use React Testing Library and query by accessible roles, labels, or visible
  text rather than implementation details.
- Test custom hooks with `renderHook`.
- Wrap React Query tests in a configured `QueryClientProvider` with retries
  disabled.
- Mock network requests with the existing MSW setup in
  `src/mocks/handlers.ts` and `src/mocks/server.ts` when those files are
  present.
- Never make real network requests from tests.
- Do not use `any` in test data; use strict factories or `Partial<Type>` where
  appropriate.

Run frontend commands with:

```text
npm --prefix frontend run <script>
```

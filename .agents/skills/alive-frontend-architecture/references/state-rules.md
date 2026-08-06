# State Ownership Rules

Classify state before choosing a tool.

| State | Owner | Preferred mechanism |
|---|---|---|
| Input, toggle, open/closed UI | One component | `useState` or local reducer |
| Multi-step setup flow | Feature | typed funnel/history state; preserve back navigation |
| Server data and mutations | Feature/API boundary | request hook plus explicit loading/error/empty states |
| URL/shareable navigation state | Router/navigation layer | URL or route state |
| Durable user data | Backend | API persistence with local cache only as a resilience layer |
| Cross-feature session state | Small feature context or focused reducer | only when multiple consumers truly need it |
| Pure derived values | Domain/helper | pure function, not another state variable |

## Avoid

- A global store for values used by one screen.
- A mega-context that causes unrelated re-renders.
- Copying server state into multiple local stores without a synchronization rule.
- Passing `ctx` through every component just to reach one callback.
- `useEffect` for values that can be derived during render.

## ALIVE priority

Keep server authority for characters, posts, likes, follows, DMs, media references, and AI usage. Local state may provide optimistic UX, but it must reconcile with the server response or roll back on failure.

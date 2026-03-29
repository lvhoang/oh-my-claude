# Project: Next.js Application

## Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Architecture

- Use the App Router (`app/` directory). Do not use the Pages Router.
- Default to **Server Components**. Only add `'use client'` when you need interactivity, event handlers, or browser APIs.
- Push `'use client'` boundaries as far down the component tree as possible — wrap the interactive leaf, not the whole page.
- Use **Server Actions** (`'use server'`) for data mutations (form submissions, database writes). Use Route Handlers only for public APIs or webhooks.
- All request APIs are async: `await cookies()`, `await headers()`, `await params`, `await searchParams`.

## Code Conventions

- Use `function` declarations for components, not arrow functions assigned to `const`.
- Co-locate related files: `page.tsx`, `loading.tsx`, `error.tsx`, and route-specific components live in the same route segment directory.
- Name component files in PascalCase (`UserCard.tsx`). Name utility files in camelCase (`formatDate.ts`).
- Prefer named exports for components. Default exports only for `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Use `import type {}` for type-only imports.

## Data Patterns

- Fetch data in Server Components, not in Client Components with `useEffect`.
- Avoid data waterfalls: use `Promise.all()` for parallel fetches, or use React `<Suspense>` boundaries to stream independent sections.
- Use `revalidatePath()` or `revalidateTag()` after mutations to invalidate caches.
- Never expose database credentials or internal service URLs to the client.

## Styling

- Use Tailwind utility classes. Avoid inline `style={{}}` and CSS modules unless there's a specific reason.
- Use `cn()` (clsx + tailwind-merge) for conditional class composition.
- Use CSS variables for theming (`--foreground`, `--background`, etc.).
- Always support dark mode via the `dark:` variant.

## Images & Fonts

- Always use `next/image` instead of `<img>`. Configure `remotePatterns` in `next.config.ts` for external images.
- Always use `next/font` for font loading. Prefer Geist Sans / Geist Mono.

## Error Handling

- Add `error.tsx` boundaries at route segments where errors are expected.
- Use `notFound()` from `next/navigation` for 404 cases. Create `not-found.tsx` for custom 404 pages.
- In catch blocks that might intercept Next.js internal errors, call `unstable_rethrow(error)` before handling.

## Testing

- Run `npx tsc --noEmit` to typecheck before committing.
- If tests exist, run `npm test` before committing.

## Do Not

- Do not use the Pages Router (`pages/` directory).
- Do not use `getServerSideProps`, `getStaticProps`, or `getInitialProps`.
- Do not import server-only code in Client Components.
- Do not use `next/head` — use the Metadata API (`metadata` export or `generateMetadata`).
- Do not install packages without checking if the functionality already exists in Next.js or React.

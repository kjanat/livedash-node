# Refactoring Plan: Integrating tRPC for End-to-End Type Safety

> **Objective:** _Incrementally adopt `tRPC` to replace existing RESTful API endpoints, enhancing type safety, developer experience, and maintainability._
> **Assignee:** _Claude Code_

---

## 1. Overview

This document outlines the step-by-step process for integrating tRPC into the existing Next.js application. The primary goal is to establish a robust, type-safe API layer that simplifies data fetching and mutations between the client and server.

The migration will be performed incrementally to minimize disruption. We will start by setting up the core tRPC infrastructure and then migrate a single, non-critical endpoint to validate the approach.

## 2. Core Concepts & Strategy

### Why tRPC?

- **End-to-End Type Safety:** Eliminates a class of runtime errors by ensuring the client and server conform to the same data contracts. TypeScript errors will appear at build time if the client and server are out of sync.
- **Improved Developer Experience:** Provides autocompletion for API procedures and their data types directly in the editor.
- **Simplified Data Fetching:** Replaces manual `fetch` calls and `useEffect` hooks with clean, declarative tRPC hooks (`useQuery`, `useMutation`).
- **No Code Generation:** Leverages TypeScript inference, avoiding a separate schema definition or code generation step.

### Integration Strategy: Gradual Adoption

1.  **Setup Core Infrastructure:** Install dependencies and configure the tRPC server, client, and providers.
2.  **Create a Test Endpoint:** Implement a simple "hello world" procedure to ensure the setup is working correctly.
3.  **Migrate One Endpoint:** Choose a simple, read-only endpoint (e.g., fetching a list of users) and convert it to a tRPC query.
4.  **Validate and Review:** Confirm that the migrated endpoint works as expected and that the code is clean and idiomatic.
5.  **Continue Migration:** Gradually migrate other endpoints, starting with queries and then moving to mutations.

## 3. Implementation Steps

### Step 1: Install Dependencies

Add the required tRPC packages and `zod` for schema validation.

```bash
pnpm add @trpc/server @trpc/client @trpc/react-query @trpc/next @tanstack/react-query zod
```

### Step 2: Set Up the Backend (Server-Side)

#### A. Create the tRPC Initializer

Create a new file at `lib/trpc/server.ts` to initialize tRPC. This file will export the core `t` object and procedure helpers.

```typescript
// lib/trpc/server.ts
import { initTRPC } from "@trpc/server";
import { db } from "@/lib/prisma"; // Assuming prisma client is here

// Avoid exporting the entire t-object since it's not very descriptive.
const t = initTRPC.create();

// Base router and procedure helpers
export const router = t.router;
export const procedure = t.procedure;
```

#### B. Define the Main App Router

Create a file for the main tRPC router at `lib/trpc/routers/_app.ts`. This router will combine all other sub-routers.

```typescript
// lib/trpc/routers/_app.ts
import { router } from "../server";
import { userRouter } from "./user"; // Example sub-router

export const appRouter = router({
  user: userRouter,
  // Add other routers here as they are created
});

// Export type definition of API
export type AppRouter = typeof appRouter;
```

#### C. Create an Example Sub-Router

Create an example router for user-related endpoints at `lib/trpc/routers/user.ts`.

```typescript
// lib/trpc/routers/user.ts
import { router, procedure } from "../server";
import { z } from "zod";
import { db } from "@/lib/prisma";

export const userRouter = router({
  // Example query to get all users
  list: procedure.query(async () => {
    const users = await db.user.findMany();
    return users;
  }),

  // Example query to get a user by ID
  byId: procedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const user = await db.user.findUnique({ where: { id: input.id } });
    return user;
  }),
});
```

#### D. Create the tRPC API Route Handler

Create the entry point for all tRPC API calls at `app/api/trpc/[trpc]/route.ts`.

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/lib/trpc/routers/_app";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({}), // We will add context later
  });

export { handler as GET, handler as POST };
```

### Step 3: Set Up the Frontend (Client-Side)

#### A. Create the tRPC Client

Create a file at `lib/trpc/client.ts` to configure the client-side hooks.

```typescript
// lib/trpc/client.ts
import { createTRPCReact } from "@trpc/react-query";
import { type AppRouter } from "@/lib/trpc/routers/_app";

export const trpc = createTRPCReact<AppRouter>({});
```

#### B. Create the tRPC Provider

We need a new provider that wraps our app in both a `QueryClientProvider` (from TanStack Query) and the tRPC provider. Create this at `lib/trpc/Provider.tsx`.

```tsx
// lib/trpc/Provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import React, { useState } from "react";
import { trpc } from "./client";
import { getBaseUrl } from "@/lib/utils"; // You might need to create this helper

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({}));
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

!!! note

    Note: You will need a `getBaseUrl` utility function to resolve the correct API URL on the client and server. You can place this in `lib/utils.ts`.

```typescript
// lib/utils.ts

export function getBaseUrl() {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
}
```

#### C. Update the Root Layout and Providers

Wrap the application with the new `TRPCProvider` in `app/providers.tsx`.

```tsx
// app/providers.tsx
"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { TRPCProvider } from "@/lib/trpc/Provider"; // Import the new provider

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TRPCProvider>{children}</TRPCProvider> {/* Wrap with TRPCProvider */}
    </ThemeProvider>
  );
}
```

### Step 4: Use the tRPC Hooks in a Component

Now you can replace a traditional `fetch` call with the new tRPC hook. For example, in a component that displays a list of users:

```tsx
// app/dashboard/users/page.tsx (Example)
"use client";

import { trpc } from "@/lib/trpc/client";

export default function UsersPage() {
  const { data: users, isLoading, error } = trpc.user.list.useQuery();

  if (isLoading) {
    return <div>Loading users...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users?.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 4. Next Steps & Future Enhancements

- **Authentication & Context:** Implement a `createContext` function to pass session data (e.g., from NextAuth.js) to your tRPC procedures. This will allow for protected procedures.
- **Input Validation:** Extensively use `zod` in the `.input()` part of procedures to validate all incoming data.
- **Error Handling:** Implement robust error handling on both the client and server.
- **Mutations:** Begin migrating `POST`, `PUT`, and `DELETE` endpoints to tRPC mutations.
- **Optimistic UI:** For mutations, implement optimistic updates to provide a faster user experience.

---

This structured approach will ensure a smooth and successful integration of tRPC, leading to a more robust and maintainable codebase.

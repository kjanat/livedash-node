---
applyTo: '**/*.{ts,js}'
---


[API reference](https://authjs.dev/reference/overview "API reference")@auth/core

# @auth/core

⚠️

**Experimental** `@auth/core` is under active development.

This is the main entry point to the Auth.js library.

Based on the [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) Web standard APIs. Primarily used to implement [framework](https://authjs.dev/getting-started/integrations)-specific packages, but it can also be used directly.

## Installation

pnpm

```bash
pnpm add @auth/core
```

## Usage

```typescript
import { Auth } from "@auth/core"
 
const request = new Request("https://example.com")
const response = await Auth(request, {...})
 
console.log(response instanceof Response) // true
```

## Resources

-   [Getting started](https://authjs.dev/getting-started)
-   [Guides](https://authjs.dev/guides)

## AuthConfig

Configure the [Auth](https://authjs.dev/reference/corecore#auth) method.

### Example

```typescript
import Auth, { type AuthConfig } from "@auth/core"
 
export const authConfig: AuthConfig = {...}
 
const request = new Request("https://example.com")
const response = await AuthHandler(request, authConfig)
```

### See

[Initialization](https://authjs.dev/reference/core/types#authconfig)

### Extended by

-   [`SolidAuthConfig`](https://authjs.dev/reference/coresolid-start#solidauthconfig)

### Properties

#### adapter?

```typescript
optional adapter: Adapter;
```

You can use the adapter option to pass in your database adapter.

#### basePath?

```typescript
optional basePath: string;
```

The base path of the Auth.js API endpoints.

##### Default

```typescript
"/api/auth" in "next-auth"; "/auth" with all other frameworks
```

#### callbacks?

```typescript
optional callbacks: {
  jwt: (params) => Awaitable<null | JWT>;
  redirect: (params) => Awaitable<string>;
  session: (params) => Awaitable<
     | Session
     | DefaultSession>;
  signIn: (params) => Awaitable<string | boolean>;
};
```

Callbacks are asynchronous functions you can use to control what happens when an action is performed. Callbacks are *extremely powerful*, especially in scenarios involving JSON Web Tokens as they **allow you to implement access controls without a database** and to **integrate with external databases or APIs**.

##### jwt()?

```typescript
optional jwt: (params) => Awaitable<null | JWT>;
```

This callback is called whenever a JSON Web Token is created (i.e. at sign in) or updated (i.e whenever a session is accessed in the client). Anything you return here will be saved in the JWT and forwarded to the session callback. There you can control what should be returned to the client. Anything else will be kept from your frontend. The JWT is encrypted by default via your AUTH_SECRET environment variable.

[`session` callback](https://authjs.dev/reference/core/types#session)

###### Parameters

| Parameter           | Type                                                             | Description                                                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `params`            | { `account`: `null` \| [`Account`](https://authjs.dev/reference/corecore/types#account); `isNewUser`: `boolean`; `profile`: [`Profile`](https://authjs.dev/reference/corecore/types#profile); `session`: `any`; `token`: [`JWT`](https://authjs.dev/reference/corecore/jwt#jwt); `trigger`: `"signIn"`  \| `"signUp"` \| `"update"`; `user`: \| [`User`](https://authjs.dev/reference/corecore/types#user-2) \| [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser); } | - |
| `params.account`?   | `null` \| [`Account`](https://authjs.dev/reference/corecore/types#account) | Contains information about the provider that was used to sign in. Also includes TokenSet **Note** available when `trigger` is `"signIn"` or `"signUp"` |
| `params.isNewUser`? | `boolean` | **Deprecated** use `trigger === "signUp"` instead                                                                                                                                                                                                                                |
| `params.profile`?   | [`Profile`](https://authjs.dev/reference/corecore/types#profile) | The OAuth profile returned from your provider. (In case of OIDC it will be the decoded ID Token or /userinfo response) **Note** available when `trigger` is `"signIn"`.                                                                                                          |
| `params.session`?   | `any` | When using [AuthConfig.session](https://authjs.dev/reference/corecore#session-2) `strategy: "jwt"`, this is the data sent from the client via the `useSession().update` method. ⚠ Note, you should validate this data before using it.                                           |
| `params.token`      | [`JWT`](https://authjs.dev/reference/corecore/jwt#jwt) | When `trigger` is `"signIn"` or `"signUp"`, it will be a subset of [JWT](https://authjs.dev/reference/corecore/jwt#jwt), `name`, `email` and `image` will be included. Otherwise, it will be the full [JWT](https://authjs.dev/reference/corecore/jwt#jwt) for subsequent calls. |
| `params.trigger`?   | `"signIn"` \| `"signUp"` \| `"update"` | Check why was the jwt callback invoked. Possible reasons are: - user sign-in: First time the callback is invoked, `user`, `profile` and `account` will be present. - user sign-up: a user is created for the first time in the database (when [AuthConfig.session](https://authjs.dev/reference/corecore#session-2).strategy is set to `"database"`) - update event: Triggered by the `useSession().update` method. In case of the latter, `trigger` will be `undefined`. |
| `params.user`       | \| [`User`](https://authjs.dev/reference/corecore/types#user-2) \| [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser) | Either the result of the OAuthConfig.profile or the CredentialsConfig.authorize callback. **Note** available when `trigger` is `"signIn"` or `"signUp"`. Resources: - [Credentials Provider](https://authjs.dev/getting-started/authentication/credentials) - [User database model](https://authjs.dev/guides/creating-a-database-adapter#user-management)                                                                                                                |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)<`null` | [`JWT`](https://authjs.dev/reference/corecore/jwt#jwt)>

##### redirect()?

```typescript
optional redirect: (params) => Awaitable<string>;
```

This callback is called anytime the user is redirected to a callback URL (i.e. on signin or signout). By default only URLs on the same host as the origin are allowed. You can use this callback to customise that behaviour.

[Documentation](https://authjs.dev/reference/core/types#redirect)

###### Parameters

| Parameter        | Type                                      | Description                                        |
| ---------------- | ----------------------------------------- | -------------------------------------------------- |
| `params`         | { `baseUrl`: `string`; `url`: `string`; } | -                                                  |
| `params.baseUrl` | `string`                                  | Default base URL of site (can be used as fallback) |
| `params.url`     | `string`                                  | URL provided as callback URL by the client         |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)<`string`>

###### Example

```typescript
callbacks: {
  async redirect({ url, baseUrl }) {
    // Allows relative callback URLs
    if (url.startsWith("/")) return `${baseUrl}${url}`
 
    // Allows callback URLs on the same origin
    if (new URL(url).origin === baseUrl) return url
 
    return baseUrl
  }
}
```

##### session()?

```typescript
optional session: (params) => Awaitable<
  | Session
| DefaultSession>;
```

This callback is called whenever a session is checked. (i.e. when invoking the `/api/session` endpoint, using `useSession` or `getSession`). The return value will be exposed to the client, so be careful what you return here! If you want to make anything available to the client which you’ve added to the token through the JWT callback, you have to explicitly return it here as well.

⚠ By default, only a subset (email, name, image) of the token is returned for increased security.

The token argument is only available when using the jwt session strategy, and the user argument is only available when using the database session strategy.

[`jwt` callback](https://authjs.dev/reference/core/types#jwt)

###### Parameters

| Parameter | Type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `params`  | { `session`: { `user`: [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser); } & [`AdapterSession`](https://authjs.dev/reference/corecore/adapters#adaptersession); `user`: [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser); } & { `session`: [`Session`](https://authjs.dev/reference/corecore/types#session); `token`: [`JWT`](https://authjs.dev/reference/corecore/jwt#jwt); } & { `newSession`: `any`; `trigger`: `"update"`; } |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)< \| [`Session`](https://authjs.dev/reference/corecore/types#session) \| [`DefaultSession`](https://authjs.dev/reference/corecore/types#defaultsession)>

###### Example

```typescript
callbacks: {
  async session({ session, token, user }) {
    // Send properties to the client, like an access_token from a provider.
    session.accessToken = token.accessToken
 
    return session
  }
}
```

##### signIn()?

```typescript
optional signIn: (params) => Awaitable<string | boolean>;
```

Controls whether a user is allowed to sign in or not. Returning `true` continues the sign-in flow. Returning `false` or throwing an error will stop the sign-in flow and redirect the user to the error page. Returning a string will redirect the user to the specified URL.

Unhandled errors will throw an `AccessDenied` with the message set to the original error.

[`AccessDenied`](https://authjs.dev/reference/core/errors#accessdenied)

###### Parameters

| Parameter | Type | Description |
| --- | --- |
| `params`                            | { `account`: `null` \| [`Account`](https://authjs.dev/reference/corecore/types#account); `credentials`: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<`string`, [`CredentialInput`](https://authjs.dev/reference/corecore/providers/credentials#credentialinput)>; `email`: { `verificationRequest`: `boolean`; }; `profile`: [`Profile`](https://authjs.dev/reference/corecore/types#profile); `user`: \| [`User`](https://authjs.dev/reference/corecore/types#user-2) \| [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser); } | - |
| `params.account`?                   | `null` \| [`Account`](https://authjs.dev/reference/corecore/types#account) | - |
| `params.credentials`?               | [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<`string`, [`CredentialInput`](https://authjs.dev/reference/corecore/providers/credentials#credentialinput)> | If Credentials provider is used, it contains the user credentials |
| `params.email`?                     | { `verificationRequest`: `boolean`; } | If Email provider is used, on the first call, it contains a `verificationRequest: true` property to indicate it is being triggered in the verification request flow. When the callback is invoked after a user has clicked on a sign in link, this property will not be present. You can check for the `verificationRequest` property to avoid sending emails to addresses or domains on a blocklist or to only explicitly generate them for email address in an allow list. |
| `params.email.verificationRequest`? | `boolean` | - |
| `params.profile`?                   | [`Profile`](https://authjs.dev/reference/corecore/types#profile) | If OAuth provider is used, it contains the full OAuth profile returned by your provider. |
| `params.user`                       | \| [`User`](https://authjs.dev/reference/corecore/types#user-2) \| [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser) | - |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)<`string` \| `boolean`>

###### Example

```typescript
callbacks: {
 async signIn({ profile }) {
  // Only allow sign in for users with email addresses ending with "yourdomain.com"
  return profile?.email?.endsWith("@yourdomain.com")
 }
}
```

#### cookies?

```typescript
optional cookies: Partial<CookiesOptions>;
```

You can override the default cookie names and options for any of the cookies used by Auth.js. You can specify one or more cookies with custom properties and missing options will use the default values defined by Auth.js. If you use this feature, you will likely want to create conditional behavior to support setting different cookies policies in development and production builds, as you will be opting out of the built-in dynamic policy.

-   ⚠ **This is an advanced option.** Advanced options are passed the same way as basic options, but **may have complex implications** or side effects. You should **try to avoid using advanced options** unless you are very comfortable using them.

##### Default

```typescript
{}
```

#### debug?

```typescript
optional debug: boolean;
```

Set debug to true to enable debug messages for authentication and database operations.

-   ⚠ If you added a custom [AuthConfig.logger](https://authjs.dev/reference/corecore#logger), this setting is ignored.

##### Default

```typescript
false
```

#### events?

```typescript
optional events: {
  createUser: (message) => Awaitable<void>;
  linkAccount: (message) => Awaitable<void>;
  session: (message) => Awaitable<void>;
  signIn: (message) => Awaitable<void>;
  signOut: (message) => Awaitable<void>;
  updateUser: (message) => Awaitable<void>;
};
```

Events are asynchronous functions that do not return a response, they are useful for audit logging. You can specify a handler for any of these events below - e.g. for debugging or to create an audit log. The content of the message object varies depending on the flow (e.g. OAuth or Email authentication flow, JWT or database sessions, etc), but typically contains a user object and/or contents of the JSON Web Token and other information relevant to the event.

##### createUser()?

```typescript
optional createUser: (message) => Awaitable<void>;
```

###### Parameters

| Parameter      | Type                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| `message`      | { `user`: [`User`](https://authjs.dev/reference/corecore/types#user-2); } |
| `message.user` | [`User`](https://authjs.dev/reference/corecore/types#user-2)              |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)<`void`>

##### linkAccount()?

```typescript
optional linkAccount: (message) => Awaitable<void>;
```

###### Parameters

| Parameter         | Type                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `message`         | { `account`: [`Account`](https://authjs.dev/reference/corecore/types#account); `profile`: \| [`User`](https://authjs.dev/reference/corecore/types#user-2) \| [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser); `user`: \| [`User`](https://authjs.dev/reference/corecore/types#user-2) \| [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser); } |
| `message.account` | [`Account`](https://authjs.dev/reference/corecore/types#account)                          |
| `message.profile` | \| [`User`](https://authjs.dev/reference/corecore/types#user-2) \| [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser)          |
| `message.user`    | \| [`User`](https://authjs.dev/reference/corecore/types#user-2) \| [`AdapterUser`](https://authjs.dev/reference/corecore/adapters#adapteruser)          |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)<`void`>

##### session()?

```typescript
optional session: (message) => Awaitable<void>;
```

The message object will contain one of these depending on if you use JWT or database persisted sessions:

-   `token`: The JWT for this session.
-   `session`: The session object from your adapter.

###### Parameters

| Parameter         | Type                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `message`         | { `session`: [`Session`](https://authjs.dev/reference/corecore/types#session); `token`: [`JWT`](https://authjs.dev/reference/corecore/jwt#jwt); } |
| `message.session` | [`Session`](https://authjs.dev/reference/corecore/types#session)                                                                                  |
| `message.token`   | [`JWT`](https://authjs.dev/reference/corecore/jwt#jwt)                                                                                            |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)<`void`>

##### signIn()?

```typescript
optional signIn: (message) => Awaitable<void>;
```

If using a `credentials` type auth, the user is the raw response from your credential provider. For other providers, you’ll get the User object from your adapter, the account, and an indicator if the user was new to your Adapter.

###### Parameters

| Parameter            | Type                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `message`            | { `account`: `null` \| [`Account`](https://authjs.dev/reference/corecore/types#account); `isNewUser`: `boolean`; `profile`: [`Profile`](https://authjs.dev/reference/corecore/types#profile); `user`: [`User`](https://authjs.dev/reference/corecore/types#user-2); } |
| `message.account`?   | `null` \| [`Account`](https://authjs.dev/reference/corecore/types#account)                                                                                                                                                                               |
| `message.isNewUser`? | `boolean`                                                        |
| `message.profile`?   | [`Profile`](https://authjs.dev/reference/corecore/types#profile) |
| `message.user`       | [`User`](https://authjs.dev/reference/corecore/types#user-2)     |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)<`void`>

##### signOut()?

```typescript
optional signOut: (message) => Awaitable<void>;
```

The message object will contain one of these depending on if you use JWT or database persisted sessions:

-   `token`: The JWT for this session.
-   `session`: The session object from your adapter that is being ended.

###### Parameters

| Parameter | Type |
| --------- | ---- |
| `message` | \| { `session`: \| `undefined` \| `null` \| `void` \| [`AdapterSession`](https://authjs.dev/reference/corecore/adapters#adaptersession); } \| { `token`: `null` \| [`JWT`](https://authjs.dev/reference/corecore/jwt#jwt); } |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)<`void`>

##### updateUser()?

```typescript
optional updateUser: (message) => Awaitable<void>;
```

###### Parameters

| Parameter      | Type                                                                      |
| -------------- | ------------------------------------------------------------------------- |
| `message`      | { `user`: [`User`](https://authjs.dev/reference/corecore/types#user-2); } |
| `message.user` | [`User`](https://authjs.dev/reference/corecore/types#user-2)              |

###### Returns

[`Awaitable`](https://authjs.dev/reference/corecore/types#awaitablet)<`void`>

##### Default

```typescript
{}
```

#### experimental?

```typescript
optional experimental: {
  enableWebAuthn: boolean;
};
```

Use this option to enable experimental features. When enabled, it will print a warning message to the console.

##### enableWebAuthn?

```typescript
optional enableWebAuthn: boolean;
```

Enable WebAuthn support.

###### Default

```typescript
false
```

##### Note

Experimental features are not guaranteed to be stable and may change or be removed without notice. Please use with caution.

##### Default

```typescript
{}
```

#### jwt?

```typescript
optional jwt: Partial<JWTOptions>;
```

JSON Web Tokens are enabled by default if you have not specified an [AuthConfig.adapter](https://authjs.dev/reference/corecore#adapter). JSON Web Tokens are encrypted (JWE) by default. We recommend you keep this behaviour.

#### logger?

```typescript
optional logger: Partial<LoggerInstance>;
```

Override any of the logger levels (`undefined` levels will use the built-in logger), and intercept logs in NextAuth. You can use this option to send NextAuth logs to a third-party logging service.

##### Example

```typescript
// /auth.ts
import log from "logging-service"
 
export const { handlers, auth, signIn, signOut } = NextAuth({
  logger: {
    error(code, ...message) {
      log.error(code, message)
    },
    warn(code, ...message) {
      log.warn(code, message)
    },
    debug(code, ...message) {
      log.debug(code, message)
    }
  }
})
```

-   ⚠ When set, the [AuthConfig.debug](https://authjs.dev/reference/corecore#debug) option is ignored

##### Default

```typescript
console
```

#### pages?

```typescript
optional pages: Partial<PagesOptions>;
```

Specify URLs to be used if you want to create custom sign in, sign out and error pages. Pages specified will override the corresponding built-in page.

##### Default

```typescript
{}
```

##### Example

```typescript
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user'
  }
```

#### providers

```typescript
providers: Provider[];
```

List of authentication providers for signing in (e.g. Google, Facebook, Twitter, GitHub, Email, etc) in any order. This can be one of the built-in providers or an object with a custom provider.

##### Default

```typescript
[]
```

#### raw?

```typescript
optional raw: typeof raw;
```

#### redirectProxyUrl?

```typescript
optional redirectProxyUrl: string;
```

When set, during an OAuth sign-in flow, the `redirect_uri` of the authorization request will be set based on this value.

This is useful if your OAuth Provider only supports a single `redirect_uri` or you want to use OAuth on preview URLs (like Vercel), where you don’t know the final deployment URL beforehand.

The url needs to include the full path up to where Auth.js is initialized.

##### Note

This will auto-enable the `state` OAuth2Config.checks on the provider.

##### Examples

```typescript
"https://authjs.example.com/api/auth"
```

You can also override this individually for each provider.

```typescript
GitHub({
  ...
  redirectProxyUrl: "https://github.example.com/api/auth"
})
```

##### Default

`AUTH_REDIRECT_PROXY_URL` environment variable

See also: [Guide: Securing a Preview Deployment](https://authjs.dev/getting-started/deployment#securing-a-preview-deployment)

#### secret?

```typescript
optional secret: string | string[];
```

A random string used to hash tokens, sign cookies and generate cryptographic keys.

To generate a random string, you can use the Auth.js CLI: `npx auth secret`

##### Note

You can also pass an array of secrets, in which case the first secret that successfully decrypts the JWT will be used. This is useful for rotating secrets without invalidating existing sessions. The newer secret should be added to the start of the array, which will be used for all new sessions.

#### session?

```typescript
optional session: {
  generateSessionToken: () => string;
  maxAge: number;
  strategy: "jwt" | "database";
  updateAge: number;
};
```

Configure your session like if you want to use JWT or a database, how long until an idle session expires, or to throttle write operations in case you are using a database.

##### generateSessionToken()?

```typescript
optional generateSessionToken: () => string;
```

Generate a custom session token for database-based sessions. By default, a random UUID or string is generated depending on the Node.js version. However, you can specify your own custom string (such as CUID) to be used.

###### Returns

`string`

###### Default

`randomUUID` or `randomBytes.toHex` depending on the Node.js version

##### maxAge?

```typescript
optional maxAge: number;
```

Relative time from now in seconds when to expire the session

###### Default

```typescript
2592000 // 30 days
```

##### strategy?

```typescript
optional strategy: "jwt" | "database";
```

Choose how you want to save the user session. The default is `"jwt"`, an encrypted JWT (JWE) in the session cookie.

If you use an `adapter` however, we default it to `"database"` instead. You can still force a JWT session by explicitly defining `"jwt"`.

When using `"database"`, the session cookie will only contain a `sessionToken` value, which is used to look up the session in the database.

[Documentation](#authconfig#session) | [Adapter](#authconfig#adapter) | [About JSON Web Tokens](https://authjs.dev/concepts/session-strategies#jwt-session)

##### updateAge?

```typescript
optional updateAge: number;
```

How often the session should be updated in seconds. If set to `0`, session is updated every time.

###### Default

```typescript
86400 // 1 day
```

#### skipCSRFCheck?

```typescript
optional skipCSRFCheck: typeof skipCSRFCheck;
```

#### theme?

```typescript
optional theme: Theme;
```

Changes the theme of built-in [AuthConfig.pages](https://authjs.dev/reference/corecore#pages).

#### trustHost?

```typescript
optional trustHost: boolean;
```

Auth.js relies on the incoming request’s `host` header to function correctly. For this reason this property needs to be set to `true`.

Make sure that your deployment platform sets the `host` header safely.

Official Auth.js-based libraries will attempt to set this value automatically for some deployment platforms (eg.: Vercel) that are known to set the `host` header safely.

#### useSecureCookies?

```typescript
optional useSecureCookies: boolean;
```

When set to `true` then all cookies set by NextAuth.js will only be accessible from HTTPS URLs. This option defaults to `false` on URLs that start with `http://` (e.g. [http://localhost:3000](http://localhost:3000)) for developer convenience. You can manually set this option to `false` to disable this security feature and allow cookies to be accessible from non-secured URLs (this is not recommended).

-   ⚠ **This is an advanced option.** Advanced options are passed the same way as basic options, but **may have complex implications** or side effects. You should **try to avoid using advanced options** unless you are very comfortable using them.

The default is `false` HTTP and `true` for HTTPS sites.

---

## customFetch

```typescript
const customFetch: typeof customFetch;
```

🚫

This option allows you to override the default `fetch` function used by the provider to make requests to the provider’s OAuth endpoints directly. Used incorrectly, it can have security implications.

It can be used to support corporate proxies, custom fetch libraries, cache discovery endpoints, add mocks for testing, logging, set custom headers/params for non-spec compliant providers, etc.

### Example

```typescript
import { Auth, customFetch } from "@auth/core"
import GitHub from "@auth/core/providers/github"
 
const dispatcher = new ProxyAgent("my.proxy.server")
function proxy(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  return undici(args[0], { ...(args[1] ?? {}), dispatcher })
}
 
const response = await Auth(request, {
  providers: [GitHub({ [customFetch]: proxy })]
})
```

### See

-   [https://undici.nodejs.org/#/docs/api/ProxyAgent?id=example-basic-proxy-request-with-local-agent-dispatcher](https://undici.nodejs.org/#/docs/api/ProxyAgent?id=example-basic-proxy-request-with-local-agent-dispatcher)
-   [https://authjs.dev/guides/corporate-proxy](https://authjs.dev/guides/corporate-proxy)

---

## raw

```typescript
const raw: typeof raw;
```

🚫

This option is intended for framework authors.

Auth.js returns a web standard [Response](https://developer.mozilla.org/docs/Web/API/Response) by default, but if you are implementing a framework you might want to get access to the raw internal response by passing this value to [AuthConfig.raw](https://authjs.dev/reference/corecore#raw).

---

## skipCSRFCheck

```typescript
const skipCSRFCheck: typeof skipCSRFCheck;
```

🚫

This option is intended for framework authors.

Auth.js comes with built-in CSRF protection, but if you are implementing a framework that is already protected against CSRF attacks, you can skip this check by passing this value to [AuthConfig.skipCSRFCheck](https://authjs.dev/reference/corecore#skipcsrfcheck).

---

## Auth()

Core functionality provided by Auth.js.

Receives a standard [Request](https://developer.mozilla.org/docs/Web/API/Request) and returns a [Response](https://developer.mozilla.org/docs/Web/API/Response).

### Example

```typescript
import { Auth } from "@auth/core"
 
const request = new Request("https://example.com")
const response = await Auth(request, {
  providers: [Google],
  secret: "...",
  trustHost: true,
})
```

### See

[Documentation](https://authjs.dev)

### Call Signature

```typescript
function Auth(request, config): Promise<ResponseInternal<any>>
```

#### Parameters

| Parameter | Type                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `request` | [`Request`](https://developer.mozilla.org/docs/Web/API/Request)                                                                              |
| `config`  | [`AuthConfig`](https://authjs.dev/reference/corecore#authconfig) & { `raw`: *typeof* [`raw`](https://authjs.dev/reference/corecore#raw-1); } |

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<[`ResponseInternal`](https://authjs.dev/reference/corecore/types#responseinternalbody)<`any`>>

### Call Signature

```typescript
function Auth(request, config): Promise<Response>
```

#### Parameters

| Parameter | Type                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `request` | [`Request`](https://developer.mozilla.org/docs/Web/API/Request)                                                                                                    |
| `config`  | [`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)<[`AuthConfig`](https://authjs.dev/reference/corecore#authconfig), `"raw"`> |

#### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<[`Response`](https://developer.mozilla.org/docs/Web/API/Response)>

---

## createActionURL()

```typescript
function createActionURL(
   action, 
   protocol, 
   headers, 
   envObject, 
   config): URL
```

### Parameters

| Parameter   | Type                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action`    | [`AuthAction`](https://authjs.dev/reference/corecore/types#authaction)                                                                                               |
| `protocol`  | `string`                                                                                                                                                             |
| `headers`   | [`Headers`](https://developer.mozilla.org/docs/Web/API/Headers)                                                                                                      |
| `envObject` | `any`                                                                                                                                                                |
| `config`    | [`Pick`](https://www.typescriptlang.org/docs/handbook/utility-types.html#picktype-keys)<[`AuthConfig`](https://authjs.dev/reference/corecore#authconfig), `"logger"` | `"basePath"`> |

### Returns

[`URL`](https://developer.mozilla.org/docs/Web/API/URL)

---

## isAuthAction()

```typescript
function isAuthAction(action): action is AuthAction
```

### Parameters

| Parameter | Type     |
| --------- | -------- |
| `action`  | `string` |

### Returns

`action is AuthAction`

---

## setEnvDefaults()

```typescript
function setEnvDefaults(
   envObject, 
   config, 
   suppressBasePathWarning): void
```

Set default env variables on the config object

### Parameters

| Parameter                 | Type                                                             | Default value |
| ------------------------- | ---------------------------------------------------------------- | ------------- |
| `envObject`               | `any`                                                            | `undefined`   |
| `config`                  | [`AuthConfig`](https://authjs.dev/reference/corecore#authconfig) | `undefined`   |
| `suppressBasePathWarning` | `boolean`                                                        | `false`       |

### Returns

`void`

---
---


[API reference](https://authjs.dev/reference/overview "API reference")next-auth

# next-auth

*If you are looking to migrate from v4, visit the [Upgrade Guide (v5)](https://authjs.dev/getting-started/migrating-to-v5).*

## Installation

pnpm

```bash
pnpm add next-auth@beta
```

## Environment variable inference

`NEXTAUTH_URL` and `NEXTAUTH_SECRET` have been inferred since v4.

Since NextAuth.js v5 can also automatically infer environment variables that are prefixed with `AUTH_`.

For example `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` will be used as the `clientId` and `clientSecret` options for the GitHub provider.

> 💡
>
> The environment variable name inferring has the following format for OAuth providers: `AUTH_{PROVIDER}_{ID|SECRET}`.
>
> `PROVIDER` is the uppercase snake case version of the provider’s id, followed by either `ID` or `SECRET` respectively.

`AUTH_SECRET` and `AUTH_URL` are also aliased for `NEXTAUTH_SECRET` and `NEXTAUTH_URL` for consistency.

To add social login to your app, the configuration becomes:

auth.ts

```typescript
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
export const { handlers, auth } = NextAuth({ providers: [ GitHub ] })
```

And the `.env.local` file:

.env.local

```typescript
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_SECRET=...
```

💡

In production, `AUTH_SECRET` is a required environment variable - if not set, NextAuth.js will throw an error. See [MissingSecretError](https://authjs.dev/reference/core/errors#missingsecret) for more details.

If you need to override the default values for a provider, you can still call it as a function `GitHub({...})` as before.

## Lazy initialization

You can also initialize NextAuth.js lazily (previously known as advanced intialization), which allows you to access the request context in the configuration in some cases, like Route Handlers, Middleware, API Routes or `getServerSideProps`. The above example becomes:

auth.ts

```typescript
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
export const { handlers, auth } = NextAuth(req => {
 if (req) {
  console.log(req) // do something with the request
 }
 return { providers: [ GitHub ] }
})
```

💡

This is useful if you want to customize the configuration based on the request, for example, to add a different provider in staging/dev environments.

## AuthError

Base error class for all Auth.js errors. It’s optimized to be printed in the server logs in a nicely formatted way via the [`logger.error`](https://authjs.dev/reference/core#logger) option.

### Extends

-   [`Error`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Error)

### Properties

#### cause?

```typescript
optional cause: Record<string, unknown> &amp; {
  err: Error;
};
```

##### Type declaration

###### err?

```typescript
optional err: Error;
```

##### Overrides

`Error.cause`

#### type

```typescript
type: ErrorType;
```

---

## CredentialsSignin

Can be thrown from the `authorize` callback of the Credentials provider. When an error occurs during the `authorize` callback, two things can happen:

1.  The user is redirected to the signin page, with `error=CredentialsSignin&code=credentials` in the URL. `code` is configurable.
2.  If you throw this error in a framework that handles form actions server-side, this error is thrown, instead of redirecting the user, so you’ll need to handle.

### Extends

-   [`SignInError`](https://authjs.dev/reference/nextjscore/errors#signinerror)

### Properties

#### code

```typescript
code: string;
```

The error code that is set in the `code` query parameter of the redirect URL.

⚠ NOTE: This property is going to be included in the URL, so make sure it does not hint at sensitive errors.

The full error is always logged on the server, if you need to debug.

Generally, we don’t recommend hinting specifically if the user had either a wrong username or password specifically, try rather something like “Invalid credentials”.

#### type

```typescript
static type: string;
```

---

## Account

Usually contains information about the provider being used and also extends `TokenSet`, which is different tokens returned by OAuth Providers.

### Extends

-   [`Partial`](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype)<`TokenEndpointResponse`>

### Extended by

-   [`AdapterAccount`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteraccount)

### Indexable

[`key`: `string`]: `undefined` | `JsonValue`

### Properties

#### access_token?

```typescript
readonly optional access_token: string;
```

##### Inherited from

`Partial.access_token`

#### authorization_details?

```typescript
readonly optional authorization_details: AuthorizationDetails[];
```

##### Inherited from

`Partial.authorization_details`

#### expires_at?

```typescript
optional expires_at: number;
```

Calculated value based on TokenEndpointResponse.expires_in.

It is the absolute timestamp (in seconds) when the TokenEndpointResponse.access_token expires.

This value can be used for implementing token rotation together with TokenEndpointResponse.refresh_token.

##### See

-   [https://authjs.dev/guides/refresh-token-rotation#database-strategy](https://authjs.dev/guides/refresh-token-rotation#database-strategy)
-   [https://www.rfc-editor.org/rfc/rfc6749#section-5.1](https://www.rfc-editor.org/rfc/rfc6749#section-5.1)

#### expires_in?

```typescript
readonly optional expires_in: number;
```

##### Inherited from

`Partial.expires_in`

#### id_token?

```typescript
readonly optional id_token: string;
```

##### Inherited from

`Partial.id_token`

#### provider

```typescript
provider: string;
```

Provider’s id for this account. E.g. “google”. See the full list at [https://authjs.dev/reference/core/providers](https://authjs.dev/reference/core/providers)

#### providerAccountId

```typescript
providerAccountId: string;
```

This value depends on the type of the provider being used to create the account.

-   oauth/oidc: The OAuth account’s id, returned from the `profile()` callback.
-   email: The user’s email address.
-   credentials: `id` returned from the `authorize()` callback

#### refresh_token?

```typescript
readonly optional refresh_token: string;
```

##### Inherited from

`Partial.refresh_token`

#### scope?

```typescript
readonly optional scope: string;
```

##### Inherited from

`Partial.scope`

#### token_type?

```typescript
readonly optional token_type: Lowercase<string>;
```

NOTE: because the value is case insensitive it is always returned lowercased

##### Inherited from

`Partial.token_type`

#### type

```typescript
type: ProviderType;
```

Provider’s type for this account

#### userId?

```typescript
optional userId: string;
```

id of the user this account belongs to

##### See

[https://authjs.dev/reference/core/adapters#adapteruser](https://authjs.dev/reference/core/adapters#adapteruser)

---

## DefaultSession

### Extended by

-   [`Session`](https://authjs.dev/reference/nextjsnextjs#session-2)

### Properties

#### expires

```typescript
expires: string;
```

#### user?

```typescript
optional user: User;
```

---

## NextAuthConfig

Configure NextAuth.js.

### Extends

-   [`Omit`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys)<[`AuthConfig`](https://authjs.dev/reference/nextjscore#authconfig), `"raw"`>

### Properties

#### adapter?

```typescript
optional adapter: Adapter;
```

You can use the adapter option to pass in your database adapter.

##### Inherited from

`Omit.adapter`

#### basePath?

```typescript
optional basePath: string;
```

The base path of the Auth.js API endpoints.

##### Default

```typescript
"/api/auth" in "next-auth"; "/auth" with all other frameworks
```

##### Inherited from

`Omit.basePath`

#### callbacks?

```typescript
optional callbacks: {
  jwt: (params) => Awaitable<null | JWT>;
  redirect: (params) => Awaitable<string>;
  session: (params) => Awaitable<
     | Session
     | DefaultSession>;
  signIn: (params) => Awaitable<string | boolean>;
 } &amp; {
  authorized: (params) => any;
};
```

Callbacks are asynchronous functions you can use to control what happens when an auth-related action is performed. Callbacks **allow you to implement access controls without a database** or to **integrate with external databases or APIs**.

##### Type declaration

###### jwt()?

```typescript
optional jwt: (params) => Awaitable<null | JWT>;
```

This callback is called whenever a JSON Web Token is created (i.e. at sign in) or updated (i.e whenever a session is accessed in the client). Anything you return here will be saved in the JWT and forwarded to the session callback. There you can control what should be returned to the client. Anything else will be kept from your frontend. The JWT is encrypted by default via your AUTH_SECRET environment variable.

[`session` callback](https://authjs.dev/reference/core/types#session)

###### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `params` | { `account`: `null` \| [`Account`](https://authjs.dev/reference/nextjsnextjs#account); `isNewUser`: `boolean`; `profile`: [`Profile`](https://authjs.dev/reference/nextjsnextjs#profile); `session`: `any`; `token`: [`JWT`](https://authjs.dev/reference/nextjsnext-auth/jwt#jwt); `trigger`: `"signIn"` \| `"update"` \| `"signUp"`; `user`: \| [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser) \| [`User`](https://authjs.dev/reference/nextjsnextjs#user-2); } | - |
| `params.account`? | `null` \| [`Account`](https://authjs.dev/reference/nextjsnextjs#account) | Contains information about the provider that was used to sign in. Also includes TokenSet **Note** available when `trigger` is `"signIn"` or `"signUp"` |
| `params.isNewUser`? | `boolean` | **Deprecated** use `trigger === "signUp"` instead |
| `params.profile`? | [`Profile`](https://authjs.dev/reference/nextjsnextjs#profile) | The OAuth profile returned from your provider. (In case of OIDC it will be the decoded ID Token or /userinfo response) **Note** available when `trigger` is `"signIn"`. |
| `params.session`? | `any` | When using [AuthConfig.session](https://authjs.dev/reference/nextjscore#session-2) `strategy: "jwt"`, this is the data sent from the client via the `useSession().update` method. ⚠ Note, you should validate this data before using it. |
| `params.token` | [`JWT`](https://authjs.dev/reference/nextjsnext-auth/jwt#jwt) | When `trigger` is `"signIn"` or `"signUp"`, it will be a subset of [JWT](https://authjs.dev/reference/nextjsnext-auth/jwt#jwt), `name`, `email` and `image` will be included. Otherwise, it will be the full [JWT](https://authjs.dev/reference/nextjsnext-auth/jwt#jwt) for subsequent calls. |
| `params.trigger`? | `"signIn"` \| `"update"` \| `"signUp"` | Check why was the jwt callback invoked. Possible reasons are: - user sign-in: First time the callback is invoked, `user`, `profile` and `account` will be present. - user sign-up: a user is created for the first time in the database (when [AuthConfig.session](https://authjs.dev/reference/nextjscore#session-2).strategy is set to `"database"`) - update event: Triggered by the `useSession().update` method. In case of the latter, `trigger` will be `undefined`. |
| `params.user` | \| [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser) \| [`User`](https://authjs.dev/reference/nextjsnextjs#user-2) | Either the result of the OAuthConfig.profile or the CredentialsConfig.authorize callback. **Note** available when `trigger` is `"signIn"` or `"signUp"`. Resources: - [Credentials Provider](https://authjs.dev/getting-started/authentication/credentials) - [User database model](https://authjs.dev/guides/creating-a-database-adapter#user-management) |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<`null` | [`JWT`](https://authjs.dev/reference/nextjsnext-auth/jwt#jwt)>

###### redirect()?

```typescript
optional redirect: (params) => Awaitable<string>;
```

This callback is called anytime the user is redirected to a callback URL (i.e. on signin or signout). By default only URLs on the same host as the origin are allowed. You can use this callback to customise that behaviour.

[Documentation](https://authjs.dev/reference/core/types#redirect)

###### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `params` | { `baseUrl`: `string`; `url`: `string`; } | - |
| `params.baseUrl` | `string` | Default base URL of site (can be used as fallback) |
| `params.url` | `string` | URL provided as callback URL by the client |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<`string`>

###### Example

```typescript
callbacks: {
  async redirect({ url, baseUrl }) {
    // Allows relative callback URLs
    if (url.startsWith("/")) return `${baseUrl}${url}`
 
    // Allows callback URLs on the same origin
    if (new URL(url).origin === baseUrl) return url
 
    return baseUrl
  }
}
```

###### session()?

```typescript
optional session: (params) => Awaitable<
  | Session
| DefaultSession>;
```

This callback is called whenever a session is checked. (i.e. when invoking the `/api/session` endpoint, using `useSession` or `getSession`). The return value will be exposed to the client, so be careful what you return here! If you want to make anything available to the client which you’ve added to the token through the JWT callback, you have to explicitly return it here as well.

⚠ By default, only a subset (email, name, image) of the token is returned for increased security.

The token argument is only available when using the jwt session strategy, and the user argument is only available when using the database session strategy.

[`jwt` callback](https://authjs.dev/reference/core/types#jwt)

###### Parameters

| Parameter | Type |
| --- | --- |
| `params` | { `session`: { `user`: [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser); } & [`AdapterSession`](https://authjs.dev/reference/nextjsnext-auth/adapters#adaptersession); `user`: [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser); } & { `session`: [`Session`](https://authjs.dev/reference/nextjsnextjs#session-2); `token`: [`JWT`](https://authjs.dev/reference/nextjsnext-auth/jwt#jwt); } & { `newSession`: `any`; `trigger`: `"update"`; } |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)< | [`Session`](https://authjs.dev/reference/nextjsnextjs#session-2) | [`DefaultSession`](https://authjs.dev/reference/nextjsnextjs#defaultsession)>

###### Example

```typescript
callbacks: {
  async session({ session, token, user }) {
    // Send properties to the client, like an access_token from a provider.
    session.accessToken = token.accessToken
 
    return session
  }
}
```

###### signIn()?

```typescript
optional signIn: (params) => Awaitable<string | boolean>;
```

Controls whether a user is allowed to sign in or not. Returning `true` continues the sign-in flow. Returning `false` or throwing an error will stop the sign-in flow and redirect the user to the error page. Returning a string will redirect the user to the specified URL.

Unhandled errors will throw an `AccessDenied` with the message set to the original error.

[`AccessDenied`](https://authjs.dev/reference/core/errors#accessdenied)

###### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `params` | { `account`: `null` \| [`Account`](https://authjs.dev/reference/nextjsnextjs#account); `credentials`: [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<`string`, [`CredentialInput`](https://authjs.dev/reference/nextjscore/providers/credentials#credentialinput)>; `email`: { `verificationRequest`: `boolean`; }; `profile`: [`Profile`](https://authjs.dev/reference/nextjsnextjs#profile); `user`: \| [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser) \| [`User`](https://authjs.dev/reference/nextjsnextjs#user-2); } | - |
| `params.account`? | `null` \| [`Account`](https://authjs.dev/reference/nextjsnextjs#account) | - |
| `params.credentials`? | [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<`string`, [`CredentialInput`](https://authjs.dev/reference/nextjscore/providers/credentials#credentialinput)> | If Credentials provider is used, it contains the user credentials |
| `params.email`? | { `verificationRequest`: `boolean`; } | If Email provider is used, on the first call, it contains a `verificationRequest: true` property to indicate it is being triggered in the verification request flow. When the callback is invoked after a user has clicked on a sign in link, this property will not be present. You can check for the `verificationRequest` property to avoid sending emails to addresses or domains on a blocklist or to only explicitly generate them for email address in an allow list. |
| `params.email.verificationRequest`? | `boolean` | - |
| `params.profile`? | [`Profile`](https://authjs.dev/reference/nextjsnextjs#profile) | If OAuth provider is used, it contains the full OAuth profile returned by your provider. |
| `params.user` | \| [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser) \| [`User`](https://authjs.dev/reference/nextjsnextjs#user-2) | - |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<`string` | `boolean`>

###### Example

```typescript
callbacks: {
 async signIn({ profile }) {
  // Only allow sign in for users with email addresses ending with "yourdomain.com"
  return profile?.email?.endsWith("@yourdomain.com")
 }
}
```

##### Type declaration

###### authorized()?

```typescript
optional authorized: (params) => any;
```

Invoked when a user needs authorization, using [Middleware](https://nextjs.org/docs/advanced-features/middleware).

You can override this behavior by returning a NextResponse.

###### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `params` | { `auth`: `null` \| [`Session`](https://authjs.dev/reference/nextjsnextjs#session-2); `request`: `NextRequest`; } | - |
| `params.auth` | `null` \| [`Session`](https://authjs.dev/reference/nextjsnextjs#session-2) | The authenticated user or token, if any. |
| `params.request` | `NextRequest` | The request to be authorized. |

###### Returns

`any`

###### Example

app/auth.ts

```typescript
async authorized({ request, auth }) {
  const url = request.nextUrl
 
  if(request.method === "POST") {
    const { authToken } = (await request.json()) ?? {}
    // If the request has a valid auth token, it is authorized
    const valid = await validateAuthToken(authToken)
    if(valid) return true
    return NextResponse.json("Invalid auth token", { status: 401 })
  }
 
  // Logged in users are authenticated, otherwise redirect to login page
  return !!auth.user
}
```

⚠️

If you are returning a redirect response, make sure that the page you are redirecting to is not protected by this callback, otherwise you could end up in an infinite redirect loop.

##### Overrides

`Omit.callbacks`

#### cookies?

```typescript
optional cookies: Partial<CookiesOptions>;
```

You can override the default cookie names and options for any of the cookies used by Auth.js. You can specify one or more cookies with custom properties and missing options will use the default values defined by Auth.js. If you use this feature, you will likely want to create conditional behavior to support setting different cookies policies in development and production builds, as you will be opting out of the built-in dynamic policy.

-   ⚠ **This is an advanced option.** Advanced options are passed the same way as basic options, but **may have complex implications** or side effects. You should **try to avoid using advanced options** unless you are very comfortable using them.

##### Default

```typescript
{}
```

##### Inherited from

`Omit.cookies`

#### debug?

```typescript
optional debug: boolean;
```

Set debug to true to enable debug messages for authentication and database operations.

-   ⚠ If you added a custom [AuthConfig.logger](https://authjs.dev/reference/nextjscore#logger), this setting is ignored.

##### Default

```typescript
false
```

##### Inherited from

`Omit.debug`

#### events?

```typescript
optional events: {
  createUser: (message) => Awaitable<void>;
  linkAccount: (message) => Awaitable<void>;
  session: (message) => Awaitable<void>;
  signIn: (message) => Awaitable<void>;
  signOut: (message) => Awaitable<void>;
  updateUser: (message) => Awaitable<void>;
};
```

Events are asynchronous functions that do not return a response, they are useful for audit logging. You can specify a handler for any of these events below - e.g. for debugging or to create an audit log. The content of the message object varies depending on the flow (e.g. OAuth or Email authentication flow, JWT or database sessions, etc), but typically contains a user object and/or contents of the JSON Web Token and other information relevant to the event.

##### createUser()?

```typescript
optional createUser: (message) => Awaitable<void>;
```

###### Parameters

| Parameter | Type |
| --- | --- |
| `message` | { `user`: [`User`](https://authjs.dev/reference/nextjsnextjs#user-2); } |
| `message.user` | [`User`](https://authjs.dev/reference/nextjsnextjs#user-2) |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<`void`>

##### linkAccount()?

```typescript
optional linkAccount: (message) => Awaitable<void>;
```

###### Parameters

| Parameter | Type |
| --- | --- |
| `message` | { `account`: [`Account`](https://authjs.dev/reference/nextjsnextjs#account); `profile`: \| [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser) \| [`User`](https://authjs.dev/reference/nextjsnextjs#user-2); `user`: \| [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser) \| [`User`](https://authjs.dev/reference/nextjsnextjs#user-2); } |
| `message.account` | [`Account`](https://authjs.dev/reference/nextjsnextjs#account) |
| `message.profile` | \| [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser) \| [`User`](https://authjs.dev/reference/nextjsnextjs#user-2) |
| `message.user` | \| [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser) \| [`User`](https://authjs.dev/reference/nextjsnextjs#user-2) |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<`void`>

##### session()?

```typescript
optional session: (message) => Awaitable<void>;
```

The message object will contain one of these depending on if you use JWT or database persisted sessions:

-   `token`: The JWT for this session.
-   `session`: The session object from your adapter.

###### Parameters

| Parameter | Type |
| --- | --- |
| `message` | { `session`: [`Session`](https://authjs.dev/reference/nextjsnextjs#session-2); `token`: [`JWT`](https://authjs.dev/reference/nextjsnext-auth/jwt#jwt); } |
| `message.session` | [`Session`](https://authjs.dev/reference/nextjsnextjs#session-2) |
| `message.token` | [`JWT`](https://authjs.dev/reference/nextjsnext-auth/jwt#jwt) |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<`void`>

##### signIn()?

```typescript
optional signIn: (message) => Awaitable<void>;
```

If using a `credentials` type auth, the user is the raw response from your credential provider. For other providers, you’ll get the User object from your adapter, the account, and an indicator if the user was new to your Adapter.

###### Parameters

| Parameter | Type |
| --- | --- |
| `message` | { `account`: `null` \| [`Account`](https://authjs.dev/reference/nextjsnextjs#account); `isNewUser`: `boolean`; `profile`: [`Profile`](https://authjs.dev/reference/nextjsnextjs#profile); `user`: [`User`](https://authjs.dev/reference/nextjsnextjs#user-2); } |
| `message.account`? | `null` \| [`Account`](https://authjs.dev/reference/nextjsnextjs#account) |
| `message.isNewUser`? | `boolean` |
| `message.profile`? | [`Profile`](https://authjs.dev/reference/nextjsnextjs#profile) |
| `message.user` | [`User`](https://authjs.dev/reference/nextjsnextjs#user-2) |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<`void`>

##### signOut()?

```typescript
optional signOut: (message) => Awaitable<void>;
```

The message object will contain one of these depending on if you use JWT or database persisted sessions:

-   `token`: The JWT for this session.
-   `session`: The session object from your adapter that is being ended.

###### Parameters

| Parameter | Type |
| --- | --- |
| `message` | \| { `session`: \| `undefined` \| `null` \| `void` \| [`AdapterSession`](https://authjs.dev/reference/nextjsnext-auth/adapters#adaptersession); } \| { `token`: `null` \| [`JWT`](https://authjs.dev/reference/nextjsnext-auth/jwt#jwt); } |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<`void`>

##### updateUser()?

```typescript
optional updateUser: (message) => Awaitable<void>;
```

###### Parameters

| Parameter | Type |
| --- | --- |
| `message` | { `user`: [`User`](https://authjs.dev/reference/nextjsnextjs#user-2); } |
| `message.user` | [`User`](https://authjs.dev/reference/nextjsnextjs#user-2) |

###### Returns

[`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<`void`>

##### Default

```typescript
{}
```

##### Inherited from

`Omit.events`

#### experimental?

```typescript
optional experimental: {
  enableWebAuthn: boolean;
};
```

Use this option to enable experimental features. When enabled, it will print a warning message to the console.

##### enableWebAuthn?

```typescript
optional enableWebAuthn: boolean;
```

Enable WebAuthn support.

###### Default

```typescript
false
```

##### Note

Experimental features are not guaranteed to be stable and may change or be removed without notice. Please use with caution.

##### Default

```typescript
{}
```

##### Inherited from

`Omit.experimental`

#### jwt?

```typescript
optional jwt: Partial<JWTOptions>;
```

JSON Web Tokens are enabled by default if you have not specified an [AuthConfig.adapter](https://authjs.dev/reference/nextjscore#adapter). JSON Web Tokens are encrypted (JWE) by default. We recommend you keep this behaviour.

##### Inherited from

`Omit.jwt`

#### logger?

```typescript
optional logger: Partial<LoggerInstance>;
```

Override any of the logger levels (`undefined` levels will use the built-in logger), and intercept logs in NextAuth. You can use this option to send NextAuth logs to a third-party logging service.

##### Example

```typescript
// /auth.ts
import log from "logging-service"
 
export const { handlers, auth, signIn, signOut } = NextAuth({
  logger: {
    error(code, ...message) {
      log.error(code, message)
    },
    warn(code, ...message) {
      log.warn(code, message)
    },
    debug(code, ...message) {
      log.debug(code, message)
    }
  }
})
```

-   ⚠ When set, the [AuthConfig.debug](https://authjs.dev/reference/nextjscore#debug) option is ignored

##### Default

```typescript
console
```

##### Inherited from

`Omit.logger`

#### pages?

```typescript
optional pages: Partial<PagesOptions>;
```

Specify URLs to be used if you want to create custom sign in, sign out and error pages. Pages specified will override the corresponding built-in page.

##### Default

```typescript
{}
```

##### Example

```typescript
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user'
  }
```

##### Inherited from

`Omit.pages`

#### providers

```typescript
providers: Provider[];
```

List of authentication providers for signing in (e.g. Google, Facebook, Twitter, GitHub, Email, etc) in any order. This can be one of the built-in providers or an object with a custom provider.

##### Default

```typescript
[]
```

##### Inherited from

`Omit.providers`

#### redirectProxyUrl?

```typescript
optional redirectProxyUrl: string;
```

When set, during an OAuth sign-in flow, the `redirect_uri` of the authorization request will be set based on this value.

This is useful if your OAuth Provider only supports a single `redirect_uri` or you want to use OAuth on preview URLs (like Vercel), where you don’t know the final deployment URL beforehand.

The url needs to include the full path up to where Auth.js is initialized.

##### Note

This will auto-enable the `state` OAuth2Config.checks on the provider.

##### Examples

```typescript
"https://authjs.example.com/api/auth"
```

You can also override this individually for each provider.

```typescript
GitHub({
  ...
  redirectProxyUrl: "https://github.example.com/api/auth"
})
```

##### Default

`AUTH_REDIRECT_PROXY_URL` environment variable

See also: [Guide: Securing a Preview Deployment](https://authjs.dev/getting-started/deployment#securing-a-preview-deployment)

##### Inherited from

`Omit.redirectProxyUrl`

#### secret?

```typescript
optional secret: string | string[];
```

A random string used to hash tokens, sign cookies and generate cryptographic keys.

To generate a random string, you can use the Auth.js CLI: `npx auth secret`

##### Note

You can also pass an array of secrets, in which case the first secret that successfully decrypts the JWT will be used. This is useful for rotating secrets without invalidating existing sessions. The newer secret should be added to the start of the array, which will be used for all new sessions.

##### Inherited from

`Omit.secret`

#### session?

```typescript
optional session: {
  generateSessionToken: () => string;
  maxAge: number;
  strategy: "jwt" | "database";
  updateAge: number;
};
```

Configure your session like if you want to use JWT or a database, how long until an idle session expires, or to throttle write operations in case you are using a database.

##### generateSessionToken()?

```typescript
optional generateSessionToken: () => string;
```

Generate a custom session token for database-based sessions. By default, a random UUID or string is generated depending on the Node.js version. However, you can specify your own custom string (such as CUID) to be used.

###### Returns

`string`

###### Default

`randomUUID` or `randomBytes.toHex` depending on the Node.js version

##### maxAge?

```typescript
optional maxAge: number;
```

Relative time from now in seconds when to expire the session

###### Default

```typescript
2592000 // 30 days
```

##### strategy?

```typescript
optional strategy: "jwt" | "database";
```

Choose how you want to save the user session. The default is `"jwt"`, an encrypted JWT (JWE) in the session cookie.

If you use an `adapter` however, we default it to `"database"` instead. You can still force a JWT session by explicitly defining `"jwt"`.

When using `"database"`, the session cookie will only contain a `sessionToken` value, which is used to look up the session in the database.

[Documentation](https://authjs.dev/reference/core#authconfig#session) | [Adapter](https://authjs.dev/reference/core#authconfig#adapter) | [About JSON Web Tokens](https://authjs.dev/concepts/session-strategies#jwt-session)

##### updateAge?

```typescript
optional updateAge: number;
```

How often the session should be updated in seconds. If set to `0`, session is updated every time.

###### Default

```typescript
86400 // 1 day
```

##### Inherited from

`Omit.session`

#### skipCSRFCheck?

```typescript
optional skipCSRFCheck: typeof skipCSRFCheck;
```

##### Inherited from

`Omit.skipCSRFCheck`

#### theme?

```typescript
optional theme: Theme;
```

Changes the theme of built-in [AuthConfig.pages](https://authjs.dev/reference/nextjscore#pages).

##### Inherited from

`Omit.theme`

#### trustHost?

```typescript
optional trustHost: boolean;
```

Auth.js relies on the incoming request’s `host` header to function correctly. For this reason this property needs to be set to `true`.

Make sure that your deployment platform sets the `host` header safely.

Official Auth.js-based libraries will attempt to set this value automatically for some deployment platforms (eg.: Vercel) that are known to set the `host` header safely.

##### Inherited from

`Omit.trustHost`

#### useSecureCookies?

```typescript
optional useSecureCookies: boolean;
```

When set to `true` then all cookies set by NextAuth.js will only be accessible from HTTPS URLs. This option defaults to `false` on URLs that start with `http://` (e.g. [http://localhost:3000](http://localhost:3000)) for developer convenience. You can manually set this option to `false` to disable this security feature and allow cookies to be accessible from non-secured URLs (this is not recommended).

-   ⚠ **This is an advanced option.** Advanced options are passed the same way as basic options, but **may have complex implications** or side effects. You should **try to avoid using advanced options** unless you are very comfortable using them.

The default is `false` HTTP and `true` for HTTPS sites.

##### Inherited from

`Omit.useSecureCookies`

---

## NextAuthRequest

### Extends

-   `unknown`

### Properties

#### auth

```typescript
auth: null | Session;
```

---

## NextAuthResult

The result of invoking [NextAuth](https://authjs.dev/reference/nextjsnextjs#default), initialized with the [NextAuthConfig](https://authjs.dev/reference/nextjsnextjs#nextauthconfig). It contains methods to set up and interact with NextAuth.js in your Next.js app.

### Properties

#### auth

```typescript
auth: (...args) => Promise<null | Session> &amp; (...args) => Promise<null | Session> &amp; (...args) => Promise<null | Session> &amp; (...args) => AppRouteHandlerFn;
```

A universal method to interact with NextAuth.js in your Next.js app. After initializing NextAuth.js in `auth.ts`, use this method in Middleware, Server Components, Route Handlers (`app/`), and Edge or Node.js API Routes (`pages/`).

#### In Middleware

Adding `auth` to your Middleware is optional, but recommended to keep the user session alive.

Authentication is done by the [callbacks.authorized](https://authjs.dev/reference/nextjsnextjs#callbacks) callback.

##### Examples

middleware.ts

```typescript
export { auth as middleware } from "./auth"
```

Alternatively you can wrap your own middleware with `auth`, where `req` is extended with `auth`:

middleware.ts

```typescript
import { auth } from "./auth"
export default auth((req) => {
  // req.auth
})
```

```typescript
// Optionally, don't invoke Middleware on some paths
// Read more: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

#### In Server Components

app/page.ts

```typescript
import { auth } from "../auth"
 
export default async function Page() {
  const { user } = await auth()
  return <p>Hello {user?.name}</p>
}
```

#### In Route Handlers

app/api/route.ts

```typescript
import { auth } from "../../auth"
 
export const POST = auth((req) => {
  // req.auth
})
```

#### In Edge API Routes

pages/api/protected.ts

```typescript
import { auth } from "../../auth"
 
export default auth((req) => {
  // req.auth
})
 
export const config = { runtime: "edge" }
```

#### In API Routes

pages/api/protected.ts

```typescript
import { auth } from "../auth"
import type { NextApiRequest, NextApiResponse } from "next"
 
export default async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await auth(req, res)
  if (session) {
    // Do something with the session
    return res.json("This is protected content.")
  }
  res.status(401).json("You must be signed in.")
}
```

#### In `getServerSideProps`

pages/protected-ssr.ts

```typescript
import { auth } from "../auth"
 
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await auth(context)
 
  if (session) {
    // Do something with the session
    return { props: { session, content: (await res.json()).content } }
  }
 
  return { props: {} }
}
```

#### handlers

```typescript
handlers: AppRouteHandlers;
```

The NextAuth.js [Route Handler](https://beta.nextjs.org/docs/routing/route-handlers) methods. These are used to expose an endpoint for OAuth/Email providers, as well as REST API endpoints (such as `/api/auth/session`) that can be contacted from the client.

After initializing NextAuth.js in `auth.ts`, re-export these methods.

In `app/api/auth/[...nextauth]/route.ts`:

app/api/auth/[...nextauth]/route.ts

```typescript
export { GET, POST } from "../../../../auth"
export const runtime = "edge" // optional
```

Then `auth.ts`:

auth.ts

```typescript
// ...
export const { handlers: { GET, POST }, auth } = NextAuth({...})
```

#### signIn()

```typescript
signIn: <P, R>(provider?, options?, authorizationParams?) => Promise<R extends false ? any : never>;
```

Sign in with a provider. If no provider is specified, the user will be redirected to the sign in page.

By default, the user is redirected to the current page after signing in. You can override this behavior by setting the `redirectTo` option with a relative path.

##### Type Parameters

| Type Parameter | Default type |
| --- | --- |
| `P` *extends* [`ProviderId`](https://authjs.dev/reference/nextjscore/providers#providerid) | - |
| `R` *extends* `boolean` | `true` |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `provider`? | `P` | Provider to sign in to |
| `options`? | \| [`FormData`](https://developer.mozilla.org/docs/Web/API/FormData) \| { `redirect`: `R`; `redirectTo`: `string`; } & [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<`string`, `any`> | - |
| `authorizationParams`? | \| `string` \| [`Record`](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeys-type)<`string`, `string`> \| [`URLSearchParams`](https://developer.mozilla.org/docs/Web/API/URLSearchParams) \| `string`[][] | - |

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`R` *extends* `false` ? `any` : `never`>

##### Example

app/layout.tsx

```tsx
import { signIn } from "../auth"
 
export default function Layout() {
 return (
  <form action={async () => {
    "use server"
    await signIn("github")
  }}>
   <button>Sign in with GitHub</button>
  </form>
)
```

If an error occurs during signin, an instance of [AuthError](https://authjs.dev/reference/nextjsnextjs#autherror) will be thrown. You can catch it like this:

app/layout.tsx

```tsx
import { AuthError } from "next-auth"
import { signIn } from "../auth"
 
export default function Layout() {
 return (
   <form action={async (formData) => {
     "use server"
     try {
       await signIn("credentials", formData)
    } catch(error) {
      if (error instanceof AuthError) // Handle auth errors
      throw error // Rethrow all other errors
    }
   }}>
    <button>Sign in</button>
  </form>
 )
}
```

#### signOut()

```typescript
signOut: <R>(options?) => Promise<R extends false ? any : never>;
```

Sign out the user. If the session was created using a database strategy, the session will be removed from the database and the related cookie is invalidated. If the session was created using a JWT, the cookie is invalidated.

By default the user is redirected to the current page after signing out. You can override this behavior by setting the `redirectTo` option with a relative path.

##### Type Parameters

| Type Parameter | Default type |
| --- | --- |
| `R` *extends* `boolean` | `true` |

##### Parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `options`? | { `redirect`: `R`; `redirectTo`: `string`; } | - |
| `options.redirect`? | `R` | If set to `false`, the `signOut` method will return the URL to redirect to instead of redirecting automatically. |
| `options.redirectTo`? | `string` | The relative path to redirect to after signing out. By default, the user is redirected to the current page. |

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`R` *extends* `false` ? `any` : `never`>

##### Example

app/layout.tsx

```tsx
import { signOut } from "../auth"
 
export default function Layout() {
 return (
  <form action={async () => {
    "use server"
    await signOut()
  }}>
   <button>Sign out</button>
  </form>
)
```

#### unstable_update()

```typescript
unstable_update: (data) => Promise<null | Session>;
```

##### Parameters

| Parameter | Type |
| --- | --- |
| `data` | [`Partial`](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype)< \| [`Session`](https://authjs.dev/reference/nextjsnextjs#session-2) \| { `user`: [`Partial`](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype)<`undefined` \| [`User`](https://authjs.dev/reference/nextjsnextjs#user-2)>; }> |

##### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`null` | [`Session`](https://authjs.dev/reference/nextjsnextjs#session-2)>

---

## Profile

The user info returned from your OAuth provider.

### See

[https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims)

### Indexable

[`claim`: `string`]: `unknown`

### Properties

#### address?

```typescript
optional address: 
  | null
  | {
  country: null | string;
  formatted: null | string;
  locality: null | string;
  postal_code: null | string;
  region: null | string;
  street_address: null | string;
};
```

#### birthdate?

```typescript
optional birthdate: null | string;
```

#### email?

```typescript
optional email: null | string;
```

#### email_verified?

```typescript
optional email_verified: null | boolean;
```

#### family_name?

```typescript
optional family_name: null | string;
```

#### gender?

```typescript
optional gender: null | string;
```

#### given_name?

```typescript
optional given_name: null | string;
```

#### id?

```typescript
optional id: null | string;
```

#### locale?

```typescript
optional locale: null | string;
```

#### middle_name?

```typescript
optional middle_name: null | string;
```

#### name?

```typescript
optional name: null | string;
```

#### nickname?

```typescript
optional nickname: null | string;
```

#### phone_number?

```typescript
optional phone_number: null | string;
```

#### picture?

```typescript
optional picture: any;
```

#### preferred_username?

```typescript
optional preferred_username: null | string;
```

#### profile?

```typescript
optional profile: null | string;
```

#### sub?

```typescript
optional sub: null | string;
```

#### updated_at?

```typescript
optional updated_at: 
  | null
  | string
  | number
  | Date;
```

#### website?

```typescript
optional website: null | string;
```

#### zoneinfo?

```typescript
optional zoneinfo: null | string;
```

---

## Session

The active session of the logged in user.

### Extends

-   [`DefaultSession`](https://authjs.dev/reference/nextjsnextjs#defaultsession)

### Properties

#### expires

```typescript
expires: string;
```

##### Inherited from

[`DefaultSession`](https://authjs.dev/reference/nextjsnextjs#defaultsession).[`expires`](https://authjs.dev/reference/nextjsnextjs#expires)

#### user?

```typescript
optional user: User;
```

##### Inherited from

[`DefaultSession`](https://authjs.dev/reference/nextjsnextjs#defaultsession).[`user`](https://authjs.dev/reference/nextjsnextjs#user)

---

## User

The shape of the returned object in the OAuth providers’ `profile` callback, available in the `jwt` and `session` callbacks, or the second parameter of the `session` callback, when using a database.

### Extends

-   [`DefaultUser`](https://authjs.dev/reference/nextjscore/types#defaultuser)

### Extended by

-   [`AdapterUser`](https://authjs.dev/reference/nextjsnext-auth/adapters#adapteruser)

### Properties

#### email?

```typescript
optional email: null | string;
```

##### Inherited from

[`DefaultUser`](https://authjs.dev/reference/nextjscore/types#defaultuser).[`email`](https://authjs.dev/reference/nextjscore/types#email)

#### id?

```typescript
optional id: string;
```

##### Inherited from

[`DefaultUser`](https://authjs.dev/reference/nextjscore/types#defaultuser).[`id`](https://authjs.dev/reference/nextjscore/types#id)

#### image?

```typescript
optional image: null | string;
```

##### Inherited from

[`DefaultUser`](https://authjs.dev/reference/nextjscore/types#defaultuser).[`image`](https://authjs.dev/reference/nextjscore/types#image)

#### name?

```typescript
optional name: null | string;
```

##### Inherited from

[`DefaultUser`](https://authjs.dev/reference/nextjscore/types#defaultuser).[`name`](https://authjs.dev/reference/nextjscore/types#name-1)

---

## customFetch

```typescript
const customFetch: unique symbol;
```

🚫

This option allows you to override the default `fetch` function used by the provider to make requests to the provider’s OAuth endpoints directly. Used incorrectly, it can have security implications.

It can be used to support corporate proxies, custom fetch libraries, cache discovery endpoints, add mocks for testing, logging, set custom headers/params for non-spec compliant providers, etc.

### Example

```typescript
import { Auth, customFetch } from "@auth/core"
import GitHub from "@auth/core/providers/github"
 
const dispatcher = new ProxyAgent("my.proxy.server")
function proxy(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  return undici(args[0], { ...(args[1] ?? {}), dispatcher })
}
 
const response = await Auth(request, {
  providers: [GitHub({ [customFetch]: proxy })]
})
```

### See

-   [https://undici.nodejs.org/#/docs/api/ProxyAgent?id=example-basic-proxy-request-with-local-agent-dispatcher](https://undici.nodejs.org/#/docs/api/ProxyAgent?id=example-basic-proxy-request-with-local-agent-dispatcher)
-   [https://authjs.dev/guides/corporate-proxy](https://authjs.dev/guides/corporate-proxy)

---

## default()

```typescript
function default(config): NextAuthResult
```

Initialize NextAuth.js.

### Parameters

| Parameter | Type |
| --- | --- |
| `config` | \| [`NextAuthConfig`](https://authjs.dev/reference/nextjsnextjs#nextauthconfig) \| (`request`) => [`Awaitable`](https://authjs.dev/reference/nextjscore/types#awaitablet)<[`NextAuthConfig`](https://authjs.dev/reference/nextjsnextjs#nextauthconfig)> |

### Returns

[`NextAuthResult`](https://authjs.dev/reference/nextjsnextjs#nextauthresult)

### Examples

auth.ts

```typescript
import NextAuth from "next-auth"
import GitHub from "@auth/core/providers/github"
 
export const { handlers, auth } = NextAuth({ providers: [GitHub] })
```

Lazy initialization:

auth.ts

```typescript
import NextAuth from "next-auth"
import GitHub from "@auth/core/providers/github"
 
export const { handlers, auth } = NextAuth(async (req) => {
  console.log(req) // do something with the request
  return {
    providers: [GitHub],
  },
})
```

---
---


[API reference](https://authjs.dev/reference/overview "API reference")

# @auth/d1-adapter

An official [Cloudflare D1](https://developers.cloudflare.com/d1/) adapter for Auth.js / NextAuth.js.

## Warning

This adapter is not developed or maintained by Cloudflare and they haven’t declared the D1 api stable. The author will make an effort to keep this adapter up to date. The adapter is compatible with the D1 api as of March 22, 2023.

## Installation

```bash
pnpm add next-auth @auth/d1-adapter
```

## D1Database

```typescript
type D1Database = WorkerDatabase | MiniflareD1Database;
```

---

## createRecord()

```typescript
function createRecord<RecordType>(
   db, 
   CREATE_SQL, 
   bindings, 
   GET_SQL, 
getBindings): Promise<null | RecordType>
```

### Type Parameters

| Type Parameter |
| -------------- |
| `RecordType`   |

### Parameters

| Parameter     | Type                        |
| ------------- | --------------------------- |
| `db`          | [`D1Database`](#d1database) |
| `CREATE_SQL`  | `string`                    |
| `bindings`    | `any`[]                     |
| `GET_SQL`     | `string`                    |
| `getBindings` | `any`[]                     |

### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`null` | `RecordType`>

---

## D1Adapter()

```typescript
function D1Adapter(db): Adapter
```

### Parameters

| Parameter | Type                        |
| --------- | --------------------------- |
| `db`      | [`D1Database`](#d1database) |

### Returns

[`Adapter`](https://authjs.dev/reference/d1-adaptercore/adapters#adapter)

---

## deleteRecord()

```typescript
function deleteRecord(
   db, 
   SQL, 
bindings): Promise<void>
```

### Parameters

| Parameter  | Type                        |
| ---------- | --------------------------- |
| `db`       | [`D1Database`](#d1database) |
| `SQL`      | `string`                    |
| `bindings` | `any`[]                     |

### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`void`>

---

## getRecord()

```typescript
function getRecord<RecordType>(
   db, 
   SQL, 
bindings): Promise<null | RecordType>
```

### Type Parameters

| Type Parameter |
| -------------- |
| `RecordType`   |

### Parameters

| Parameter  | Type                        |
| ---------- | --------------------------- |
| `db`       | [`D1Database`](#d1database) |
| `SQL`      | `string`                    |
| `bindings` | `any`[]                     |

### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`null` | `RecordType`>

---

## up()

```typescript
function up(db): Promise<void>
```

### Parameters

| Parameter | Type                        |
| --------- | --------------------------- |
| `db`      | [`D1Database`](#d1database) |

### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`void`>

---

## updateRecord()

```typescript
function updateRecord(
   db, 
   SQL, 
bindings): Promise<D1Result<unknown> | D1Result<unknown>>
```

### Parameters

| Parameter  | Type                        |
| ---------- | --------------------------- |
| `db`       | [`D1Database`](#d1database) |
| `SQL`      | `string`                    |
| `bindings` | `any`[]                     |

### Returns

[`Promise`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)<`D1Result`<`unknown`> | `D1Result`<`unknown`>>

[fig1]: https://authjs.dev/img/adapters/d1.svg

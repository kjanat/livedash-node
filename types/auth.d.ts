import { DefaultSession } from "next-auth";

declare module "next-auth" {
    /**
     * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */
    interface Session {
        user: {
            /** The user's unique id. */
            id: string;
            /** The user's role (admin, user, etc.) */
            role: string;
            /** The user's company ID */
            companyId: string;
            /** The user's company name */
            company: string;
        } & DefaultSession["user"];
    }

    /**
     * The shape of the user object returned in the OAuth providers' `profile` callback,
     * or the second parameter of the `session` callback, when using a database.
     */
    interface User {
        /** The user's unique id. */
        id: string;
        /** The user's email address. */
        email?: string;
        /** The user's name. */
        name?: string;
        /** The user's role (admin, user, etc.) */
        role: string;
        /** The user's company ID */
        companyId: string;
        /** The user's company name */
        company: string;
    }
}

declare module "next-auth/jwt" {
    /** Returned by the `jwt` callback and `auth`, when using JWT sessions */
    interface JWT {
        /** The user's role */
        role: string;
        /** The user's company ID */
        companyId: string;
        /** The user's company name */
        company: string;
    }
}

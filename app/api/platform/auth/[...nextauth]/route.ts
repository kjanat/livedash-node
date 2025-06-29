import NextAuth from "next-auth";
import { platformAuthOptions } from "../../../../../lib/platform-auth";

const handler = NextAuth(platformAuthOptions);

export { handler as GET, handler as POST };

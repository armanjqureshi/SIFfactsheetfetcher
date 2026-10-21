import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";
import { getLocalUser } from "./localMode";
import { passwordRequired, requestHasPasswordSession } from "./passwordGate";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    if (ENV.localMode) {
      const allowed = !passwordRequired() || (await requestHasPasswordSession(opts.req));
      user = allowed ? await getLocalUser() : null;
    } else {
      user = await sdk.authenticateRequest(opts.req);
    }
  } catch (error) {
    if (ENV.localMode) console.error("[Local mode] Could not load the local user:", error);
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

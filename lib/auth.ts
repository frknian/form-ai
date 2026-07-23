import type { User } from "@supabase/supabase-js";

export function isVerifiedAuthUser(user: User | null | undefined): user is User {
  return Boolean(user?.email_confirmed_at);
}

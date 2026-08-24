"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Las invitaciones y recuperaciones administrativas llegan con tokens
      // en el fragmento. LoginForm los procesa de forma explicita y los
      // elimina antes de permitir que el usuario establezca su contrasena.
      auth: { detectSessionInUrl: false },
    },
  );
}

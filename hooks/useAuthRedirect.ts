// hooks/useAuthRedirect.ts
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function useAuthRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const publicPaths = ["/login", "/signup"];
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session && !publicPaths.includes(pathname)) {
        router.push("/login");
      }
    };

    checkSession();
  }, []);
}

// hooks/useAuthRoles.ts
'use client';

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuthProfile from "@/hooks/useAuthProfile";

type Role = {
  user_role_id: string;
  user_id: string;
  role_type_id: string;
};

export default function useAuthRoles() {
  const { userInfo, loading: profileLoading } = useAuthProfile();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      if (!userInfo?.user_id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("userrole")
        .select("*")
        .eq("user_id", userInfo.user_id);  

      if (error) {
        console.error("Error fetching roles:", error.message);
      } else {
        setRoles(data || []);
      }
      setLoading(false);
    };

    if (!profileLoading) {
      fetchRoles();
    }
  }, [userInfo?.user_id, profileLoading]);

  return { roles, loading };
}
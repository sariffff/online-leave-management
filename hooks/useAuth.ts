"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface UserInfo {
  user_id: string;
  email: string;
  name: string;
  surname: string;
  prename: string;
  tel: string;
  is_active: boolean;
  user_role_id: string;
  role_type_id: string;
  role_name: string;
}

export default function useAuth() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAuthData = async () => {
      setLoading(true);
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData?.user) {
        setUserInfo(null);
        setLoading(false);
        return;
      }

      const { data: userInfoData, error: userInfoError } = await supabase
        .from("users")
        .select(
          `
    *,
    userrole (
      user_role_id,
      role_type_id,
      roletype (
        role_type_id,
        role_name
      )
    )
  `
        )
        .eq("user_id", userData.user.id)
        .single();

      if (userInfoError || !userInfoData) {
        setUserInfo(null);
        setLoading(false);
        return;
      }
      const mergedUserInfo: UserInfo = {
        ...userInfoData,
        email: userData.user.email || "", 
        user_id: userData.user.id, 
      };
      setUserInfo(mergedUserInfo);
      setLoading(false);
    };

    fetchAuthData();
  }, []);

  return { userInfo, loading };
}

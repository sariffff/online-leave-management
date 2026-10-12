// hooks/useAuthProfile.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fromDbPhone } from "../utils/phone";
interface UserInfo {
  user_id: string;
  email: string;
  name: string;
  surname: string;
  prename: string;
  tel: string;
}

export default function useProfile() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from("users")
          .select("prename, name, surname") // ระบุคอลัมน์ที่ใช้จริง
          .eq("user_id", user.id)
          .maybeSingle(); // กันเคสยังไม่มีแถว

        if (error) {
          console.error("Error fetching user info:", error.message);
        } else {
          const row = data ?? { prename: "", name: "", surname: ""};

          // ✅ รวมข้อมูลจาก auth.user + public.users
          setUserInfo({
            user_id: user.id,
            email: user.email ?? "",      // auth.users.email อาจเป็น null → ใส่ "" ตาม type
            prename: row.prename ?? "",
            name: row.name ?? "",
            surname: row.surname ?? "",
            tel: fromDbPhone(user.phone ?? ""),
          });
        }
      }

      setLoading(false);
    };

    fetchProfile();
  }, []);

  return { userInfo, loading };
}

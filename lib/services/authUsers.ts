// อีเมล/เบอร์โทรอยู่ใน Supabase Auth (ตาราง users ไม่มี) — ดึงทีเดียวแล้ว cache แทนการเรียกทีละคน
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AuthUserInfo = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

const TTL_MS = 60_000;
const PER_PAGE = 200;

let cache: { at: number; map: Map<string, AuthUserInfo> } | null = null;
let inflight: Promise<Map<string, AuthUserInfo>> | null = null;

async function load(): Promise<Map<string, AuthUserInfo>> {
  const map = new Map<string, AuthUserInfo>();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw error;
    for (const u of data.users) {
      map.set(u.id, {
        id: u.id,
        email: u.email ?? null,
        phone: u.phone ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
      });
    }
    if (data.users.length < PER_PAGE) break;
  }
  return map;
}

export async function getAuthUserMap(force = false): Promise<Map<string, AuthUserInfo>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.map;
  inflight ??= load()
    .then((map) => {
      cache = { at: Date.now(), map };
      return map;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateAuthUsers() {
  cache = null;
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  const map = await getAuthUserMap();
  for (const u of map.values()) if ((u.email ?? "").toLowerCase() === target) return u.id;
  return null;
}

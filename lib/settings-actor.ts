import "server-only";
import type { GuardOK } from "@/lib/guard";
import { fullName } from "@/lib/format";
import type { Actor } from "@/lib/settings";

/** ผู้แก้ไขที่บันทึกในประวัติการตั้งค่า */
export const actorOf = (g: GuardOK): Actor => ({ id: g.user.id, name: fullName(g.profile) || g.user.email || g.user.id });

import "server-only";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/guard";
import { fullName } from "@/lib/format";
import SelectRole from "@/components/universal/select-role";

export const metadata: Metadata = {
  title: "เลือกสิทธิ์เข้าใช้งาน",
  robots: { index: false },
};

export default async function SelectRolePage() {
  const g = await requireAuth();
  if (!g.ok) redirect(g.status === 401 ? "/login" : "/403");

  const { data } = await g.supa.from("users").select("prename, name, surname").eq("user_id", g.user.id).maybeSingle();

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="p-4">
        <SelectRole
          roleOptions={g.roles.map((r) => ({ id: String(r.id), name: r.name }))}
          profile={{ email: g.user.email ?? "", fullName: fullName(data) }}
        />
      </div>
    </main>
  );
}

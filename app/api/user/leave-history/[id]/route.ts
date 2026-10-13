import { route, json, HttpError, notFound, readJson } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LEAVE_SELECT, toDTO, type LeaveJoined } from "@/lib/leave/queries";
import { signFiles } from "@/lib/leave/files";
import { deleteOwnLeave, updateOwnLeave, type UpdateOwnInput } from "@/lib/leave/workflow";
import { cleanStr, toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

type P = { id: string };

function idOf(params: P): number {
  const id = toPosInt(params.id);
  if (!id) throw new HttpError(400, "INVALID_ID");
  return id;
}

export const GET = route<P>([ROLE.user], async ({ g, params }) => {
  const id = idOf(params);
  const { data, error } = await supabaseAdmin
    .from("leaverequest")
    .select(LEAVE_SELECT)
    .eq("leave_request_id", id)
    .eq("user_id", g.user.id)
    .maybeSingle();
  if (error) throw new HttpError(500, "DB_ERROR", error.message);
  if (!data) throw notFound("REQUEST_NOT_FOUND");

  const row = data as unknown as LeaveJoined;
  return json(toDTO(row, await signFiles(row.file, row.user_id)));
});

export const PATCH = route<P>([ROLE.user], async ({ g, req, params }) => {
  const id = idOf(params);
  const input: UpdateOwnInput = {};

  if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await req.formData();
    const get = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" ? v : undefined;
    };
    if (get("reason") !== undefined) input.reason = cleanStr(get("reason"));
    if (get("date_start")) input.date_start = cleanStr(get("date_start"), 10);
    if (get("date_end")) input.date_end = cleanStr(get("date_end"), 10);
    if (get("date_start_type")) input.date_start_type = cleanStr(get("date_start_type"), 20);
    if (get("date_end_type")) input.date_end_type = cleanStr(get("date_end_type"), 20);
    input.files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  } else {
    const b = await readJson<Record<string, unknown>>(req);
    if (b.reason !== undefined) input.reason = cleanStr(b.reason);
    if (b.date_start) input.date_start = cleanStr(b.date_start, 10);
    if (b.date_end) input.date_end = cleanStr(b.date_end, 10);
    if (b.date_start_type) input.date_start_type = cleanStr(b.date_start_type, 20);
    if (b.date_end_type) input.date_end_type = cleanStr(b.date_end_type, 20);
  }

  return json(await updateOwnLeave(g.user.id, id, input));
});

export const DELETE = route<P>([ROLE.user], async ({ g, params }) => {
  await deleteOwnLeave(g.user.id, idOf(params));
  return json({ ok: true });
});

import { route, json, HttpError } from "@/lib/http";
import { submitLeave } from "@/lib/leave/workflow";
import { cleanStr, toPosInt } from "@/lib/validate";
import { ROLE } from "@/lib/roles";

export const runtime = "nodejs";

/** ผู้ใช้ยื่นใบลา (multipart/form-data: ฟิลด์ + file ได้หลายไฟล์) */
export const POST = route([ROLE.user], async ({ g, req }) => {
  if (!(req.headers.get("content-type") || "").includes("multipart/form-data")) {
    throw new HttpError(400, "CONTENT_TYPE");
  }
  const form = await req.formData();

  const leave_type_id = toPosInt(form.get("leave_type_id"));
  const date_start = cleanStr(form.get("date_start"), 10);
  const date_end = cleanStr(form.get("date_end"), 10);
  const reason = cleanStr(form.get("reason"));
  if (!leave_type_id || !date_start || !date_end) throw new HttpError(422, "MISSING_FIELDS");

  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);

  const result = await submitLeave(g.user.id, {
    leave_type_id,
    date_start,
    date_end,
    date_start_type: cleanStr(form.get("date_start_type"), 20),
    date_end_type: cleanStr(form.get("date_end_type"), 20),
    reason,
    files,
  });

  return json({ ok: true, ...result }, { status: 201 });
});

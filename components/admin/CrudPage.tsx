"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { FaEdit, FaPlus, FaSearch, FaTrashAlt } from "react-icons/fa";
import Sidebar from "@/components/admin/sidebar";
import Pagination from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/client/api";

type Row = Record<string, unknown>;
type Option = { value: string; label: string };

export type CrudField = {
  name: string;
  label: string;
  type?: "text" | "date" | "select";
  required?: boolean;
  placeholder?: string;
  /** select ที่ดึงตัวเลือกจาก API (คืน { items }) */
  optionsFrom?: { endpoint: string; value: string; label: string };
  /** ตัวเลือกว่าง เช่น "ส่วนรวม" */
  emptyLabel?: string;
};

export type CrudColumn = { header: string; cell: (row: Row) => ReactNode; className?: string };

type Props = {
  title: string;
  subtitle: string;
  addLabel: string;
  endpoint: string;
  idKey: string;
  columns: CrudColumn[];
  fields: CrudField[];
  /** ข้อความที่ใช้ค้นหา */
  searchText: (row: Row) => string;
  /** ชื่อที่ใช้ในข้อความยืนยันลบ */
  rowLabel: (row: Row) => string;
  /** ตัวกรองด้วย dropdown (ค่าที่ไม่ซ้ำจากข้อมูล) */
  filterBy?: { label: string; value: (row: Row) => string };
  note?: string;
  pageSize?: number;
};

const selectCls = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** หน้าจัดการข้อมูลหลักแบบ CRUD — ใช้แทนหน้าที่เคยเขียนซ้ำกัน 4 หน้า (ระดับชั้น, ห้องเรียน, กลุ่มสาระ, รายวิชา) + วันหยุด */
export default function CrudPage(props: Props) {
  const { title, subtitle, addLabel, endpoint, idKey, columns, fields, searchText, rowLabel, filterBy, note, pageSize = 10 } = props;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [editing, setEditing] = useState<{ mode: "add" } | { mode: "edit"; row: Row } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ items: Row[] }>(endpoint);
      setRows(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  // โหลดตัวเลือกของ select ที่อ้างตารางอื่น (ครั้งเดียว)
  useEffect(() => {
    for (const f of fields) {
      if (!f.optionsFrom) continue;
      const { endpoint: ep, value, label } = f.optionsFrom;
      apiFetch<{ items: Row[] }>(ep)
        .then((r) => setOptions((o) => ({ ...o, [f.name]: r.items.map((x) => ({ value: String(x[value]), label: String(x[label] ?? "") })) })))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterValues = useMemo(() => (filterBy ? [...new Set(rows.map(filterBy.value).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")) : []), [rows, filterBy]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (!q || searchText(r).toLowerCase().includes(q)) && (!filterBy || filter === "all" || filterBy.value(r) === filter));
  }, [rows, search, filter, filterBy, searchText]);

  useEffect(() => setPage(1), [search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function openAdd() {
    setValues(Object.fromEntries(fields.map((f) => [f.name, ""])));
    setEditing({ mode: "add" });
  }
  function openEdit(row: Row) {
    setValues(Object.fromEntries(fields.map((f) => [f.name, row[f.name] === null || row[f.name] === undefined ? "" : String(row[f.name])])));
    setEditing({ mode: "edit", row });
  }

  async function save() {
    if (!editing) return;
    for (const f of fields) {
      if (f.required && !values[f.name]?.trim()) return toast.error(`กรุณากรอก${f.label}`);
    }
    const body: Record<string, unknown> = {};
    for (const f of fields) body[f.name] = values[f.name] === "" ? null : values[f.name];

    setSaving(true);
    try {
      if (editing.mode === "add") await apiFetch(endpoint, { method: "POST", json: body });
      else await apiFetch(`${endpoint}/${editing.row[idKey]}`, { method: "PATCH", json: body });
      toast.success("บันทึกเรียบร้อย");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await apiFetch(`${endpoint}/${deleting[idKey]}`, { method: "DELETE" });
      toast.success("ลบเรียบร้อย");
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            <Button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700">
              <FaPlus className="w-4 h-4" />
              {addLabel}
            </Button>
          </div>
          <p className="mt-1 text-gray-600">{subtitle}</p>
          {note && <p className="mt-1 text-sm text-gray-500">{note}</p>}
        </div>

        <div className="p-4 mb-6 bg-white border rounded-lg shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <FaSearch className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
              <Input placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-10" />
            </div>
            {filterBy && (
              <select className={`${selectCls} lg:w-64 h-10`} value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">{filterBy.label}</option>
                {filterValues.map((v) => <option key={v}>{v}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="overflow-hidden bg-white border rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr className="text-gray-600 uppercase">
                  {columns.map((c) => (
                    <th key={c.header} className={`px-4 py-2 text-left text-[11px] tracking-wide ${c.className ?? ""}`}>{c.header}</th>
                  ))}
                  <th className="px-4 py-2 text-center text-[11px] tracking-wide w-44">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}><td colSpan={columns.length + 1} className="px-4 py-3"><div className="h-5 bg-gray-100 rounded animate-pulse" /></td></tr>
                  ))
                ) : error ? (
                  <tr><td colSpan={columns.length + 1} className="px-6 py-12 text-center text-red-600">{error}</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={columns.length + 1} className="px-6 py-12 text-center text-gray-500">ไม่พบข้อมูล</td></tr>
                ) : (
                  visible.map((row) => (
                    <tr key={String(row[idKey])} className="transition-colors hover:bg-gray-50">
                      {columns.map((c) => (
                        <td key={c.header} className={`px-4 py-2 ${c.className ?? ""}`}>{c.cell(row)}</td>
                      ))}
                      <td className="px-4 py-2">
                        <div className="flex justify-center gap-2">
                          <Button size="sm" className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-green-600 rounded hover:bg-green-700" onClick={() => openEdit(row)}>
                            <FaEdit className="w-3 h-3" /> แก้ไข
                          </Button>
                          <Button size="sm" className="flex items-center gap-1 h-7 px-2 text-[12px] text-white bg-red-600 rounded hover:bg-red-700" onClick={() => setDeleting(row)}>
                            <FaTrashAlt className="w-3 h-3" /> ลบ
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} total={filtered.length} />
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.mode === "add" ? addLabel : "แก้ไขข้อมูล"}</DialogTitle>
          </DialogHeader>
          <form
            id="crud-form"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="space-y-3"
          >
            {fields.map((f) => (
              <div key={f.name}>
                <Label htmlFor={f.name}>{f.label}{f.required ? " *" : ""}</Label>
                {f.type === "select" ? (
                  <select id={f.name} className={selectCls} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}>
                    <option value="">{f.emptyLabel ?? "— ไม่ระบุ —"}</option>
                    {(options[f.name] ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <Input id={f.name} type={f.type ?? "text"} placeholder={f.placeholder} value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                )}
              </div>
            ))}
          </form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>ยกเลิก</Button>
            <Button type="submit" form="crud-form" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(v) => !v && !busyDelete && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              ต้องการลบ <span className="font-medium text-red-600">{deleting ? rowLabel(deleting) : ""}</span> ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busyDelete}>ยกเลิก</Button>
            <Button variant="destructive" onClick={remove} disabled={busyDelete}>{busyDelete ? "กำลังลบ..." : "ลบ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

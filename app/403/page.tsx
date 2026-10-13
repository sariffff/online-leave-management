import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold text-gray-800">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
      <p className="text-gray-600">บัญชีของคุณไม่มีสิทธิ์ใช้งานหน้านี้ หรือบัญชีถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ</p>
      <div className="flex gap-3">
        <Link href="/select-role" className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          เลือกสิทธิ์ใช้งาน
        </Link>
        <Link href="/" className="px-4 py-2 border rounded-lg hover:bg-gray-50">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  );
}

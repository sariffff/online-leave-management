"use client";

import React, { useState } from "react";
import { Signup, SignupInput } from "@/lib/signup";

export default function SignupForm() {
  const [form, setForm] = useState<SignupInput>({
    email: "",
    password: "",
    prename: "นาย",
    name: "",
    surname: "",
    tel: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await Signup(form);
    setLoading(false);
    if (result && result.error) {
      setError(result.error);
    } else if (result) {
      setError(null);
    } else {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  };

  return (
    <div className="bg-gray-300 px-6 py-8 md:px-10 rounded-[30px] shadow-lg w-full max-w-md mx-auto">
      <h2 className="text-center text-xl md:text-2xl font-semibold mb-6">
        สมัครสมาชิก
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* คำนำหน้า */}
        <div>
          <label className="block text-sm md:text-base mb-1" htmlFor="prename">
            คำนำหน้า
          </label>
          <select
            id="prename"
            name="prename"
            value={form.prename}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded border border-gray-400 bg-white"
          >
            <option value="นาย">นาย</option>
            <option value="นาง">นาง</option>
            <option value="นางสาว">นางสาว</option>
          </select>
        </div>

        {/* ชื่อ */}
        <div>
          <label className="block text-sm md:text-base mb-1" htmlFor="name">
            ชื่อ
          </label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="กรอกชื่อ"
            className="w-full px-4 py-2 rounded border border-gray-400 bg-white"
            required
          />
        </div>

        {/* นามสกุล */}
        <div>
          <label className="block text-sm md:text-base mb-1" htmlFor="surname">
            นามสกุล
          </label>
          <input
            id="surname"
            name="surname"
            value={form.surname}
            onChange={handleChange}
            placeholder="กรอกนามสกุล"
            className="w-full px-4 py-2 rounded border border-gray-400 bg-white"
            required
          />
        </div>

        {/* เบอร์โทร */}
        <div>
          <label className="block text-sm md:text-base mb-1" htmlFor="tel">
            เบอร์โทรศัพท์
          </label>
          <input
            id="tel"
            name="tel"
            value={form.tel}
            onChange={handleChange}
            placeholder="0812345678"
            className="w-full px-4 py-2 rounded border border-gray-400 bg-white"
          />
        </div>

        {/* อีเมล */}
        <div>
          <label className="block text-sm md:text-base mb-1" htmlFor="email">
            อีเมล
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="example@example.com"
            className="w-full px-4 py-2 rounded border border-gray-400 bg-white"
            required
          />
        </div>

        {/* รหัสผ่าน */}
        <div>
          <label className="block text-sm md:text-base mb-1" htmlFor="password">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="********"
            className="w-full px-4 py-2 rounded border border-gray-400 bg-white"
            required
          />
        </div>

        {/* แสดง error */}
        {error && <p className="text-red-500 text-center">{error}</p>}

        {/* ปุ่มสมัครสมาชิก */}
        <button
          type="submit"
          disabled={loading}
          className="block mx-auto mt-6 bg-white text-black py-2 px-6 rounded-full shadow hover:bg-gray-100"
        >
          {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>
      </form>
    </div>
  );
}

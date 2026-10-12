"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("กรุณากรอก Email และ Password");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push("/select-role");
    }
  };

  return (
    <div className="bg-gray-300 px-6 py-8 md:px-10 rounded-[30px] shadow-lg w-full max-w-md">
      <h2 className="mb-6 text-xl font-semibold text-center md:text-2xl">
        Login
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 text-sm md:text-base" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full px-4 py-2 bg-white border border-gray-400 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm md:text-base" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full px-4 py-2 bg-white border border-gray-400 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
          {/* <div className="mt-1 text-xs text-right text-gray-600 cursor-pointer hover:underline">
            ลืมรหัสผ่าน
          </div> */}
        </div>

        {error && <p className="text-center text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="block px-6 py-2 mx-auto mt-6 text-black bg-white rounded-full shadow hover:bg-gray-100"
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}

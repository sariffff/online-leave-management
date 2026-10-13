import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // นำเข้าเฉพาะไอคอน/คอมโพเนนต์ที่ใช้จริง → bundle เล็กลงและ compile ตอน dev เร็วขึ้น
  experimental: {
    optimizePackageImports: ["lucide-react", "react-icons/fa", "recharts", "@radix-ui/react-select", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
    // ลดการใช้หน่วยความจำของ webpack (เครื่องที่ RAM ว่างน้อยจะช้าลงมากถ้าใช้ swap)
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;

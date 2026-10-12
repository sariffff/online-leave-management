// // components/admin/UserTable.tsx
// "use client";

// import { Button } from "@/components/ui/button";
// import type { User } from "@/types/user";

// interface UserTableProps {
//   users: User[];
//   loading: boolean;
//   onEdit: (user: User) => void;
//   onDelete: (user: User) => void;
//   onToggleActive: (user: User) => void;
// }

// export default function UserTable({
//   users,
//   loading,
//   onEdit,
//   onDelete,
//   onToggleActive,
// }: UserTableProps) {
//   if (loading)
//     return (
//       <div className="flex items-center justify-center p-8">
//         <div className="text-gray-500">กำลังโหลดข้อมูล...</div>
//       </div>
//     );

//   if (users.length === 0)
//     return (
//       <div className="p-8 text-center text-gray-500">
//         ไม่พบข้อมูลบุคลากร
//       </div>
//     );

//   return (
//     <div className="overflow-x-auto">
//       <table className="w-full text-sm border border-gray-300 rounded-md">
//         <thead>
//           <tr className="text-left bg-gray-200">
//             <th className="p-3 font-medium">ชื่อ - สกุล</th>
//             <th className="p-3 font-medium">อีเมล</th>
//             <th className="p-3 font-medium">เบอร์โทร</th>
//             <th className="p-3 font-medium">บทบาท</th>
//             <th className="p-3 font-medium">สถานะ</th>
//             <th className="p-3 font-medium">การจัดการ</th>
//           </tr>
//         </thead>
//         <tbody>
//           {users.map((user) => (
//             <tr key={user.user_id} className="border-t hover:bg-gray-50">
//               <td className="p-3">
//                 <div className="font-medium">
//                   {user.prename && `${user.prename} `}
//                   {user.name} {user.surname}
//                 </div>
//               </td>
//               <td className="p-3">
//                 <div className="text-gray-600">{user.email}</div>
//               </td>
//               <td className="p-3">
//                 <div className="text-gray-600">{user.tel || "-"}</div>
//               </td>
//               <td className="p-3">
//                 <div className="text-sm">
//                   {user.roles.length > 0 ? (
//                     user.roles.map((role, index) => (
//                       <span
//                         key={index}
//                         className="inline-block px-2 py-1 mb-1 mr-1 text-xs text-blue-800 bg-blue-100 rounded"
//                       >
//                         {role}
//                       </span>
//                     ))
//                   ) : (
//                     <span className="text-gray-400">ไม่ระบุ</span>
//                   )}
//                 </div>
//               </td>
//               <td className="p-3">
//                 <span
//                   className={`px-2 py-1 text-xs rounded-full ${
//                     user.is_active
//                       ? "bg-green-100 text-green-800"
//                       : "bg-red-100 text-red-800"
//                   }`}
//                 >
//                   {user.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
//                 </span>
//               </td>
//               <td className="p-3">
//                 <div className="flex flex-wrap gap-2">
//                   <Button size="sm" variant="outline" onClick={() => onEdit(user)}>
//                     แก้ไข
//                   </Button>
//                   {user.is_active ? (
//                     <Button
//                       size="sm"
//                       variant="outline"
//                       className="text-orange-600 border-orange-300 hover:bg-orange-50"
//                       onClick={() => onToggleActive(user)}
//                     >
//                       ปิดใช้งาน
//                     </Button>
//                   ) : (
//                     <Button
//                       size="sm"
//                       variant="outline"
//                       className="text-green-600 border-green-300 hover:bg-green-50"
//                       onClick={() => onToggleActive(user)}
//                     >
//                       เปิดใช้งาน
//                     </Button>
//                   )}
//                   <Button
//                     size="sm"
//                     variant="outline"
//                     className="text-red-600 border-red-300 hover:bg-red-50"
//                     onClick={() => onDelete(user)}
//                   >
//                     ลบ
//                   </Button>
//                 </div>
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// }

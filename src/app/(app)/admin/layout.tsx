import type { ReactNode } from "react";
import { RoleGate } from "@/components/role-gate";
import { AdminNav } from "./admin-nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate role="admin">
      <AdminNav />
      {children}
    </RoleGate>
  );
}

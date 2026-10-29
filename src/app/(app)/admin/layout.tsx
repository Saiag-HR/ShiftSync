import type { ReactNode } from "react";
import { RoleGate } from "@/components/role-gate";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGate role="admin">{children}</RoleGate>;
}

import type { ReactNode } from "react";
import { RoleGate } from "@/components/role-gate";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  return <RoleGate role="employee">{children}</RoleGate>;
}

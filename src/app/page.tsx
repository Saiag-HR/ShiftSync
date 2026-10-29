import { redirect } from "next/navigation";

// The proxy sends signed-out visitors on to /login.
export default function Home() {
  redirect("/dashboard");
}

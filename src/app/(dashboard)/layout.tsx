import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import { DashboardShell } from "./dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Get unresolved alert count for owner
  let alertCount = 0;
  if (profile.role === "owner" || profile.role === "admin") {
    const { count } = await supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("is_resolved", false);
    alertCount = count || 0;
  }

  return (
    <DashboardShell
      role={profile.role as Role}
      userName={profile.full_name}
      alertCount={alertCount}
    >
      {children}
    </DashboardShell>
  );
}

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/server"
import ResourcePoolClient from "./ResourcePoolClient"

export const dynamic = "force-dynamic"

export default async function PoolPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const supabase = createAdminClient()
  const isAdmin = (session.user as any)?.role === "admin"

  // Load recent sessions (last 20 rows)
  const { data: sessions } = await supabase
    .from("event_sessions")
    .select("event_name, session_date, item_type, total_quantity, personal_limit, status")
    .order("session_date", { ascending: false })
    .limit(20)

  // Load all allocated slots with profiles
  const { data: slots } = await supabase
    .from("allocated_slots")
    .select("event_name, session_date, user_id, item_type, status, page_number, slot_number, profiles:user_id(display_name, discord_id)")

  // Load members
  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, discord_id")
    .order("display_name")

  // Load snapshots
  const { data: snapshots } = await supabase
    .from("pool_snapshots")
    .select("id, event_name, event_date, snapshot_label, discord_sent, created_at, created_by, pool_data, member_data")
    .order("created_at", { ascending: false })
    .limit(30)

  return (
    <ResourcePoolClient
      isAdmin={isAdmin}
      initialSessions={sessions || []}
      initialSlots={slots || []}
      initialMembers={members || []}
      initialSnapshots={snapshots || []}
    />
  )
}

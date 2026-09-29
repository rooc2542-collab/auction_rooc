import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || (session.user as any)?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const { id } = await params
  const supabase = createAdminClient()
  const { error } = await supabase.from("profiles").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

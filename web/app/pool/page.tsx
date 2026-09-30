import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default function PoolPage() {
  redirect("/queues")
}

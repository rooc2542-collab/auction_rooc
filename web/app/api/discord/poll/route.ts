import { auth } from "@/auth"
import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { message_id, channel_id } = body

    if (!message_id || typeof message_id !== "string") {
      return NextResponse.json({ error: "กรุณาระบุ Discord Message ID" }, { status: 400 })
    }

    const cleanMessageId = message_id.trim()
    const botToken = process.env.DISCORD_BOT_TOKEN
    const envChannelId = channel_id || process.env.DISCORD_POLL_CHANNEL_ID
    const guildId = process.env.DISCORD_GUILD_ID

    const supabase = createAdminClient()

    // 1. ดึงข้อมูลสมาชิกทั้งหมดจาก Database (profiles)
    const { data: allProfiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, display_name, discord_id, job_class")
      .order("display_name")

    if (profileErr) {
      throw new Error(profileErr.message)
    }

    const profilesList = allProfiles || []

    // 2. ถ้ามีการตั้งค่า DISCORD_BOT_TOKEN ให้ดึงสดจาก Discord REST API (v10)
    if (botToken) {
      let targetChannelId = envChannelId

      // ถ้าไม่ได้ระบุ Channel ID ค้นหาจาก Guild Text Channels
      if (!targetChannelId && guildId) {
        try {
          const channelsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: { Authorization: `Bot ${botToken}` },
          })
          if (channelsRes.ok) {
            const channels = await channelsRes.json()
            const textChannels = channels.filter((c: any) => c.type === 0)
            const attendanceChannel = textChannels.find((c: any) =>
              c.name.includes("attendance") || c.name.includes("poll") || c.name.includes("event")
            )
            if (attendanceChannel) {
              targetChannelId = attendanceChannel.id
            }
          }
        } catch (e: any) {
          console.warn("[Discord API] Guild channels fetch warning:", e.message)
        }
      }

      if (targetChannelId) {
        const msgRes = await fetch(
          `https://discord.com/api/v10/channels/${targetChannelId}/messages/${cleanMessageId}`,
          { headers: { Authorization: `Bot ${botToken}` } }
        )

        if (msgRes.ok) {
          const msgData = await msgRes.json()
          const poll = msgData.poll

          if (poll && Array.isArray(poll.answers)) {
            // หาคำตอบที่เป็น "Join the war / Want to bid"
            const wantBidAnswer =
              poll.answers.find((a: any) =>
                a.poll_media?.text?.toLowerCase().includes("want to bid") ||
                a.poll_media?.text?.toLowerCase().includes("join")
              ) || poll.answers[0]

            let voterIds: string[] = []
            if (wantBidAnswer) {
              const votersRes = await fetch(
                `https://discord.com/api/v10/channels/${targetChannelId}/polls/${cleanMessageId}/answers/${wantBidAnswer.answer_id}?limit=100`,
                { headers: { Authorization: `Bot ${botToken}` } }
              )
              if (votersRes.ok) {
                const votersData = await votersRes.json()
                const users = votersData.users || []
                voterIds = users.map((u: any) => String(u.id))
              }
            }

            // นำ Voter Discord IDs ที่ได้มา query จับคู่กับ Database profiles
            const assignedMembers: any[] = []
            const unassignedMembers: any[] = []

            for (const p of profilesList) {
              if (voterIds.includes(String(p.discord_id))) {
                assignedMembers.push(p)
              } else {
                unassignedMembers.push(p)
              }
            }

            return NextResponse.json({
              success: true,
              source: "discord_live",
              poll_title: poll.question?.text || "Discord Poll",
              assigned_count: assignedMembers.length,
              unassigned_count: unassignedMembers.length,
              assigned_members: assignedMembers,
              unassigned_members: unassignedMembers,
            })
          }
        }
      }
    }

    // 3. กรณีดึงจาก event_attendance ในฐานข้อมูล (ที่บอท /event_poll บันทึกไว้)
    const { data: dbAttendance } = await supabase
      .from("event_attendance")
      .select("discord_id, status")
      .eq("message_id", cleanMessageId)

    if (dbAttendance && dbAttendance.length > 0) {
      const wantBidDiscordIds = dbAttendance
        .filter((a: any) => a.status === "want_bid")
        .map((a: any) => String(a.discord_id))

      const assignedMembers = profilesList.filter((p) => wantBidDiscordIds.includes(String(p.discord_id)))
      const unassignedMembers = profilesList.filter((p) => !wantBidDiscordIds.includes(String(p.discord_id)))

      return NextResponse.json({
        success: true,
        source: "database",
        poll_title: `Poll ID: ${cleanMessageId}`,
        assigned_count: assignedMembers.length,
        unassigned_count: unassignedMembers.length,
        assigned_members: assignedMembers,
        unassigned_members: unassignedMembers,
      })
    }

    // 4. ถ้าไม่พบใน Discord API และไม่มีใน DB ให้ส่งข้อความแจ้งเตือนชัดเจน
    return NextResponse.json({
      success: false,
      error: `ไม่พบข้อมูลโพลสำหรับ Message ID: ${cleanMessageId} (กรุณาตรวจสอบว่า Bot Token หรือ Message ID ถูกต้อง และบอทอยู่ในห้องแชทนั้น)`,
    }, { status: 404 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูลโพล" }, { status: 500 })
  }
}

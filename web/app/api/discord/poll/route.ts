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
            const wantBidAnswer = poll.answers.find((a: any) => {
              const txt = (a.poll_media?.text || "").toLowerCase()
              return txt.includes("want to bid") || txt.includes("ต้องการประมูล") || txt.includes("join")
            }) || poll.answers[0]

            const noBidAnswer = poll.answers.find((a: any) => {
              const txt = (a.poll_media?.text || "").toLowerCase()
              return txt.includes("do not want") || txt.includes("ไม่ต้องการประมูล")
            })

            const absentAnswer = poll.answers.find((a: any) => {
              const txt = (a.poll_media?.text || "").toLowerCase()
              return txt.includes("unable") || txt.includes("ไม่ประสงค์") || txt.includes("ไม่เข้าร่วม")
            })

            const fetchVoterIds = async (ans: any): Promise<string[]> => {
              if (!ans?.answer_id) return []
              try {
                const votersRes = await fetch(
                  `https://discord.com/api/v10/channels/${targetChannelId}/polls/${cleanMessageId}/answers/${ans.answer_id}?limit=100`,
                  { headers: { Authorization: `Bot ${botToken}` } }
                )
                if (votersRes.ok) {
                  const votersData = await votersRes.json()
                  return (votersData.users || []).map((u: any) => String(u.id))
                }
              } catch (e: any) {
                console.warn("[Discord API] fetchVoterIds error:", e.message)
              }
              return []
            }

            const [wantBidVoterIds, noBidVoterIds, absentVoterIds] = await Promise.all([
              fetchVoterIds(wantBidAnswer),
              fetchVoterIds(noBidAnswer),
              fetchVoterIds(absentAnswer),
            ])

            const wantBidMembers = profilesList.filter((p) => wantBidVoterIds.includes(String(p.discord_id)))
            const noBidMembers = profilesList.filter((p) => noBidVoterIds.includes(String(p.discord_id)))
            const absentMembers = profilesList.filter((p) => absentVoterIds.includes(String(p.discord_id)))

            return NextResponse.json({
              success: true,
              source: "discord_live",
              poll_title: poll.question?.text || "Discord Poll",
              want_bid_count: wantBidMembers.length,
              no_bid_count: noBidMembers.length,
              absent_count: absentMembers.length,
              want_bid_members: wantBidMembers,
              no_bid_members: noBidMembers,
              absent_members: absentMembers,
              // Backwards compatibility
              assigned_members: wantBidMembers,
              unassigned_members: noBidMembers.concat(absentMembers),
            })
          }
        }
      }
    }

    // 3. กรณีดึงจาก event_attendance ในฐานข้อมูล (ค้นหาจาก message_id หรือชื่อรอบ event_name)
    let { data: dbAttendance } = await supabase
      .from("event_attendance")
      .select("discord_id, status, event_name, event_date")
      .eq("message_id", cleanMessageId)

    if (!dbAttendance || dbAttendance.length === 0) {
      const { data: byName } = await supabase
        .from("event_attendance")
        .select("discord_id, status, event_name, event_date")
        .ilike("event_name", cleanMessageId)
      if (byName && byName.length > 0) {
        dbAttendance = byName
      }
    }

    if (dbAttendance && dbAttendance.length > 0) {
      const wantBidDiscordIds = dbAttendance
        .filter((a: any) => a.status === "want_bid")
        .map((a: any) => String(a.discord_id))
      const noBidDiscordIds = dbAttendance
        .filter((a: any) => a.status === "no_bid")
        .map((a: any) => String(a.discord_id))
      const absentDiscordIds = dbAttendance
        .filter((a: any) => a.status === "absent")
        .map((a: any) => String(a.discord_id))

      const wantBidMembers = profilesList.filter((p) => wantBidDiscordIds.includes(String(p.discord_id)))
      const noBidMembers = profilesList.filter((p) => noBidDiscordIds.includes(String(p.discord_id)))
      const absentMembers = profilesList.filter((p) => absentDiscordIds.includes(String(p.discord_id)))

      const eventName = dbAttendance[0]?.event_name || ""
      const eventDate = dbAttendance[0]?.event_date || ""
      const pollTitle = eventName ? `${eventName} (${eventDate})` : `Poll ID: ${cleanMessageId}`

      return NextResponse.json({
        success: true,
        source: "database",
        poll_title: pollTitle,
        event_name: eventName,
        event_date: eventDate,
        want_bid_count: wantBidMembers.length,
        no_bid_count: noBidMembers.length,
        absent_count: absentMembers.length,
        want_bid_members: wantBidMembers,
        no_bid_members: noBidMembers,
        absent_members: absentMembers,
        // Backwards compatibility
        assigned_members: wantBidMembers,
        unassigned_members: noBidMembers.concat(absentMembers),
      })
    }

    // 4. ถ้าไม่พบใน Discord API และไม่มีใน DB ให้ส่งข้อความแจ้งเตือนพร้อมคำแนะนำ
    return NextResponse.json({
      success: false,
      error: `ไม่พบข้อมูลโพลสำหรับ Message ID หรือชื่องาน: "${cleanMessageId}" (คำแนะนำ: คุณสามารถเลือกชื่อรอบกิจกรรมจากเมนู Dropdown ด้านบนได้ทันทีโดยไม่ต้องใช้ Message ID)`,
    }, { status: 404 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูลโพล" }, { status: 500 })
  }
}

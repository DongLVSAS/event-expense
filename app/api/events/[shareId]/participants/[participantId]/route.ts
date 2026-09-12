import { MAX_PARTICIPANTS } from '@/lib/characters'
import { mutateEventData } from '@/lib/event-mutations'
import { prisma } from '@/lib/prisma'
import { ParticipantInput } from '../route'

// PATCH / DELETE /api/events/{shareId}/participants/{participantId}
// Sửa tên hoặc đổi nhân vật, và xóa người khỏi sự kiện.

const MIN_PARTICIPANTS = 2

async function loadContext(shareId: string, participantId: string) {
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, event: { shareId } },
    select: { id: true, eventId: true },
  })
  if (!participant) return null

  const siblings = await prisma.participant.findMany({
    where: { eventId: participant.eventId },
    select: { id: true, name: true, characterId: true },
  })
  return { participant, siblings }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/events/[shareId]/participants/[participantId]'>
) {
  const { shareId, participantId } = await ctx.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 })
  }

  const parsed = ParticipantInput.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' },
      { status: 400 }
    )
  }

  const loaded = await loadContext(shareId, participantId)
  if (!loaded) {
    return Response.json({ error: 'Không tìm thấy người này trong sự kiện.' }, { status: 404 })
  }

  const others = loaded.siblings.filter((p) => p.id !== participantId)
  const nameKey = parsed.data.name.toLocaleLowerCase('vi')
  if (others.some((p) => p.name.toLocaleLowerCase('vi') === nameKey)) {
    return Response.json({ error: `Tên "${parsed.data.name}" đã có rồi.` }, { status: 400 })
  }
  if (others.some((p) => p.characterId === parsed.data.characterId)) {
    return Response.json({ error: 'Nhân vật này đã có người dùng rồi.' }, { status: 400 })
  }
  if (loaded.siblings.length > MAX_PARTICIPANTS) {
    return Response.json({ error: `Một sự kiện tối đa ${MAX_PARTICIPANTS} người.` }, { status: 400 })
  }

  // Đổi tên hay đổi nhân vật đều KHÔNG làm đổi số dư, nhưng vẫn đi qua
  // mutateEventData cho nhất quán: transferKey dựa trên participantId nên
  // thực ra vẫn ổn định — reset là phía an toàn, và spec yêu cầu mọi thay đổi
  // participants đều reset.
  const updated = await mutateEventData(loaded.participant.eventId, (tx) =>
    tx.participant.update({
      where: { id: participantId },
      data: { name: parsed.data.name, characterId: parsed.data.characterId },
      select: { id: true, name: true, characterId: true, sortOrder: true },
    })
  )

  return Response.json(updated)
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/events/[shareId]/participants/[participantId]'>
) {
  const { shareId, participantId } = await ctx.params

  const loaded = await loadContext(shareId, participantId)
  if (!loaded) {
    return Response.json({ error: 'Không tìm thấy người này trong sự kiện.' }, { status: 404 })
  }

  if (loaded.siblings.length <= MIN_PARTICIPANTS) {
    return Response.json(
      { error: 'Sự kiện cần tối thiểu 2 người tham gia.' },
      { status: 400 }
    )
  }

  // Chặn xóa người đã gắn với khoản chi. DB cũng chặn bằng ON DELETE RESTRICT,
  // nhưng kiểm ở đây để trả về đúng câu chữ mà spec quy định thay vì lỗi Postgres.
  const expenseCount = await prisma.expense.count({ where: { payerId: participantId } })
  if (expenseCount > 0) {
    return Response.json(
      { error: 'Không thể xóa vì đã có khoản chi ghi nhận cho người này' },
      { status: 400 }
    )
  }

  await mutateEventData(loaded.participant.eventId, (tx) =>
    tx.participant.delete({ where: { id: participantId } })
  )

  return new Response(null, { status: 204 })
}

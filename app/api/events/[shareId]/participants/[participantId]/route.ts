import { MAX_PARTICIPANTS } from '@/lib/characters'
import { mutateEventData } from '@/lib/event-mutations'
import { prisma } from '@/lib/prisma'
import { ParticipantInput } from '../route'

// PATCH / DELETE /api/events/{shareId}/participants/{participantId}
// Sửa tên hoặc đổi nhân vật, và xóa người khỏi sự kiện.
//
// Mỗi handler tốn đúng HAI lượt đi-về DB: một lượt đọc gom hết dữ liệu cần
// kiểm tra, một lượt ghi + đọc lại. Trước đây phần kiểm tra chia làm 2–3 truy
// vấn nối đuôi nhau, mỗi truy vấn là một lượt mạng.

const MIN_PARTICIPANTS = 2

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

  const event = await prisma.event.findUnique({
    where: { shareId },
    select: { participants: { select: { id: true, name: true, characterId: true } } },
  })
  if (!event) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  const siblings = event.participants
  if (!siblings.some((p) => p.id === participantId)) {
    return Response.json({ error: 'Không tìm thấy người này trong sự kiện.' }, { status: 404 })
  }

  const others = siblings.filter((p) => p.id !== participantId)
  const nameKey = parsed.data.name.toLocaleLowerCase('vi')
  if (others.some((p) => p.name.toLocaleLowerCase('vi') === nameKey)) {
    return Response.json({ error: `Tên "${parsed.data.name}" đã có rồi.` }, { status: 400 })
  }
  if (others.some((p) => p.characterId === parsed.data.characterId)) {
    return Response.json({ error: 'Nhân vật này đã có người dùng rồi.' }, { status: 400 })
  }
  if (siblings.length > MAX_PARTICIPANTS) {
    return Response.json({ error: `Một sự kiện tối đa ${MAX_PARTICIPANTS} người.` }, { status: 400 })
  }

  // Đổi tên hay đổi nhân vật đều KHÔNG làm đổi số dư, nhưng vẫn đi qua
  // mutateEventData cho nhất quán: transferKey dựa trên participantId nên
  // thực ra vẫn ổn định — reset là phía an toàn, và spec yêu cầu mọi thay đổi
  // participants đều reset.
  const updated = await mutateEventData(shareId, [
    prisma.participant.update({
      where: { id: participantId },
      data: { name: parsed.data.name, characterId: parsed.data.characterId },
    }),
  ])
  if (!updated) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return Response.json(updated)
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<'/api/events/[shareId]/participants/[participantId]'>
) {
  const { shareId, participantId } = await ctx.params

  // Một truy vấn lấy cả danh sách người và số khoản chi gắn với người bị xóa.
  const event = await prisma.event.findUnique({
    where: { shareId },
    select: {
      participants: { select: { id: true } },
      expenses: { where: { payerId: participantId }, select: { id: true }, take: 1 },
    },
  })
  if (!event) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }
  if (!event.participants.some((p) => p.id === participantId)) {
    return Response.json({ error: 'Không tìm thấy người này trong sự kiện.' }, { status: 404 })
  }

  if (event.participants.length <= MIN_PARTICIPANTS) {
    return Response.json({ error: 'Sự kiện cần tối thiểu 2 người tham gia.' }, { status: 400 })
  }

  // Chặn xóa người đã gắn với khoản chi. DB cũng chặn bằng ON DELETE RESTRICT,
  // nhưng kiểm ở đây để trả về đúng câu chữ mà spec quy định thay vì lỗi Postgres.
  if (event.expenses.length > 0) {
    return Response.json(
      { error: 'Không thể xóa vì đã có khoản chi ghi nhận cho người này' },
      { status: 400 }
    )
  }

  const updated = await mutateEventData(shareId, [
    prisma.participant.delete({ where: { id: participantId } }),
  ])
  if (!updated) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return Response.json(updated)
}

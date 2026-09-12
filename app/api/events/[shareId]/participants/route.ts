import { z } from 'zod'
import { CHARACTERS, MAX_PARTICIPANTS } from '@/lib/characters'
import { mutateEventData } from '@/lib/event-mutations'
import { prisma } from '@/lib/prisma'

// POST /api/events/{shareId}/participants — thêm người vào sự kiện đã tồn tại.
// Thêm người làm đổi mẫu số của phép chia → phải reset quyết toán,
// nên đi qua mutateEventData. Xem docs/screens/02-event-form.md §8.

const CHARACTER_IDS = CHARACTERS.map((c) => c.id) as [string, ...string[]]

export const ParticipantInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Hãy nhập tên người tham gia.')
    .max(50, 'Tên người tối đa 50 ký tự.'),
  characterId: z.enum(CHARACTER_IDS, { message: 'Nhân vật không hợp lệ.' }),
})

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/events/[shareId]/participants'>
) {
  const { shareId } = await ctx.params

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
    select: {
      id: true,
      participants: { select: { name: true, characterId: true, sortOrder: true } },
    },
  })
  if (!event) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  if (event.participants.length >= MAX_PARTICIPANTS) {
    return Response.json(
      { error: `Một sự kiện tối đa ${MAX_PARTICIPANTS} người.` },
      { status: 400 }
    )
  }

  // Trùng tên so không phân biệt hoa/thường — unique của Postgres thì có phân biệt.
  const nameKey = parsed.data.name.toLocaleLowerCase('vi')
  if (event.participants.some((p) => p.name.toLocaleLowerCase('vi') === nameKey)) {
    return Response.json({ error: `Tên "${parsed.data.name}" đã có rồi.` }, { status: 400 })
  }

  if (event.participants.some((p) => p.characterId === parsed.data.characterId)) {
    return Response.json({ error: 'Nhân vật này đã có người dùng rồi.' }, { status: 400 })
  }

  const nextSortOrder = event.participants.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1

  const updated = await mutateEventData(shareId, [
    prisma.participant.create({
      data: {
        eventId: event.id,
        name: parsed.data.name,
        characterId: parsed.data.characterId,
        sortOrder: nextSortOrder,
      },
    }),
  ])
  if (!updated) {
    return Response.json({ error: 'Không tìm thấy sự kiện này.' }, { status: 404 })
  }

  return Response.json(updated, { status: 201 })
}

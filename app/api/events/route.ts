import { nanoid } from 'nanoid'
import { z } from 'zod'
import { CHARACTERS, MAX_PARTICIPANTS } from '@/lib/characters'
import { prisma } from '@/lib/prisma'

// POST /api/events — tạo sự kiện kèm danh sách người tham gia.
// Spec: docs/screens/02-event-form.md §6 và §9.
//
// Không tin dữ liệu từ client dù client đã validate rồi: mọi điều kiện dưới đây
// đều được kiểm lại ở đây, đây mới là nơi quyết định.

const CHARACTER_IDS = CHARACTERS.map((c) => c.id) as [string, ...string[]]

const ParticipantInput = z.object({
  name: z.string().trim().min(1, 'Hãy nhập tên người tham gia.').max(50, 'Tên người tối đa 50 ký tự.'),
  characterId: z.enum(CHARACTER_IDS, { message: 'Nhân vật không hợp lệ.' }),
})

const CreateEventInput = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Hãy nhập tên sự kiện.')
      .max(100, 'Tên sự kiện tối đa 100 ký tự.'),
    // Chỉ ngày, không giờ. Regex trước rồi mới kiểm ngày có thật
    // (chặn 2025-02-31 vốn lọt qua regex).
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Hãy chọn ngày diễn ra.'),
    participants: z
      .array(ParticipantInput)
      .min(2, 'Sự kiện cần tối thiểu 2 người tham gia.')
      .max(MAX_PARTICIPANTS, `Một sự kiện tối đa ${MAX_PARTICIPANTS} người.`),
  })
  .superRefine((data, ctx) => {
    const [y, m, d] = data.date.split('-').map(Number)
    const parsed = new Date(Date.UTC(y, m - 1, d))
    if (
      parsed.getUTCFullYear() !== y ||
      parsed.getUTCMonth() !== m - 1 ||
      parsed.getUTCDate() !== d
    ) {
      ctx.addIssue({ code: 'custom', path: ['date'], message: 'Ngày không hợp lệ.' })
    }

    // Trùng tên: so sau khi trim, KHÔNG phân biệt hoa/thường.
    // Unique của Postgres có phân biệt hoa/thường nên phải chặn ở đây.
    const seenNames = new Set<string>()
    for (const [i, p] of data.participants.entries()) {
      const key = p.name.toLocaleLowerCase('vi')
      if (seenNames.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['participants', i, 'name'],
          message: `Tên "${p.name}" đã có rồi.`,
        })
      }
      seenNames.add(key)
    }

    // Nhân vật không bao giờ trùng trong cùng một sự kiện.
    const seenCharacters = new Set<string>()
    for (const [i, p] of data.participants.entries()) {
      if (seenCharacters.has(p.characterId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['participants', i, 'characterId'],
          message: 'Mỗi người phải có một nhân vật khác nhau.',
        })
      }
      seenCharacters.add(p.characterId)
    }
  })

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 })
  }

  const parsed = CreateEventInput.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      {
        error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.',
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      },
      { status: 400 }
    )
  }

  const { name, date, participants } = parsed.data

  // nanoid mặc định 21 ký tự — nằm trong khoảng 16–21 đã chốt ở
  // docs/screens/00-index.md §3.9. Không rút ngắn: đây là ranh giới bảo mật
  // duy nhất của app, ai có link là có toàn quyền sửa.
  const shareId = nanoid()

  // Dùng nested create: Prisma gói Event + toàn bộ Participant vào một transaction,
  // nên không bao giờ có sự kiện tạo nửa vời không có người tham gia.
  const event = await prisma.event.create({
    data: {
      shareId,
      name,
      date: new Date(`${date}T00:00:00.000Z`),
      participants: {
        create: participants.map((p, index) => ({
          name: p.name,
          characterId: p.characterId,
          sortOrder: index,
        })),
      },
    },
    select: { shareId: true, name: true, date: true },
  })

  return Response.json(
    {
      shareId: event.shareId,
      name: event.name,
      date: event.date.toISOString().slice(0, 10),
    },
    { status: 201 }
  )
}

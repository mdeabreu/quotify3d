import type { Quote } from '@/payload-types'

export const getVisibleAdminNotes = ({
  adminNotes,
  status,
}: Pick<Quote, 'adminNotes' | 'status'>): string | null => {
  if (status !== 'approved' || typeof adminNotes !== 'string') return null

  const trimmedNotes = adminNotes.trim()

  return trimmedNotes.length > 0 ? trimmedNotes : null
}

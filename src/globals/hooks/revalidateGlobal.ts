import type { GlobalAfterChangeHook } from 'payload'

import { revalidateTag } from 'next/cache'

export const revalidateGlobal =
  (slug: string): GlobalAfterChangeHook =>
  async () => {
    revalidateTag(`global_${slug}`, 'max')
  }

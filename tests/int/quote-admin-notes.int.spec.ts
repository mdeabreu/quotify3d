import { describe, expect, it } from 'vitest'

import { Quotes, adminNotesReadAccess } from '@/collections/Quotes'
import { getVisibleAdminNotes } from '@/utilities/quotes/getVisibleAdminNotes'

const adminNotesField = Quotes.fields
  .flatMap((field) => ('tabs' in field ? field.tabs : []))
  .flatMap((tab) => ('fields' in tab ? tab.fields : []))
  .find((field) => 'name' in field && field.name === 'adminNotes')

describe('quote admin notes visibility', () => {
  it('shows trimmed admin notes for approved quotes', () => {
    expect(
      getVisibleAdminNotes({
        adminNotes: '  Additional supports are needed for this print.  ',
        status: 'approved',
      }),
    ).toBe('Additional supports are needed for this print.')
  })

  it('hides empty admin notes for approved quotes', () => {
    expect(
      getVisibleAdminNotes({
        adminNotes: '   ',
        status: 'approved',
      }),
    ).toBeNull()
  })

  it('hides admin notes for non-approved quotes', () => {
    expect(
      getVisibleAdminNotes({
        adminNotes: 'This should wait until approval.',
        status: 'in-review',
      }),
    ).toBeNull()
  })
})

describe('quote admin notes field access', () => {
  it('uses admin-only access for creating and updating admin notes', () => {
    expect(adminNotesField && 'access' in adminNotesField ? adminNotesField.access?.create : null)
      .toBeTypeOf('function')
    expect(adminNotesField && 'access' in adminNotesField ? adminNotesField.access?.update : null)
      .toBeTypeOf('function')

    expect(
      adminNotesField && 'access' in adminNotesField
        ? adminNotesField.access?.create?.({
            req: { user: { roles: ['admin'] } },
          } as Parameters<NonNullable<typeof adminNotesField.access.create>>[0])
        : null,
    ).toBe(true)
    expect(
      adminNotesField && 'access' in adminNotesField
        ? adminNotesField.access?.update?.({
            req: { user: { roles: ['customer'] } },
          } as Parameters<NonNullable<typeof adminNotesField.access.update>>[0])
        : null,
    ).toBe(false)
  })

  it('allows admins to read admin notes before approval', () => {
    expect(
      adminNotesReadAccess({
        doc: { status: 'in-review' },
        req: { user: { roles: ['admin'] } },
      } as Parameters<typeof adminNotesReadAccess>[0]),
    ).toBe(true)
  })

  it('allows customers to read admin notes after approval', () => {
    expect(
      adminNotesReadAccess({
        doc: { status: 'approved' },
        req: { user: { roles: ['customer'] } },
      } as Parameters<typeof adminNotesReadAccess>[0]),
    ).toBe(true)
  })

  it('prevents customers from reading admin notes before approval', () => {
    expect(
      adminNotesReadAccess({
        doc: { status: 'in-review' },
        req: { user: { roles: ['customer'] } },
      } as Parameters<typeof adminNotesReadAccess>[0]),
    ).toBe(false)
  })
})

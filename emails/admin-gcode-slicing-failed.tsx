import { ActionEmail } from './components/action-email'

type AdminGcodeSlicingFailedEmailProps = {
  adminURL: string
  error?: string | null
  gcodeID: number | string
  quoteID?: number | string | null
  quoteItemID?: string | null
}

const formatError = (error?: string | null) => {
  if (!error) {
    return 'No error details were captured.'
  }

  return error.length > 700 ? `${error.slice(0, 700)}...` : error
}

export default function AdminGcodeSlicingFailedEmail({
  adminURL,
  error,
  gcodeID,
  quoteID,
  quoteItemID,
}: AdminGcodeSlicingFailedEmailProps) {
  return (
    <ActionEmail
      body={[
        `Gcode #${gcodeID} failed during slicing and needs admin review.`,
        quoteID ? `Quote: #${quoteID}.` : 'No quote reference was resolved.',
        quoteItemID ? `Quote item: ${quoteItemID}.` : 'No quote item ID is attached.',
        `Error: ${formatError(error)}`,
        'This usually indicates that the slicing configuration or model inputs need to be adjusted.',
      ]}
      cta={{
        label: `Review gcode #${gcodeID}`,
        url: adminURL,
      }}
      eyebrow="Slicing failed"
      footer="You received this email because your account has admin access."
      headline={`Gcode #${gcodeID} failed to slice`}
      preview={`Gcode #${gcodeID} failed during slicing.`}
    />
  )
}

AdminGcodeSlicingFailedEmail.PreviewProps = {
  adminURL: 'http://localhost:3000/admin/collections/gcodes/456',
  error: 'sliceModelTask: missing config paths; ensure buildSlicerContextTask ran successfully',
  gcodeID: 456,
  quoteID: 123,
  quoteItemID: 'quote-item-abc',
}

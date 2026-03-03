import Link from 'next/link'

import { Button } from '@/components/ui/button'

const steps = [
  'Tell us what you want to print',
  'Pick material and print quality',
  'Review timeline and delivery details',
  'Submit for quote review',
]

export const QuoteWizard = () => {
  return (
    <section className="border rounded-lg bg-card p-6 md:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-widest font-mono text-primary/60">Quote Wizard</p>
        <h1 className="text-3xl md:text-4xl font-medium mt-2">Start your 3D print quote</h1>
        <p className="text-primary/70 mt-4">
          This guided flow is designed for first-time customers. We will ask a few simple questions
          and build the quote with you.
        </p>
      </div>

      <ol className="mt-8 grid gap-3 md:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step} className="rounded-md border bg-background px-4 py-3">
            <p className="text-xs uppercase tracking-wider font-mono text-primary/50">
              Step {index + 1}
            </p>
            <p className="mt-1">{step}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex items-center gap-3">
        <Button disabled>Begin Wizard (coming next)</Button>
        <Button asChild variant="outline">
          <Link href="/quotes">Back to quotes</Link>
        </Button>
      </div>
    </section>
  )
}

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { CSSProperties, ReactNode } from 'react'

export type ActionEmailProps = {
  body: ReactNode[]
  cta: {
    label: string
    url: string
  }
  eyebrow: string
  fallbackText?: string
  footer: ReactNode
  headline: string
  preview: string
}

const getSiteName = () => process.env.FROM_NAME || process.env.SITE_NAME || 'Quotify3D'

export function ActionEmail({
  body,
  cta,
  eyebrow,
  fallbackText = 'If the button does not open, copy this link instead.',
  footer,
  headline,
  preview,
}: ActionEmailProps) {
  const siteName = getSiteName()

  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={eyebrowStyle}>{eyebrow}</Text>
            <Text style={brand}>
              <span style={brandMark}>Q</span>
              {siteName}
            </Text>
          </Section>
          <Section style={content}>
            <Heading style={heading}>{headline}</Heading>
            {body.map((item, index) => (
              <Text key={index} style={paragraph}>
                {item}
              </Text>
            ))}
            <Section style={buttonContainer}>
              <Button style={button} href={cta.url}>
                {cta.label}
              </Button>
            </Section>
            <Hr style={hr} />
            <Text style={altMethod}>{fallbackText}</Text>
            <Section style={linkContainer}>
              <Link style={link} href={cta.url}>
                {cta.url}
              </Link>
            </Section>
          </Section>
          <Section style={footerSection}>
            <Text style={footerText}>{footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main: CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily:
    'Inter, Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: '32px 12px',
}

const container: CSSProperties = {
  margin: '0 auto',
  maxWidth: '600px',
  width: '100%',
}

const header: CSSProperties = {
  backgroundColor: '#0a0a0a',
  border: '1px solid #0a0a0a',
  borderRadius: '8px 8px 0 0',
  padding: '28px 32px',
}

const eyebrowStyle: CSSProperties = {
  color: '#a1a1aa',
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.12em',
  lineHeight: '16px',
  margin: '0 0 14px',
  textTransform: 'uppercase',
}

const brand: CSSProperties = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 600,
  lineHeight: '32px',
  margin: 0,
}

const brandMark: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  color: '#0a0a0a',
  display: 'inline-block',
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: '28px',
  marginRight: '10px',
  textAlign: 'center',
  verticalAlign: 'middle',
  width: '28px',
}

const content: CSSProperties = {
  backgroundColor: '#ffffff',
  borderLeft: '1px solid #e4e4e7',
  borderRight: '1px solid #e4e4e7',
  padding: '42px 32px 36px',
}

const heading: CSSProperties = {
  color: '#18181b',
  fontSize: '30px',
  fontWeight: 500,
  lineHeight: '38px',
  margin: '0 0 18px',
}

const paragraph: CSSProperties = {
  color: '#3f3f46',
  fontSize: '16px',
  lineHeight: '25px',
  margin: '0 0 14px',
}

const buttonContainer: CSSProperties = {
  margin: '30px 0',
}

const button: CSSProperties = {
  backgroundColor: '#18181b',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 600,
  lineHeight: '20px',
  padding: '13px 22px',
  textAlign: 'center',
  textDecoration: 'none',
}

const hr: CSSProperties = {
  borderColor: '#e4e4e7',
  margin: '34px 0 24px',
}

const altMethod: CSSProperties = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 10px',
}

const linkContainer: CSSProperties = {
  backgroundColor: '#f4f4f5',
  border: '1px solid #e4e4e7',
  borderRadius: '6px',
  padding: '14px 16px',
  wordBreak: 'break-all',
}

const link: CSSProperties = {
  color: '#18181b',
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
  fontSize: '13px',
  lineHeight: '20px',
  textDecoration: 'underline',
}

const footerSection: CSSProperties = {
  backgroundColor: '#fafafa',
  borderBottom: '1px solid #e4e4e7',
  borderLeft: '1px solid #e4e4e7',
  borderRadius: '0 0 8px 8px',
  borderRight: '1px solid #e4e4e7',
  padding: '24px 32px',
}

const footerText: CSSProperties = {
  color: '#71717a',
  fontSize: '13px',
  lineHeight: '20px',
  margin: 0,
}

import nodemailer from 'npm:nodemailer@6.9.10'

interface SmtpConfig {
  smtpUser: string
  smtpPass: string
  smtpHost: string
  smtpPort: number
  fromName: string
  fromEmail: string
  isCompanySmtp: boolean
}

/**
 * Resolve SMTP credentials for a tenant.
 * If the tenant belongs to a company with enabled email config, use company SMTP.
 * Otherwise, fall back to platform default SMTP.
 */
export async function resolveSmtpForTenant(
  supabaseAdmin: any,
  tenantId: string | null | undefined
): Promise<SmtpConfig> {
  const platformUser = Deno.env.get('SMTP_USER') || ''
  const platformPass = Deno.env.get('SMTP_PASSWORD') || ''

  if (tenantId) {
    try {
      // Get tenant's company_id
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('company_id')
        .eq('id', tenantId)
        .maybeSingle()

      if (tenant?.company_id) {
        const { data: config } = await supabaseAdmin
          .from('company_email_config')
          .select('*')
          .eq('company_id', tenant.company_id)
          .eq('is_enabled', true)
          .maybeSingle()

        if (config?.smtp_user && config?.smtp_pass) {
          return {
            smtpUser: config.smtp_user,
            smtpPass: config.smtp_pass,
            smtpHost: config.smtp_host || 'smtp.gmail.com',
            smtpPort: config.smtp_port || 465,
            fromName: config.from_name || 'Admin',
            fromEmail: config.from_email || config.smtp_user,
            isCompanySmtp: true,
          }
        }
      }
    } catch (err) {
      console.warn('Failed to resolve company SMTP, using platform default:', err)
    }
  }

  return {
    smtpUser: platformUser,
    smtpPass: platformPass,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    fromName: 'VKHO',
    fromEmail: platformUser,
    isCompanySmtp: false,
  }
}

/**
 * Resolve SMTP by company_id directly (for admin-level functions).
 */
export async function resolveSmtpForCompany(
  supabaseAdmin: any,
  companyId: string | null | undefined
): Promise<SmtpConfig> {
  const platformUser = Deno.env.get('SMTP_USER') || ''
  const platformPass = Deno.env.get('SMTP_PASSWORD') || ''

  if (companyId) {
    try {
      const { data: config } = await supabaseAdmin
        .from('company_email_config')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_enabled', true)
        .maybeSingle()

      if (config?.smtp_user && config?.smtp_pass) {
        return {
          smtpUser: config.smtp_user,
          smtpPass: config.smtp_pass,
          smtpHost: config.smtp_host || 'smtp.gmail.com',
          smtpPort: config.smtp_port || 465,
          fromName: config.from_name || 'Admin',
          fromEmail: config.from_email || config.smtp_user,
          isCompanySmtp: true,
        }
      }
    } catch (err) {
      console.warn('Failed to resolve company SMTP:', err)
    }
  }

  return {
    smtpUser: platformUser,
    smtpPass: platformPass,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    fromName: 'VKHO',
    fromEmail: platformUser,
    isCompanySmtp: false,
  }
}

/**
 * Create a nodemailer transporter from SmtpConfig
 */
export function createSmtpTransporter(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  })
}

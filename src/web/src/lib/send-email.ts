import { createLogger, DEV_EMAIL_WORKER_URL } from "@onecaptain/shared"

const log = createLogger({ service: "send-email" })

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  /**
   * The actionable link inside the email (verification, reset, invite).
   * When no mail transport is reachable (local dev without the email
   * worker), it is logged so the flow stays completable from the console.
   */
  actionUrl?: string
}

/**
 * The single outbound-email chokepoint for auth + invite mail
 * (DECISIONS.md #3). Delivery order: EMAIL_WORKER service binding → dev
 * email-worker URL → console log of the actionable link. Never throws —
 * email delivery must not block signup, reset, or invites; callers that
 * need hard delivery guarantees (the OTP path) keep their own handling.
 */
export async function sendEmail(env: Env, input: SendEmailInput): Promise<void> {
  const payload = JSON.stringify({ to: input.to, subject: input.subject, html: input.html })
  const fetchOpts = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  }
  try {
    let res: Response
    try {
      res = await env.EMAIL_WORKER.fetch("http://internal/send/otp", fetchOpts)
    } catch {
      res = await fetch(`${DEV_EMAIL_WORKER_URL}/send/otp`, fetchOpts)
    }
    if (!res.ok) {
      throw new Error(`send failed: ${res.status} ${await res.text()}`)
    }
    log.info("email sent", { to: input.to, subject: input.subject })
  } catch (err) {
    log.warn("email delivery unavailable — actionable link follows", {
      to: input.to,
      subject: input.subject,
      actionUrl: input.actionUrl,
      err: err instanceof Error ? err.message : String(err),
    })
  }
}

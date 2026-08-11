type OtpType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email"

const subjectByType: Record<OtpType, string> = {
  "sign-in": "Your OneCaptain sign-in code",
  "email-verification": "Verify your OneCaptain email",
  "forget-password": "Reset your OneCaptain password",
  "change-email": "Confirm your new email address",
}

const headingByType: Record<OtpType, string> = {
  "sign-in": "Sign in to OneCaptain",
  "email-verification": "Verify your email",
  "forget-password": "Reset your password",
  "change-email": "Confirm email change",
}

const descriptionByType: Record<OtpType, string> = {
  "sign-in": "Enter this code to sign in to your account.",
  "email-verification": "Enter this code to verify your email address.",
  "forget-password": "Enter this code to reset your password.",
  "change-email": "Enter this code to confirm your new email address.",
}

export function getOtpSubject(type: OtpType): string {
  return subjectByType[type]
}

export function renderOtpEmail(otp: string, type: OtpType): string {
  const heading = headingByType[type]
  const description = descriptionByType[type]

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background-color:#ffffff;border-radius:8px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td>
  <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#8c7e6f;letter-spacing:0.04em;text-transform:uppercase;">OneCaptain</p>
  <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#2c2825;line-height:1.3;">${heading}</h1>
  <p style="margin:0 0 28px;font-size:15px;color:#6b6057;line-height:1.5;">${description}</p>
  <div style="background-color:#faf8f6;border:1px solid #ebe7e2;border-radius:6px;padding:20px;text-align:center;margin:0 0 28px;">
    <span style="font-size:32px;font-weight:700;letter-spacing:0.2em;color:#2c2825;font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,Courier,monospace;">${otp}</span>
  </div>
  <p style="margin:0;font-size:13px;color:#9b9189;line-height:1.5;">This code expires in 5 minutes. If you didn't request this, you can safely ignore this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

type LinkEmailType = "email-verification-link" | "password-reset-link" | "workspace-invite"

const linkSubject: Record<LinkEmailType, string> = {
  "email-verification-link": "Verify your OneCaptain email",
  "password-reset-link": "Reset your OneCaptain password",
  "workspace-invite": "You've been invited to a OneCaptain workspace",
}

const linkHeading: Record<LinkEmailType, string> = {
  "email-verification-link": "Verify your email",
  "password-reset-link": "Reset your password",
  "workspace-invite": "Join the workspace",
}

const linkDescription: Record<LinkEmailType, string> = {
  "email-verification-link": "Confirm this address to finish setting up your account.",
  "password-reset-link": "Choose a new password for your account.",
  "workspace-invite": "Accept the invitation to start working with the team.",
}

const linkButton: Record<LinkEmailType, string> = {
  "email-verification-link": "Verify email",
  "password-reset-link": "Reset password",
  "workspace-invite": "Accept invitation",
}

export function getLinkEmailSubject(type: LinkEmailType): string {
  return linkSubject[type]
}

export function renderLinkEmail(type: LinkEmailType, url: string, detail?: string): string {
  const heading = linkHeading[type]
  const description = detail ?? linkDescription[type]
  const button = linkButton[type]

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3f0;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background-color:#ffffff;border-radius:8px;padding:40px 36px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
<tr><td>
  <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#8c7e6f;letter-spacing:0.04em;text-transform:uppercase;">OneCaptain</p>
  <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#2c2825;line-height:1.3;">${heading}</h1>
  <p style="margin:0 0 28px;font-size:15px;color:#6b6057;line-height:1.5;">${description}</p>
  <div style="text-align:center;margin:0 0 28px;">
    <a href="${url}" style="display:inline-block;background-color:#2c2825;color:#ffffff;border-radius:6px;padding:12px 24px;font-size:15px;font-weight:600;text-decoration:none;">${button}</a>
  </div>
  <p style="margin:0 0 8px;font-size:13px;color:#9b9189;line-height:1.5;">Or paste this link into your browser:</p>
  <p style="margin:0 0 28px;font-size:13px;color:#6b6057;line-height:1.5;word-break:break-all;">${url}</p>
  <p style="margin:0;font-size:13px;color:#9b9189;line-height:1.5;">If you didn't request this, you can safely ignore this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

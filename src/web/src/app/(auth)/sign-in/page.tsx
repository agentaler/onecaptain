import { getCloudflareContext } from "@opennextjs/cloudflare"
import { resolveMode } from "@onecaptain/shared"
import SignInPageClient from "./sign-in-client"

export default async function SignInPage() {
  const { env } = await getCloudflareContext({ async: true })
  const mode = resolveMode({ nodeEnv: env.NODE_ENV ?? process.env.NODE_ENV })
  const isProd = mode === "production"
  // Which method the form opens on. A deployment without a working outbound
  // mail transport sets this to "password", because a sign-in code the visitor
  // can never receive is a dead end. Defaults to the code flow.
  const defaultMethod = env.AUTH_DEFAULT_METHOD === "password" ? "password" : "otp"

  return <SignInPageClient isProd={isProd} defaultMethod={defaultMethod} />
}

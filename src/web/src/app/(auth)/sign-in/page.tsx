import { getCloudflareContext } from "@opennextjs/cloudflare"
import { resolveMode } from "@onecaptain/shared"
import SignInPageClient from "./sign-in-client"

export default async function SignInPage() {
  const { env } = await getCloudflareContext({ async: true })
  const mode = resolveMode({ nodeEnv: env.NODE_ENV ?? process.env.NODE_ENV })
  const isProd = mode === "production"

  return <SignInPageClient isProd={isProd} />
}

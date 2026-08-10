import { createLogger, type Logger } from "@onecaptain/shared"

export const log = createLogger({ service: "ws-do" })

export interface RouterContext {
  request: Request
  env: Env
  url: URL
  traceId: string | undefined
  log: Logger
}

import { createLogger } from "@onecaptain/shared"

export const log = createLogger({
  service: "web",
  level: (process.env.ONECAPTAIN_LOG_LEVEL as "debug" | "info" | "warn" | "error" | "silent") || "info",
  pretty: process.env.NODE_ENV === "development",
})

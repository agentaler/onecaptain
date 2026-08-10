import { afterAll } from "vitest"
import { closeDb } from "@onecaptain/test-utils"
import { DEV_WEB_URL } from "@onecaptain/shared"

if (!process.env.APP_URL) {
  process.env.APP_URL = DEV_WEB_URL
}

afterAll(() => {
  closeDb()
})

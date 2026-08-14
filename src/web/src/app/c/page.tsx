"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function CommunityIndex() {
  const router = useRouter()
  // Bots, not machines. A new account landing on "connect a machine" made the
  // daemon look mandatory when an agent runs on an LLM key.
  useEffect(() => { router.replace("/c/me/bots") }, [router])
  return null
}

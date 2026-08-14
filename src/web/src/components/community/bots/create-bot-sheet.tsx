"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { toastApiError } from "@/lib/api/client"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { type AvatarDraft } from "@/components/avatar"
import { serializeBeamSeed } from "@/lib/avatar/seed-url"
import { useCreateBot, useUploadBotAvatar } from "@/hooks/community/use-bots"
import { BotFormFields } from "./bot-form-fields"
import {
  type BotCreateFieldErrors,
  hasBotCreateFieldErrors,
  validateBotCreateFields,
} from "./bot-form-validation"
import { uniqueNamesGenerator, names } from "unique-names-generator"
import type { BotSummary } from "@/hooks/community/use-bots"

// Stable initial seed avoids hydration mismatch (real seed is rerolled on mount).
const INITIAL_AVATAR = serializeBeamSeed("initial")

function randomBotName(): string {
  return uniqueNamesGenerator({ dictionaries: [names], length: 1, style: "capital" })
}

export function CreateBotSheet({
  open,
  onOpenChange,
  onCreated,
  avatarSeed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (bot: BotSummary) => void | Promise<void>
  avatarSeed?: string
}) {
  const create = useCreateBot()
  const uploadBotAvatar = useUploadBotAvatar()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [fieldErrors, setFieldErrors] = useState<BotCreateFieldErrors>({})
  const [avatarDraft, setAvatarDraft] = useState<AvatarDraft>({
    kind: "procedural",
    image: INITIAL_AVATAR,
  })

  // Randomize name + avatar on client mount (not during SSR — Math.random would
  // hydration-mismatch). Fires once per sheet open.
  const initializedFor = useRef<boolean | null>(null)
  useEffect(() => {
    if (!open) {
      initializedFor.current = null
      return
    }
    if (initializedFor.current) return
    initializedFor.current = true
    setName(randomBotName())
    setAvatarDraft({
      kind: "procedural",
      image: serializeBeamSeed(avatarSeed ?? crypto.randomUUID()),
    })
    setDescription("")
    setFieldErrors({})
  }, [open, avatarSeed])

  function shuffleName() {
    setName(randomBotName())
    setFieldErrors((prev) => ({ ...prev, name: undefined }))
  }

  function updateName(value: string) {
    setName(value)
    if (fieldErrors.name && value.trim()) {
      setFieldErrors((prev) => ({ ...prev, name: undefined }))
    }
  }

  async function submit() {
    const nextErrors = validateBotCreateFields({ name })
    setFieldErrors(nextErrors)
    if (hasBotCreateFieldErrors(nextErrors)) return

    try {
      const data = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        image: avatarDraft.kind === "procedural" ? avatarDraft.image : undefined,
      })
      // Bots don't have an id until creation resolves — the photo upload is
      // deferred until now so a cropped-then-cancelled dialog never uploads
      // anything. Surface an upload failure without blocking on it; the bot
      // itself was already created successfully.
      let avatarFailed = false
      if (avatarDraft.kind === "photo" && avatarDraft.file) {
        try {
          await uploadBotAvatar.mutateAsync({ botId: data.bot.id, file: avatarDraft.file })
        } catch (e) {
          avatarFailed = true
          toastApiError(e, "Bot created, but the avatar photo failed to upload")
        }
      }
      if (!avatarFailed) toast.success(`Created ${name.trim()}`)
      onOpenChange(false)
      await onCreated?.(data.bot)
    } catch (e) {
      toastApiError(e, "Couldn't create the bot")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <SheetContent
        side="right"
        showOverlay={false}
        className="data-[side=right]:sm:inset-y-2 data-[side=right]:sm:right-2 data-[side=right]:sm:h-auto data-[side=right]:sm:rounded-xl data-[side=right]:sm:border data-[side=right]:sm:overflow-hidden"
      >
        <SheetHeader>
          <SheetTitle>Create a bot</SheetTitle>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          <BotFormFields
            avatarDraft={avatarDraft}
            onAvatarChange={setAvatarDraft}
            name={name}
            setName={updateName}
            onShuffle={shuffleName}
            description={description}
            setDescription={setDescription}
            nameError={fieldErrors.name}
          />

        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create bot"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

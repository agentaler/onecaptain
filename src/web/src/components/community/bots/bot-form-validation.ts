export interface BotCreateRequiredFields {
  name: string
}

export interface BotCreateFieldErrors {
  name?: string
}

/**
 * A name is the only thing an agent genuinely needs.
 *
 * This used to also demand a machine and a runtime, which made creating an
 * agent impossible without the daemon installed — with a perfectly good LLM key
 * configured. An agent runs on a provider key now, so neither is a
 * prerequisite.
 */
export function validateBotCreateFields({
  name,
}: BotCreateRequiredFields): BotCreateFieldErrors {
  const errors: BotCreateFieldErrors = {}

  if (!name.trim()) {
    errors.name = "Name is required"
  }

  return errors
}

export function hasBotCreateFieldErrors(errors: BotCreateFieldErrors): boolean {
  return Boolean(errors.name)
}

/**
 * Validate a picked model value (the `string | null` the ModelField emits). A
 * `Custom…` selection that was left empty resolves to `null` (Default), which
 * is valid; the only failure is a name over the server's 100-char cap. Returns
 * an error message, or undefined when the model is acceptable.
 */
export function validateBotModel(model: string | null): string | undefined {
  if (model === null) return undefined
  if (model.trim().length === 0) return "Enter a model name"
  if (model.length > 100) return "Model name must be 100 characters or fewer"
  return undefined
}

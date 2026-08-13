"use client"

import { useState } from "react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { GradientBackground } from "@/components/gradient-background"
import { Logo } from "@/components/logo"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    })
    setLoading(false)
    if (error) {
      setError(error.message ?? "Couldn't send the reset email — retry")
      return
    }
    setSent(true)
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center p-6 sm:p-10">
      <GradientBackground />
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center mb-2">
            <Logo size="lg" />
          </div>
          <Card>
            <CardContent className="p-6 sm:p-8">
              {sent ? (
                <FieldGroup>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-2xl font-bold">Check your email</h1>
                    <p className="text-sm text-muted-foreground">
                      If an account exists for <strong>{email}</strong>, a reset
                      link is on its way
                    </p>
                  </div>
                  <Link href="/sign-in" className={buttonVariants({ variant: "outline", className: "w-full" })}>
                    Back to sign in
                  </Link>
                </FieldGroup>
              ) : (
                <form onSubmit={handleSubmit}>
                  <FieldGroup>
                    <div className="flex flex-col items-center gap-2 text-center">
                      <h1 className="text-2xl font-bold">Reset your password</h1>
                      <p className="text-sm text-muted-foreground">
                        Enter your email — we&rsquo;ll send a reset link
                      </p>
                    </div>
                    {error && <FieldError>{error}</FieldError>}
                    <Field>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </Field>
                    <Field>
                      <Button type="submit" disabled={loading} className="w-full">
                        {loading ? "Sending…" : "Send reset link"}
                      </Button>
                    </Field>
                    <p className="text-center text-sm text-muted-foreground">
                      <Link href="/sign-in" className="underline underline-offset-4">
                        Back to sign in
                      </Link>
                    </p>
                  </FieldGroup>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

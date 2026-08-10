"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { isTauri, isDesktop, tauriInvoke } from "@onecaptain/shared";

export function TauriThemeSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!isTauri() || !isDesktop()) return;
    if (!resolvedTheme) return;

    tauriInvoke("set_window_theme", { dark: resolvedTheme === "dark" })
      .then(() => tauriInvoke("close_splashscreen"))
      .catch(() => {});
  }, [resolvedTheme]);

  return null;
}

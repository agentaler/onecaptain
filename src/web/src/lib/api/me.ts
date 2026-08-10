import type { User } from "@onecaptain/shared";
import { apiFetch } from "./client";

export const getMe = () => apiFetch<User>("/api/me");

import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { getSession } from "@/lib/session";

const HomePage = dynamic(
  () => import("@/components/home/home-page").then((module) => ({ default: module.HomePage })),
  { ssr: true },
);

export const metadata: Metadata = {
  title: { absolute: "OneCaptain — Legacy landing" },
  description: "The previous OneCaptain landing page, preserved for reference.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Page() {
  const session = await getSession();
  return <HomePage isLoggedIn={!!session} />;
}

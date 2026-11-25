import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal Belajar — SMA NU Kaplongan" },
      {
        name: "description",
        content:
          "Portal terpadu Informatika & Koding Kecerdasan Artifisial untuk siswa dan guru SMA NU Kaplongan.",
      },
      { property: "og:title", content: "Portal Belajar — SMA NU Kaplongan" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Akses materi, tugas, quiz, dan pantau perkembangan belajar Informatika & KKA.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/portal-belajar.html");
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Membuka Portal Belajar…</p>
    </div>
  );
}

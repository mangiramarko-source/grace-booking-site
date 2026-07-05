import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin-login")({
  head: () => ({ meta: [{ title: "Admin — Hair by Makanye" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});

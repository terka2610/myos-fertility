import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/programs/egg-freezing")({
  beforeLoad: () => { throw redirect({ to: "/", statusCode: 301 }); },
});

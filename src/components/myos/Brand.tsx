import { Link } from "@tanstack/react-router";

export function Brand({ to = "/" }: { to?: "/" | "/dashboard" | "/twin" }) {
  return (
    <Link to={to} className="font-display text-2xl tracking-tight text-foreground">MYOS</Link>
  );
}

export function Disclosure({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-pink-soft px-4 py-1.5 text-center text-xs text-secondary-foreground ${className}`}>
      AI digital twins of doctors, not live consultations. Education only, not an emergency service.
    </div>
  );
}

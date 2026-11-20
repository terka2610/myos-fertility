import { Link } from "@tanstack/react-router";
import { Brand } from "./Brand";
import { useAuth } from "@/hooks/useAuth";

export function PublicHeader() {
  const { user } = useAuth();
  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-10">
      <Brand />
      <nav className="flex items-center gap-5 text-sm font-medium">
        <Link to="/about" className="hidden text-muted-foreground hover:text-foreground sm:inline">About</Link>
        <Link to="/resources" className="text-muted-foreground hover:text-foreground">Resources</Link>
        {user ? <Link to="/twin" className="hover:text-accent">Open app</Link> : <Link to="/login" className="hover:text-accent">Log in</Link>}
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-10 text-sm text-muted-foreground md:px-10">
      <span className="font-display text-xl text-foreground">MYOS</span>
      <span className="flex gap-6"><Link to="/about">About</Link><Link to="/contact">Contact</Link><span>© 2026 MYOS</span></span>
    </footer>
  );
}

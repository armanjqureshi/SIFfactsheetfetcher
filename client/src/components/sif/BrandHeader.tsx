import { Link, useLocation } from "wouter";
import { FileSearch, LogIn, LogOut, Menu, ShieldCheck } from "lucide-react";
import { useState } from "react";

type BrandHeaderProps = {
  userName?: string | null;
  onLogin: () => void;
  onLogout: () => void;
};

const nav = [
  { href: "/", label: "Library" },
  { href: "/comparison", label: "Compare" },
  { href: "/sources", label: "Official sources" },
];

export function BrandHeader({ userName, onLogin, onLogout }: BrandHeaderProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand-lockup" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark"><FileSearch size={17} strokeWidth={2.4} /></span>
          <span>
            <strong>1 Finance</strong>
            <small>SIF factsheet reader</small>
          </span>
        </Link>
        <button className="icon-button mobile-only" type="button" aria-label="Toggle navigation" onClick={() => setMobileOpen((open) => !open)}>
          <Menu size={20} />
        </button>
        <nav className={`primary-nav ${mobileOpen ? "open" : ""}`} aria-label="Primary navigation">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={location === item.href || (item.href === "/" && location.startsWith("/reader")) ? "active" : ""} onClick={() => setMobileOpen(false)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-account">
          {userName ? (
            <>
              <span className="verified-user"><ShieldCheck size={15} /> {userName.split(" ")[0]}</span>
              <button className="text-button" type="button" onClick={onLogout}><LogOut size={15} /> Sign out</button>
            </>
          ) : (
            <button className="header-login" type="button" onClick={onLogin}><LogIn size={15} /> Sign in</button>
          )}
        </div>
      </div>
    </header>
  );
}

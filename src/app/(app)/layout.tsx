import Link from "next/link";
import Logo from "@/components/Logo";
import { UserButton } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk-enabled";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <Logo size={40} />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-neutral-300 hover:text-white">Dashboard</Link>
          <Link href="/create" className="text-neutral-300 hover:text-white">Create</Link>
          <Link href="/gallery" className="text-neutral-300 hover:text-white">Gallery</Link>
          {clerkEnabled && <UserButton afterSignOutUrl="/" />}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </>
  );
}

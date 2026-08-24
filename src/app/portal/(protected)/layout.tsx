import Image from "next/image";
import Link from "next/link";
import { requirePortalIdentity } from "@/features/portal/server/data";
import { logoutPortal } from "@/features/portal/server/actions";

export default async function PortalProtectedLayout({ children }: { children: React.ReactNode }) {
  const identity = await requirePortalIdentity();
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/portal" className="flex items-center gap-3">
            <Image src="/brand/actiiva-symbol-primary.svg" alt="" width={28} height={28} className="h-7 w-auto" />
            <span className="text-sm font-semibold text-foreground">Mi ACTIIVA</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-muted sm:inline">{identity.email}</span>
            <form action={logoutPortal}><button type="submit" className="text-sm font-medium text-secondary hover:text-foreground">Salir</button></form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

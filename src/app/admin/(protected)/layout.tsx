import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { logoutAdmin } from "@/features/discovery-admin/server/actions";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/admin/discovery" className="flex items-center gap-3">
            <Image src="/brand/actiiva-symbol-primary.svg" alt="" width={28} height={28} className="h-7 w-auto" />
            <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">Operaciones de Discovery</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-muted sm:inline">{admin.email}</span>
            <form action={logoutAdmin}>
              <button type="submit" className="text-sm font-medium text-secondary hover:text-foreground">Salir</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Plus,
  ChefHat,
  Users,
  Package,
  Boxes,
  Sparkles,
  Wallet,
  BarChart3,
  Settings,
  Search,
  LogOut,
  Leaf,
  Menu,
  Receipt,
  Banknote,
  Blocks,
  ShieldCheck,

} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { GlobalSearch } from "./global-search";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  financeiroOnly?: boolean;
  mobilePrimary?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, mobilePrimary: true },
  { to: "/pedidos/novo", label: "Nova comanda", icon: Plus, mobilePrimary: true },
  { to: "/pedidos", label: "Comandas", icon: Receipt, mobilePrimary: true },
  { to: "/cozinha", label: "Cozinha", icon: ChefHat, mobilePrimary: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/composicao", label: "Composição", icon: Blocks, adminOnly: true },
  { to: "/meu-slim", label: "Meu Slim", icon: Sparkles },

  { to: "/financeiro", label: "Financeiro", icon: Wallet, financeiroOnly: true },
  { to: "/caixa", label: "Caixa", icon: Banknote },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/auditoria", label: "Auditoria", icon: ShieldCheck, adminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { perfil, isAdmin, podeFinanceiro } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const visibleNav = NAV.filter(
    (n) => (!n.adminOnly || isAdmin) && (!n.financeiroOnly || podeFinanceiro)
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const mobilePrimary = visibleNav.filter((n) => n.mobilePrimary).slice(0, 4);
  const moreItems = visibleNav.filter((n) => !mobilePrimary.includes(n));

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col text-sidebar-foreground border-r border-sidebar-border bg-[linear-gradient(180deg,var(--sidebar)_0%,oklch(0.18_0.03_152)_100%)]">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-sidebar-border/70">
          <div className="size-10 rounded-xl bg-gradient-to-br from-gold to-[oklch(0.66_0.13_75)] text-gold-foreground flex items-center justify-center shadow-md shadow-black/20">
            <Leaf className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="font-heading font-bold tracking-tight">FitLounge</div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/50">Gestão</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const active = isActive(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")
                }
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-sidebar-accent/60 text-left">
                <div className="size-8 rounded-full bg-gold text-gold-foreground flex items-center justify-center text-sm font-semibold">
                  {(perfil?.nome ?? "U").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{perfil?.nome ?? "Usuário"}</div>
                  <div className="text-[11px] text-sidebar-foreground/60 capitalize">{perfil?.role}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{perfil?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 size-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur flex items-center gap-2 px-4 md:px-6">
          {/* Mobile menu trigger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
              <div className="px-5 py-5 flex items-center gap-2.5 border-b border-sidebar-border">
                <div className="size-9 rounded-lg bg-gold text-gold-foreground flex items-center justify-center">
                  <Leaf className="size-5" />
                </div>
                <div className="font-heading font-bold">FitLounge</div>
              </div>
              <nav className="p-3 space-y-1">
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to as any} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/60">
                      <Icon className="size-4" /> {item.label}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex-1 flex items-center gap-2 h-9 px-3 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground text-sm border border-border max-w-xl"
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Buscar clientes, pedidos, produtos...</span>
            <span className="sm:hidden">Buscar...</span>
            <kbd className="ml-auto hidden md:inline text-[10px] bg-background px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
          </button>

          <QuickActions />
        </header>

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>

        {/* Bottom nav mobile */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border">
          <div className="grid grid-cols-5">
            {mobilePrimary.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.to);
              return (
                <Link key={item.to} to={item.to as any} className={"flex flex-col items-center justify-center py-2.5 text-[11px] gap-0.5 " + (active ? "text-gold" : "text-sidebar-foreground/70")}>
                  <Icon className="size-5" />
                  <span className="truncate max-w-full px-1">{item.label.split(" ")[0]}</span>
                </Link>
              );
            })}
            <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center justify-center py-2.5 text-[11px] gap-0.5 text-sidebar-foreground/70">
              <Menu className="size-5" />
              <span>Mais</span>
            </button>
          </div>
        </nav>

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <div className="grid grid-cols-3 gap-3 py-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to as any} onClick={() => setMoreOpen(false)} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/60 hover:bg-muted">
                    <Icon className="size-5 text-primary" />
                    <span className="text-xs text-center">{item.label}</span>
                  </Link>
                );
              })}
              <button onClick={handleLogout} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/60 hover:bg-muted">
                <LogOut className="size-5 text-destructive" />
                <span className="text-xs">Sair</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </div>
  );
}

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(to + "/");
}

function QuickActions() {
  const { podeFinanceiro } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5 bg-gold text-gold-foreground hover:bg-gold/90">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Novo</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Ação rápida</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/pedidos/novo">Nova comanda</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link to="/clientes">Clientes</Link></DropdownMenuItem>
        {podeFinanceiro && <DropdownMenuItem asChild><Link to="/financeiro">Financeiro</Link></DropdownMenuItem>}
        <DropdownMenuItem asChild><Link to="/estoque">Estoque</Link></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

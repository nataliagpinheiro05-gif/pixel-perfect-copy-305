import { useEffect, useState } from "react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Users, Receipt, Package, Boxes, Sparkles } from "lucide-react";

type Resultado = {
  id: string;
  label: string;
  hint?: string;
  to: string;
  group: "Clientes" | "Pedidos" | "Produtos" | "Estoque" | "Meu Slim";
  icon: React.ComponentType<{ className?: string }>;
};

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Resultado[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const term = q.trim();
    const numericTerm = term.replace(/\D/g, "");
    let cancelled = false;
    (async () => {
      const [cli, ped, prod, est, slim] = await Promise.all([
        supabase.from("clientes").select("id,nome,telefone").or(`nome.ilike.%${term}%,telefone.ilike.%${term}%`).limit(5),
        numericTerm
          ? supabase.from("pedidos").select("id,numero,total").eq("numero", Number(numericTerm)).limit(5)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("produtos").select("id,nome").ilike("nome", `%${term}%`).limit(5),
        supabase.from("estoque_itens").select("id,nome").ilike("nome", `%${term}%`).limit(5),
        supabase.from("meu_slim_vendas").select("id,nome_cliente,tipo_kit").or(`nome_cliente.ilike.%${term}%,tipo_kit.ilike.%${term}%`).limit(5),
      ]);
      if (cancelled) return;
      const out: Resultado[] = [];
      (cli.data ?? []).forEach((c: any) => out.push({ id: c.id, label: c.nome, hint: c.telefone, to: `/clientes?q=${encodeURIComponent(c.nome)}`, group: "Clientes", icon: Users }));
      (ped.data ?? []).forEach((p: any) => out.push({ id: p.id, label: `Pedido #${p.numero}`, to: `/pedidos/${p.id}`, group: "Pedidos", icon: Receipt }));
      (prod.data ?? []).forEach((p: any) => out.push({ id: p.id, label: p.nome, to: `/produtos`, group: "Produtos", icon: Package }));
      (est.data ?? []).forEach((p: any) => out.push({ id: p.id, label: p.nome, to: `/estoque`, group: "Estoque", icon: Boxes }));
      (slim.data ?? []).forEach((s: any) => out.push({ id: s.id, label: s.nome_cliente, hint: s.tipo_kit, to: `/meu-slim`, group: "Meu Slim", icon: Sparkles }));
      setResults(out);
    })();
    return () => { cancelled = true; };
  }, [q, open]);

  const groups = Array.from(new Set(results.map((r) => r.group)));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar cliente, pedido, produto..." value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g} heading={g}>
            {results.filter((r) => r.group === g).map((r) => {
              const Icon = r.icon;
              return (
                <CommandItem key={r.group + r.id} value={r.group + r.id + r.label} onSelect={() => { onOpenChange(false); navigate({ to: r.to as any }); }}>
                  <Icon className="size-4 mr-2" /> {r.label}
                  {r.hint && <span className="ml-auto text-xs text-muted-foreground">{r.hint}</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

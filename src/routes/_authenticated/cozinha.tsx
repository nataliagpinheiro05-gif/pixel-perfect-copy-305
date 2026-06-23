import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { ChefHat, Clock, CheckCircle2, Truck, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cozinha")({
  head: () => ({ meta: [{ title: "Cozinha — FitLounge" }] }),
  component: CozinhaPage,
});

type Item = {
  id: string;
  nome_produto: string;
  quantidade: number;
  sabor: string | null;
  adicionais: { nome: string; preco: number }[];
  observacoes: string | null;
};
type Pedido = {
  id: string;
  numero: number;
  data_hora: string;
  total: number;
  status_pedido: "em_preparo" | "pronto" | "entregue" | "cancelado";
  observacoes: string | null;
  cliente: { nome: string; telefone: string | null } | null;
  pedido_itens: Item[];
};

const STATUS_COLOR: Record<string, string> = {
  em_preparo: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  pronto: "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
  entregue: "bg-gray-500/10 text-gray-700 border-gray-500/30 dark:text-gray-400",
  cancelado: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
};
const STATUS_LABEL: Record<string, string> = {
  em_preparo: "Em preparo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function CozinhaPage() {
  const qc = useQueryClient();
  const [verCancelados, setVerCancelados] = useState(false);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["cozinha-pedidos", verCancelados],
    queryFn: async () => {
      let q = supabase
        .from("pedidos")
        .select("id,numero,data_hora,total,status_pedido,observacoes,cliente:clientes(nome,telefone),pedido_itens(id,nome_produto,quantidade,sabor,adicionais,observacoes)")
        .order("data_hora", { ascending: true });
      q = verCancelados ? q.eq("status_pedido", "cancelado") : q.in("status_pedido", ["em_preparo", "pronto"]);
      const { data } = await q;
      return (data ?? []) as unknown as Pedido[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("cozinha-pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        qc.invalidateQueries({ queryKey: ["cozinha-pedidos"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_itens" }, () => {
        qc.invalidateQueries({ queryKey: ["cozinha-pedidos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function mudarStatus(p: Pedido, novo: Pedido["status_pedido"]) {
    const { error } = await supabase.from("pedidos").update({ status_pedido: novo }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pedido #${p.numero} → ${STATUS_LABEL[novo]}`);
    qc.invalidateQueries({ queryKey: ["cozinha-pedidos"] });
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ChefHat className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Cozinha / Preparo</h1>
            <p className="text-sm text-muted-foreground">Atualizado em tempo real</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={verCancelados} onCheckedChange={setVerCancelados} />
          Ver cancelados
        </label>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
      {!isLoading && pedidos.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ChefHat className="size-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum pedido ativo no momento.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pedidos.map((p) => {
          const idadeMin = (Date.now() - new Date(p.data_hora).getTime()) / 60000;
          const urgente = p.status_pedido === "em_preparo" && idadeMin > 10;
          return (
            <Card key={p.id} className={"p-4 border-l-4 " + (urgente ? "border-l-destructive" : "border-l-primary")}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-lg font-bold">#{p.numero}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> {new Date(p.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {urgente && <span className="ml-1 text-destructive font-semibold">há {Math.round(idadeMin)}min</span>}
                  </div>
                </div>
                <Badge variant="outline" className={STATUS_COLOR[p.status_pedido]}>{STATUS_LABEL[p.status_pedido]}</Badge>
              </div>
              {p.cliente && <div className="text-sm font-medium mb-2">{p.cliente.nome}</div>}
              <ul className="space-y-1.5 text-sm border-y border-border py-2 my-2">
                {p.pedido_itens.map((it) => (
                  <li key={it.id}>
                    <div className="font-medium">{it.quantidade}× {it.nome_produto}</div>
                    {it.sabor && <div className="text-xs text-muted-foreground pl-3">• Sabor: {it.sabor}</div>}
                    {Array.isArray(it.adicionais) && it.adicionais.length > 0 && (
                      <div className="text-xs text-muted-foreground pl-3">+ {it.adicionais.map((a) => a.nome).join(", ")}</div>
                    )}
                    {it.observacoes && <div className="text-xs italic text-muted-foreground pl-3">"{it.observacoes}"</div>}
                  </li>
                ))}
              </ul>
              {p.observacoes && <div className="text-xs italic text-muted-foreground mb-2">Obs: {p.observacoes}</div>}
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-primary">{brl(p.total)}</div>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {p.status_pedido === "em_preparo" && (
                  <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => mudarStatus(p, "pronto")}>
                    <CheckCircle2 className="size-4 mr-1" /> Pronto
                  </Button>
                )}
                {p.status_pedido === "pronto" && (
                  <Button size="sm" className="flex-1" onClick={() => mudarStatus(p, "entregue")}>
                    <Truck className="size-4 mr-1" /> Entregue
                  </Button>
                )}
                {p.status_pedido !== "cancelado" && p.status_pedido !== "entregue" && (
                  <Button size="sm" variant="outline" onClick={() => mudarStatus(p, "cancelado")}>
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}

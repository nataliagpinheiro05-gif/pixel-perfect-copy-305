import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { Plus, Receipt, ChevronRight, Clock } from "lucide-react";
import { STATUS_COMANDA_COLOR, STATUS_COMANDA_LABEL } from "@/lib/pedido-fluxo";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({ meta: [{ title: "Comandas — FitLounge" }] }),
  component: ComandasListPage,
});

const FILTROS = [
  { key: "abertas", label: "Em aberto" },
  { key: "pagas", label: "Pagas" },
  { key: "canceladas", label: "Canceladas" },
  { key: "todas", label: "Todas" },
] as const;

function ComandasListPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["key"]>("abertas");

  const { data: comandas = [] } = useQuery({
    queryKey: ["comandas-list", filtro],
    queryFn: async () => {
      let q = supabase.from("pedidos")
        .select("id,numero,aberta_em,data_hora,total,status_comanda,forma_pagamento,cliente:clientes(nome),cliente_nome_rapido")
        .order("aberta_em", { ascending: false, nullsFirst: false })
        .limit(200);
      if (filtro === "abertas") q = q.in("status_comanda", ["aberta", "em_consumo", "aguardando_pagamento"]);
      if (filtro === "pagas") q = q.eq("status_comanda", "paga");
      if (filtro === "canceladas") q = q.eq("status_comanda", "cancelada");
      const { data } = await q;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("comandas-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        qc.invalidateQueries({ queryKey: ["comandas-list"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="size-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Comandas</h1>
        </div>
        <Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Link to="/pedidos/novo"><Plus className="mr-1 size-4" /> Nova comanda</Link>
        </Button>
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {FILTROS.map((f) => (
          <Button key={f.key} size="sm" variant={filtro === f.key ? "default" : "outline"} onClick={() => setFiltro(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {comandas.map((c: any) => {
          const nome = c.cliente?.nome ?? c.cliente_nome_rapido ?? "Consumidor balcão";
          const status = c.status_comanda as string;
          return (
            <Link key={c.id} to={"/pedidos/$id" as any} params={{ id: c.id } as any}>
              <Card className="p-3 flex items-center justify-between gap-3 flex-wrap hover:border-primary transition-colors">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-bold">#{c.numero} <span className="text-sm font-normal text-muted-foreground">— {nome}</span></div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> {new Date(c.aberta_em ?? c.data_hora).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={STATUS_COMANDA_COLOR[status] ?? ""}>{STATUS_COMANDA_LABEL[status] ?? status}</Badge>
                  <div className="font-semibold text-primary">{brl(c.total)}</div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          );
        })}
        {comandas.length === 0 && <p className="text-center py-12 text-muted-foreground">Nenhuma comanda neste filtro.</p>}
      </div>
    </>
  );
}

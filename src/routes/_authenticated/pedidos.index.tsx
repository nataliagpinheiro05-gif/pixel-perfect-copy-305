import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { Plus, Receipt, ChevronRight, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { STATUS_COLOR, STATUS_LABEL, nextStatus, NEXT_LABEL } from "@/lib/pedido-fluxo";
import { ConfirmarPagamentoDialog } from "@/components/confirmar-pagamento-dialog";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — FitLounge" }] }),
  component: PedidosListPage,
});

const FILTROS = [
  { key: "pendentes", label: "A receber" },
  { key: "ativos", label: "Em andamento" },
  { key: "pagos", label: "Pagos" },
  { key: "todos", label: "Todos" },
] as const;

function PedidosListPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["key"]>("pendentes");
  const [pagAlvo, setPagAlvo] = useState<{ id: string; numero: number; total: number } | null>(null);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-list", filtro],
    queryFn: async () => {
      let q = supabase.from("pedidos")
        .select("id,numero,data_hora,total,status_pedido,status_pagamento,forma_pagamento,cliente:clientes(nome)")
        .order("data_hora", { ascending: false }).limit(150);
      if (filtro === "pendentes") q = q.eq("status_pagamento", "pendente").not("status_pedido", "eq", "cancelado");
      if (filtro === "ativos") q = q.not("status_pedido", "in", "(entregue,cancelado)");
      if (filtro === "pagos") q = q.eq("status_pagamento", "pago");
      const { data } = await q;
      return data ?? [];
    },
  });

  async function avancar(p: any) {
    const proximo = nextStatus(p.status_pedido);
    if (!proximo) return;
    const { error } = await supabase.from("pedidos").update({ status_pedido: proximo as any }).eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success(`#${p.numero} → ${STATUS_LABEL[proximo]}`); qc.invalidateQueries({ queryKey: ["pedidos-list"] }); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="size-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Pedidos / Vendas</h1>
        </div>
        <Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Link to="/pedidos/novo"><Plus className="mr-1 size-4" /> Nova venda</Link>
        </Button>
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {FILTROS.map((f) => (
          <Button key={f.key} size="sm" variant={filtro === f.key ? "default" : "outline"} onClick={() => setFiltro(f.key)}>{f.label}</Button>
        ))}
      </div>

      <div className="space-y-2">
        {pedidos.map((p: any) => {
          const proximo = nextStatus(p.status_pedido);
          const pago = p.status_pagamento === "pago";
          const cancelado = p.status_pedido === "cancelado";
          return (
            <Card key={p.id} className="p-3 flex items-center justify-between gap-3 flex-wrap hover:border-primary transition-colors">
              <Link to={"/pedidos/$id" as any} params={{ id: p.id } as any} className="flex-1 min-w-[180px]">
                <div className="font-bold">#{p.numero} <span className="text-sm font-normal text-muted-foreground">— {p.cliente?.nome ?? "Sem cliente"}</span></div>
                <div className="text-xs text-muted-foreground">{new Date(p.data_hora).toLocaleString("pt-BR")}</div>
              </Link>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={STATUS_COLOR[p.status_pedido]}>{STATUS_LABEL[p.status_pedido]}</Badge>
                <Badge variant="outline" className={pago ? "bg-green-500/10 text-green-700 dark:text-green-400" : cancelado ? "bg-gray-500/10 text-gray-700" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}>
                  {pago ? "Pago" : cancelado ? "—" : "Pendente"}
                </Badge>
                <div className="font-semibold text-primary">{brl(p.total)}</div>
                {!pago && !cancelado && (
                  <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={(e) => { e.preventDefault(); setPagAlvo({ id: p.id, numero: p.numero, total: Number(p.total) }); }}>
                    <DollarSign className="size-4 mr-1" /> Dar baixa
                  </Button>
                )}
                {proximo && !pago && (
                  <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); avancar(p); }}>
                    {NEXT_LABEL[p.status_pedido]} <ChevronRight className="size-4 ml-1" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {pedidos.length === 0 && <p className="text-center py-12 text-muted-foreground">Nenhum pedido neste filtro.</p>}
      </div>

      {pagAlvo && (
        <ConfirmarPagamentoDialog
          pedidoId={pagAlvo.id} numero={pagAlvo.numero} total={pagAlvo.total}
          open onClose={() => setPagAlvo(null)}
          onConfirmed={() => qc.invalidateQueries({ queryKey: ["pedidos-list"] })}
        />
      )}
    </>
  );
}

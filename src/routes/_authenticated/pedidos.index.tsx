import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { Plus, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — FitLounge" }] }),
  component: PedidosListPage,
});

const COR: Record<string, string> = {
  em_preparo: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  pronto: "bg-green-500/10 text-green-700 dark:text-green-400",
  entregue: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
  cancelado: "bg-red-500/10 text-red-700 dark:text-red-400",
};
const LABEL: Record<string, string> = { em_preparo: "Em preparo", pronto: "Pronto", entregue: "Entregue", cancelado: "Cancelado" };

function PedidosListPage() {
  const { data: pedidos = [] } = useQuery({
    queryKey: ["pedidos-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id,numero,data_hora,total,status_pedido,status_pagamento,forma_pagamento,cliente:clientes(nome)")
        .order("data_hora", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="size-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Pedidos</h1>
        </div>
        <Button asChild className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Link to="/pedidos/novo"><Plus className="mr-1 size-4" /> Novo pedido</Link>
        </Button>
      </div>

      <div className="space-y-2">
        {pedidos.map((p: any) => (
          <Link key={p.id} to={"/pedidos/$id" as any} params={{ id: p.id }}>
            <Card className="p-3 flex items-center justify-between hover:border-primary transition-colors">
              <div>
                <div className="font-bold">#{p.numero} <span className="text-sm font-normal text-muted-foreground">— {p.cliente?.nome ?? "Sem cliente"}</span></div>
                <div className="text-xs text-muted-foreground">{new Date(p.data_hora).toLocaleString("pt-BR")} · {p.forma_pagamento ?? "—"}</div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={COR[p.status_pedido]}>{LABEL[p.status_pedido]}</Badge>
                <div className="font-semibold text-primary">{brl(p.total)}</div>
              </div>
            </Card>
          </Link>
        ))}
        {pedidos.length === 0 && <p className="text-center py-12 text-muted-foreground">Nenhum pedido ainda.</p>}
      </div>
    </AppShell>
  );
}

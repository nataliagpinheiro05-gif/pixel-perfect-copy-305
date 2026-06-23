import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Copy, Trash2, X } from "lucide-react";


export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  head: () => ({ meta: [{ title: "Pedido — FitLounge" }] }),
  component: PedidoDetailPage,
});

function PedidoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, perfil } = useAuth();

  const { data: pedido } = useQuery({
    queryKey: ["pedido", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*, cliente:clientes(id,nome,telefone), pedido_itens(*)")
        .eq("id", id)
        .maybeSingle();
      return data as any;
    },
  });

  if (!pedido) return <AppShell><p className="text-muted-foreground">Carregando...</p></AppShell>;

  async function update(patch: any) {
    const { error } = await supabase.from("pedidos").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["pedido", id] }); }
  }

  async function cancelar() {
    if (!confirm("Cancelar este pedido? O estoque e o financeiro serão revertidos.")) return;
    await update({ status_pedido: "cancelado", status_pagamento: "cancelado" });
  }

  async function excluir() {
    if (!isAdmin) return;
    if (!confirm("Excluir permanentemente?")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); navigate({ to: "/pedidos" as any }); }
  }

  async function duplicar() {
    const { data: novo, error } = await supabase.from("pedidos").insert({
      cliente_id: pedido.cliente_id,
      forma_pagamento: pedido.forma_pagamento,
      status_pagamento: "pendente",
      observacoes: pedido.observacoes,
      usuario_id: perfil?.id ?? null,
    }).select("id, numero").single();
    if (error || !novo) { toast.error(error?.message ?? "Erro"); return; }
    const itens = pedido.pedido_itens.map((it: any) => ({
      pedido_id: novo.id, produto_id: it.produto_id, nome_produto: it.nome_produto,
      quantidade: it.quantidade, preco_unitario: it.preco_unitario, custo_unitario: it.custo_unitario,
      sabor: it.sabor, adicionais: it.adicionais, observacoes: it.observacoes,
    }));
    const { error: e2 } = await supabase.from("pedido_itens").insert(itens);
    if (e2) { toast.error(e2.message); return; }
    toast.success(`Pedido #${novo.numero} duplicado`);
    navigate({ to: "/pedidos/$id" as any, params: { id: novo.id } });
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pedidos" as any })}><ArrowLeft className="size-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold">Pedido #{pedido.numero}</h1>
          <p className="text-sm text-muted-foreground">{new Date(pedido.data_hora).toLocaleString("pt-BR")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={duplicar}><Copy className="size-4 mr-1" /> Duplicar</Button>
        {pedido.status_pedido !== "cancelado" && (
          <Button variant="outline" size="sm" onClick={cancelar}><X className="size-4 mr-1" /> Cancelar</Button>
        )}
        {isAdmin && <Button variant="destructive" size="sm" onClick={excluir}><Trash2 className="size-4" /></Button>}
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Cliente</div>
          <div className="font-medium mb-4">{pedido.cliente?.nome ?? "Sem cliente"} {pedido.cliente?.telefone && <span className="text-muted-foreground text-sm">— {pedido.cliente.telefone}</span>}</div>

          <div className="text-sm font-semibold mb-2">Itens</div>
          <ul className="divide-y divide-border">
            {pedido.pedido_itens.map((it: any) => (
              <li key={it.id} className="py-2">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{it.quantidade}× {it.nome_produto}</div>
                    {it.sabor && <div className="text-xs text-muted-foreground">Sabor: {it.sabor}</div>}
                    {Array.isArray(it.adicionais) && it.adicionais.length > 0 && (
                      <div className="text-xs text-muted-foreground">+ {it.adicionais.map((a: any) => a.nome).join(", ")}</div>
                    )}
                    {it.observacoes && <div className="text-xs italic text-muted-foreground">"{it.observacoes}"</div>}
                  </div>
                  <div className="font-semibold">{brl(it.subtotal)}</div>
                </div>
              </li>
            ))}
          </ul>
          {pedido.observacoes && <div className="mt-3 text-sm"><span className="font-semibold">Obs:</span> {pedido.observacoes}</div>}
        </Card>

        <Card className="p-4 space-y-3 h-fit">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Status do pedido</div>
            <Select value={pedido.status_pedido} onValueChange={(v) => update({ status_pedido: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="em_preparo">Em preparo</SelectItem>
                <SelectItem value="pronto">Pronto</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Pagamento</div>
            <Select value={pedido.status_pagamento} onValueChange={(v) => update({ status_pagamento: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Forma</div>
            <Select value={pedido.forma_pagamento ?? ""} onValueChange={(v) => update({ forma_pagamento: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2 border-t border-border space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{brl(pedido.subtotal)}</span></div>
            {isAdmin && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Custo</span><span>{brl(pedido.custo_total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lucro</span><span className="text-green-600">{brl(pedido.lucro_estimado)}</span></div>
              </>
            )}
            <div className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span className="text-primary">{brl(pedido.total)}</span></div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Download } from "lucide-react";
import { csvDownload } from "@/lib/relatorios";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria — FitLounge" }] }),
  component: AuditoriaPage,
});

const ACOES = [
  { v: "todas", l: "Todas as ações" },
  { v: "reabrir_comanda", l: "Reabertura de comanda" },
  { v: "cancelar_pedido", l: "Cancelamento de pedido" },
  { v: "cancelar_lancamento", l: "Cancelamento financeiro" },
  { v: "estornar_lancamento", l: "Estorno financeiro" },
  { v: "estoque_saida_manual", l: "Saída manual de estoque" },
  { v: "sangria", l: "Sangria" },
  { v: "reforco", l: "Reforço" },
  { v: "abrir_caixa", l: "Abertura de caixa" },
  { v: "fechar_caixa", l: "Fechamento de caixa" },
];

function AuditoriaPage() {
  const { isAdmin } = useAuth();
  const [acao, setAcao] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["auditoria", acao, de, ate],
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
      if (acao !== "todas") q = q.eq("acao", acao);
      if (de) q = q.gte("created_at", new Date(de + "T00:00:00").toISOString());
      if (ate) q = q.lte("created_at", new Date(ate + "T23:59:59").toISOString());
      const { data } = await q;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        Apenas administradores podem visualizar a auditoria.
      </Card>
    );
  }

  function exportar() {
    csvDownload(`auditoria_${new Date().toISOString().slice(0, 10)}.csv`,
      logs.map((l: any) => ({
        data: new Date(l.created_at).toLocaleString("pt-BR"),
        usuario: l.usuario_nome ?? "",
        acao: l.acao, entidade: l.entidade, descricao: l.descricao ?? "",
        motivo: l.motivo ?? "",
      })));
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Auditoria</h1>
        </div>
        <Button variant="outline" onClick={exportar} disabled={!logs.length}>
          <Download className="size-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      <Card className="p-4 mb-4 grid sm:grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Ação</Label>
          <Select value={acao} onValueChange={setAcao}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ACOES.map(a => <SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={e => setDe(e.target.value)} /></div>
        <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={e => setAte(e.target.value)} /></div>
        <div className="flex items-end text-xs text-muted-foreground">{logs.length} registro(s)</div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground border-b border-border bg-muted/40">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left">Usuário</th>
              <th className="text-left">Ação</th>
              <th className="text-left">Descrição</th>
              <th className="text-left">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l: any) => (
              <tr key={l.id} className="border-b border-border hover:bg-muted/40">
                <td className="p-3 whitespace-nowrap text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                <td className="font-medium">{l.usuario_nome ?? "—"}</td>
                <td><Badge variant="outline">{l.acao}</Badge></td>
                <td>{l.descricao ?? "—"}</td>
                <td className="text-muted-foreground italic">{l.motivo ?? "—"}</td>
              </tr>
            ))}
            {!logs.length && !isLoading && (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Sem registros no período.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

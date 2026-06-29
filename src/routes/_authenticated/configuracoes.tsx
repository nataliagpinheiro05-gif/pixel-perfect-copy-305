import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, Save, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase.from("users_profiles").select("role").eq("user_id", u.user.id).maybeSingle();
    if (!perfil || perfil.role !== "admin") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Configurações — FitLounge" }] }),
  component: ConfiguracoesPage,
});

const FORMAS = ["pix", "dinheiro", "debito", "credito"] as const;

function ConfiguracoesPage() {
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Settings className="size-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Configurações</h1>
      </div>
      <Tabs defaultValue="loja">
        <TabsList>
          <TabsTrigger value="loja">Loja</TabsTrigger>
          <TabsTrigger value="operacao">Operação</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
        </TabsList>
        <TabsContent value="loja" className="mt-4"><LojaForm /></TabsContent>
        <TabsContent value="operacao" className="mt-4"><OperacaoForm /></TabsContent>
        <TabsContent value="usuarios" className="mt-4"><UsuariosLista /></TabsContent>
      </Tabs>
    </>
  );
}

function useConfig() {
  return useQuery({
    queryKey: ["config-loja"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes_loja").select("*").limit(1).maybeSingle();
      return data as any;
    },
  });
}

function LojaForm() {
  const qc = useQueryClient();
  const { data: cfg } = useConfig();
  const [f, setF] = useState<any>({
    nome_loja: "", logo_url: "", cnpj: "", endereco: "", telefone: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cfg) setF({
      nome_loja: cfg.nome_loja ?? "",
      logo_url: cfg.logo_url ?? "",
      cnpj: cfg.cnpj ?? "",
      endereco: cfg.endereco ?? "",
      telefone: cfg.telefone ?? "",
    });
  }, [cfg?.id]);

  async function salvar() {
    if (!cfg?.id) return;
    setSaving(true);
    const { error } = await supabase.from("configuracoes_loja").update({
      nome_loja: f.nome_loja || null, logo_url: f.logo_url || null,
      cnpj: f.cnpj || null, endereco: f.endereco || null, telefone: f.telefone || null,
    }).eq("id", cfg.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Dados da loja salvos"); qc.invalidateQueries({ queryKey: ["config-loja"] }); }
  }

  return (
    <Card className="p-5 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><Label>Nome da loja</Label><Input value={f.nome_loja} onChange={e => setF({ ...f, nome_loja: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Logo (URL)</Label><Input value={f.logo_url} onChange={e => setF({ ...f, logo_url: e.target.value })} placeholder="https://..." /></div>
        <div><Label>CNPJ</Label><Input value={f.cnpj} onChange={e => setF({ ...f, cnpj: e.target.value })} /></div>
        <div><Label>Telefone</Label><Input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Endereço</Label><Input value={f.endereco} onChange={e => setF({ ...f, endereco: e.target.value })} /></div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={salvar} disabled={saving}><Save className="size-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}</Button>
      </div>
    </Card>
  );
}

function OperacaoForm() {
  const qc = useQueryClient();
  const { data: cfg } = useConfig();
  const [permitirNeg, setPermitirNeg] = useState(false);
  const [dias, setDias] = useState(7);
  const [formas, setFormas] = useState<string[]>([...FORMAS]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cfg) {
      setPermitirNeg(!!cfg.permitir_estoque_negativo);
      setDias(Number(cfg.dias_alerta_vencimento ?? 7));
      const ativas = Array.isArray(cfg.formas_pagamento_ativas) ? cfg.formas_pagamento_ativas : [...FORMAS];
      setFormas(ativas);
    }
  }, [cfg?.id]);

  function toggleForma(f: string) {
    setFormas((prev) => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  }

  async function salvar() {
    if (!cfg?.id) return;
    setSaving(true);
    const { error } = await supabase.from("configuracoes_loja").update({
      permitir_estoque_negativo: permitirNeg,
      dias_alerta_vencimento: dias,
      formas_pagamento_ativas: formas,
    }).eq("id", cfg.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Operação salva"); qc.invalidateQueries({ queryKey: ["config-loja"] }); }
  }

  return (
    <Card className="p-5 max-w-2xl space-y-5">
      <div>
        <div className="font-semibold mb-2">Formas de pagamento ativas</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FORMAS.map((f) => (
            <label key={f} className="flex items-center gap-2 border border-border rounded-lg p-2 cursor-pointer hover:bg-muted/50">
              <Switch checked={formas.includes(f)} onCheckedChange={() => toggleForma(f)} />
              <span className="capitalize text-sm">{f}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">Aparece no fechamento de comanda e em saídas financeiras.</p>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <div>
          <div className="font-semibold">Permitir estoque negativo</div>
          <div className="text-xs text-muted-foreground">Se desligado, a baixa falha quando não há saldo suficiente.</div>
        </div>
        <Switch checked={permitirNeg} onCheckedChange={setPermitirNeg} />
      </div>

      <div className="border-t border-border pt-4">
        <Label>Dias para alerta de vencimento</Label>
        <Input type="number" min={1} max={90} value={dias} onChange={e => setDias(Number(e.target.value))} className="max-w-[120px]" />
        <p className="text-xs text-muted-foreground mt-1">Itens com validade dentro deste prazo aparecem como alerta.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={salvar} disabled={saving}><Save className="size-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}</Button>
      </div>
    </Card>
  );
}

function UsuariosLista() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["users-profiles"],
    queryFn: async () => (await supabase.from("users_profiles").select("*").order("nome")).data ?? [],
  });

  async function alterar(id: string, patch: any) {
    const { error } = await supabase.from("users_profiles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["users-profiles"] }); }
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Users className="size-4 text-primary" />
        <span className="font-semibold">Usuários ({users.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground border-b border-border bg-muted/30">
            <tr><th className="text-left py-2 px-3">Nome</th><th className="text-left">E-mail</th><th>Papel</th><th>Ver financeiro</th><th>Ativo</th></tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-b border-border">
                <td className="px-3 py-2 font-medium">{u.nome}</td>
                <td className="text-muted-foreground">{u.email}</td>
                <td className="text-center">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"} className="cursor-pointer"
                    onClick={() => alterar(u.id, { role: u.role === "admin" ? "funcionario" : "admin" })}>
                    {u.role}
                  </Badge>
                </td>
                <td className="text-center"><Switch checked={u.pode_ver_financeiro} onCheckedChange={(v) => alterar(u.id, { pode_ver_financeiro: v })} /></td>
                <td className="text-center"><Switch checked={u.ativo} onCheckedChange={(v) => alterar(u.id, { ativo: v })} /></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Sem usuários cadastrados.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border">
        Clique no papel para alternar entre admin e funcionário. Funcionário não acessa Configurações, Financeiro (sem permissão) nem cadastros de produto/composição.
      </div>
    </Card>
  );
}

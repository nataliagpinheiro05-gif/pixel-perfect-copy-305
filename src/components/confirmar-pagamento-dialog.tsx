import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { Banknote, CreditCard, Smartphone, Wallet, CheckCircle2 } from "lucide-react";

type Forma = "pix" | "dinheiro" | "debito" | "credito";

const FORMAS: { value: Forma; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "pix", label: "Pix", icon: Smartphone },
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "debito", label: "Débito", icon: CreditCard },
  { value: "credito", label: "Crédito", icon: Wallet },
];

export function ConfirmarPagamentoDialog({
  pedidoId,
  numero,
  total,
  open,
  onClose,
  onConfirmed,
}: {
  pedidoId: string;
  numero: number;
  total: number;
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [forma, setForma] = useState<Forma | null>(null);
  const [valor, setValor] = useState<string>(String(total ?? 0));
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirmar() {
    if (!forma) { toast.error("Escolha a forma de pagamento"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("confirmar_pagamento_pedido", {
      _pedido_id: pedidoId,
      _forma_pagamento: forma as any,
      _valor_recebido: Number(valor) || total,
      _observacoes: obs || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pedido #${numero} pago e baixado no estoque ✓`);
    onConfirmed();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar pagamento • Pedido #{numero}</DialogTitle>
          <DialogDescription>
            Ao confirmar, o pedido entra no financeiro e o estoque é baixado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total a receber</span>
            <span className="text-2xl font-bold text-primary">{brl(total)}</span>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Forma de pagamento *</Label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map((f) => {
                const Icon = f.icon;
                const ativo = forma === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setForma(f.value)}
                    className={`flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors ${
                      ativo ? "border-gold bg-gold/10 text-gold-foreground" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <Icon className="size-4" /> {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Valor recebido</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div>
              <Label className="text-sm">Data</Label>
              <Input type="date" defaultValue={new Date().toISOString().slice(0, 10)} disabled />
            </div>
          </div>

          <div>
            <Label className="text-sm">Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={confirmar} disabled={saving || !forma} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <CheckCircle2 className="size-4 mr-1" /> {saving ? "Processando..." : "Confirmar pagamento / Dar baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FormaPagamento = "pix" | "dinheiro" | "debito" | "credito";
const TODAS: FormaPagamento[] = ["pix", "dinheiro", "debito", "credito"];

export function useConfigLoja() {
  const { data } = useQuery({
    queryKey: ["config-loja"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_loja")
        .select("dias_alerta_vencimento, formas_pagamento_ativas, permitir_estoque_negativo, estoque_minimo_padrao")
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const diasAlertaVencimento = Number(data?.dias_alerta_vencimento ?? 7);
  const formasAtivas = (Array.isArray(data?.formas_pagamento_ativas)
    ? (data!.formas_pagamento_ativas as string[])
    : TODAS) as FormaPagamento[];

  return { diasAlertaVencimento, formasAtivas, raw: data };
}

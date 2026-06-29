// Fluxo de Comanda do FitLounge
// 1. Abrir comanda → 2. Em consumo (adicionando itens) → 3. Aguardando pagamento → 4. Paga
// Cancelamento possível antes do pagamento.

export type StatusComanda =
  | "aberta"
  | "em_consumo"
  | "aguardando_pagamento"
  | "paga"
  | "cancelada";

export const STATUS_COMANDA_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_consumo: "Em consumo",
  aguardando_pagamento: "Aguardando pagamento",
  paga: "Paga",
  cancelada: "Cancelada",
};

export const STATUS_COMANDA_COLOR: Record<string, string> = {
  aberta: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
  em_consumo: "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400",
  aguardando_pagamento: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400",
  paga: "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
  cancelada: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
};

// Status de preparo por item (cozinha)
export type StatusPreparo = "novo" | "em_preparo" | "pronto" | "entregue" | "cancelado";

export const PREPARO_LABEL: Record<string, string> = {
  novo: "Novo",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const PREPARO_COLOR: Record<string, string> = {
  novo: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
  em_preparo: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  pronto: "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
  entregue: "bg-gray-500/10 text-gray-700 border-gray-500/30 dark:text-gray-400",
  cancelado: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
};

export const MOTIVOS_CANCELAMENTO = [
  "Cliente desistiu",
  "Erro no lançamento",
  "Erro na cozinha",
  "Produto indisponível",
  "Cortesia",
  "Perda",
  "Outro",
];

// ── Compat com código antigo ─────────────────────────────────────────────
// Algumas telas (Dashboard, telas legadas) ainda importam estes símbolos.
// Mantemos para não quebrar build enquanto o restante migra.
export type StatusPedido =
  | "recebido"
  | "na_cozinha"
  | "em_producao"
  | "em_preparo"
  | "pronto"
  | "em_entrega"
  | "entregue"
  | "cancelado";

export type StatusPagamento = "pendente" | "pago" | "cancelado";

export const STAGES: { value: StatusPedido; label: string; short: string }[] = [
  { value: "recebido", label: "Recebido", short: "Recebido" },
  { value: "na_cozinha", label: "Cozinha", short: "Cozinha" },
  { value: "em_producao", label: "Produção", short: "Produção" },
  { value: "pronto", label: "Pronto", short: "Pronto" },
  { value: "em_entrega", label: "Em entrega", short: "Entrega" },
  { value: "entregue", label: "Entregue", short: "Entregue" },
];

const ORDER: StatusPedido[] = ["recebido", "na_cozinha", "em_producao", "pronto", "em_entrega", "entregue"];

export function nextStatus(s: StatusPedido): StatusPedido | null {
  const cur = s === "em_preparo" ? "em_producao" : s;
  const i = ORDER.indexOf(cur as StatusPedido);
  if (i < 0 || i === ORDER.length - 1) return null;
  return ORDER[i + 1];
}

export const STATUS_LABEL: Record<string, string> = {
  recebido: "Recebido",
  na_cozinha: "Cozinha",
  em_producao: "Produção",
  em_preparo: "Produção",
  pronto: "Pronto",
  em_entrega: "Em entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const STATUS_COLOR: Record<string, string> = {
  recebido: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
  na_cozinha: "bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400",
  em_producao: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  em_preparo: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  pronto: "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
  em_entrega: "bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400",
  entregue: "bg-gray-500/10 text-gray-700 border-gray-500/30 dark:text-gray-400",
  cancelado: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
};

export const NEXT_LABEL: Record<string, string> = {
  recebido: "Enviar para cozinha",
  na_cozinha: "Iniciar produção",
  em_producao: "Marcar como pronto",
  em_preparo: "Marcar como pronto",
  pronto: "Sair para entrega",
  em_entrega: "Confirmar entrega",
};

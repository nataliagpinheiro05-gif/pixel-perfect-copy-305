// Fluxo do pedido: cliente pede → sistema → cozinha → produção → pronto → entrega → entregue → pagamento

export type StatusPedido =
  | "recebido"
  | "na_cozinha"
  | "em_producao"
  | "em_preparo" // legado — tratado como "em produção"
  | "pronto"
  | "em_entrega"
  | "entregue"
  | "cancelado";

export type StatusPagamento = "pendente" | "pago" | "cancelado";

export const STAGES: { value: StatusPedido; label: string; short: string }[] = [
  { value: "recebido", label: "Recebido no sistema", short: "Recebido" },
  { value: "na_cozinha", label: "Enviado para a cozinha", short: "Cozinha" },
  { value: "em_producao", label: "Em produção", short: "Produção" },
  { value: "pronto", label: "Pronto", short: "Pronto" },
  { value: "em_entrega", label: "Em entrega", short: "Entrega" },
  { value: "entregue", label: "Entregue", short: "Entregue" },
];

const ORDER: StatusPedido[] = ["recebido", "na_cozinha", "em_producao", "pronto", "em_entrega", "entregue"];

export function nextStatus(s: StatusPedido): StatusPedido | null {
  // tratar "em_preparo" legado como "em_producao"
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

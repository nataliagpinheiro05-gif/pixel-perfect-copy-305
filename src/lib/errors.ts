import { toast } from "sonner";

/**
 * Padronização de mensagens de erro em PT-BR a partir de erros do Supabase / Postgres / RLS.
 * Uso: handleError(err, "Não foi possível salvar o cliente")
 */

const MAP: Array<{ test: RegExp; msg: string }> = [
  { test: /duplicate key|unique constraint|already exists/i, msg: "Já existe um registro com esses dados." },
  { test: /violates foreign key/i, msg: "Registro relacionado não encontrado ou em uso." },
  { test: /violates row-level security|permission denied|insufficient_privilege/i, msg: "Você não tem permissão para realizar esta ação." },
  { test: /not null|null value in column/i, msg: "Preencha todos os campos obrigatórios." },
  { test: /invalid input syntax/i, msg: "Valor inválido em um dos campos." },
  { test: /JWT expired|invalid token|not authenticated/i, msg: "Sessão expirada. Entre novamente." },
  { test: /Invalid login credentials/i, msg: "E-mail ou senha inválidos." },
  { test: /Email not confirmed/i, msg: "E-mail ainda não confirmado." },
  { test: /User already registered/i, msg: "Já existe uma conta com este e-mail." },
  { test: /Password should be/i, msg: "A senha deve ter no mínimo 6 caracteres." },
  { test: /network|fetch failed|Failed to fetch/i, msg: "Sem conexão. Verifique sua internet e tente novamente." },
  { test: /timeout/i, msg: "Tempo esgotado. Tente novamente." },
];

export function friendlyError(err: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  const raw =
    (typeof err === "string" && err) ||
    (err as any)?.message ||
    (err as any)?.error_description ||
    (err as any)?.error ||
    "";
  if (!raw) return fallback;
  for (const { test, msg } of MAP) if (test.test(String(raw))) return msg;
  return String(raw);
}

export function handleError(err: unknown, fallback?: string) {
  const msg = friendlyError(err, fallback);
  // eslint-disable-next-line no-console
  console.error("[app-error]", err);
  toast.error(msg);
  return msg;
}

export function handleSuccess(msg: string) {
  toast.success(msg);
}

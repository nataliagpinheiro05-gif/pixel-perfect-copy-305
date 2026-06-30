import { z } from "zod";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

export const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(72),
});

export const signupSchema = loginSchema.extend({
  nome: z.string().trim().min(2, "Informe seu nome").max(80),
});

export const clienteSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do cliente").max(120),
  telefone: z
    .string()
    .optional()
    .transform((v) => (v ? onlyDigits(v) : ""))
    .refine((v) => !v || (v.length >= 10 && v.length <= 13), "Telefone inválido"),
  data_nascimento: z.string().optional().or(z.literal("")),
  por_quem_veio: z.string().max(80).optional().or(z.literal("")),
  quem_indicou: z.string().max(80).optional().or(z.literal("")),
  observacoes: z.string().max(1000).optional().or(z.literal("")),
});

export const produtoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do produto").max(120),
  preco: z.coerce.number().nonnegative("Preço deve ser ≥ 0"),
  categoria_id: z.string().uuid().nullable().optional(),
});

export const movimentacaoEstoqueSchema = z.object({
  item_id: z.string().uuid("Selecione um item"),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero"),
  motivo: z.string().trim().min(3, "Informe o motivo").max(200),
});

export const pagamentoComandaSchema = z.object({
  metodo: z.enum(["dinheiro", "pix", "cartao_debito", "cartao_credito", "outro"]),
  valor: z.coerce.number().positive("Valor deve ser maior que zero"),
});

export const sangriaReforcoSchema = z.object({
  valor: z.coerce.number().positive("Valor deve ser maior que zero"),
  motivo: z.string().trim().min(3, "Informe o motivo").max(200),
});

export function formatZodError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Dados inválidos";
}

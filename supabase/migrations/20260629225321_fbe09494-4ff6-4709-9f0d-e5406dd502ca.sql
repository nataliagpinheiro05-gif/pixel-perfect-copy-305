
-- 1. Configurações da loja
ALTER TABLE public.configuracoes_loja
  ADD COLUMN IF NOT EXISTS formas_pagamento_ativas jsonb NOT NULL DEFAULT '["pix","dinheiro","debito","credito"]'::jsonb,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS telefone text;

-- Garante uma linha
INSERT INTO public.configuracoes_loja (nome_loja)
SELECT 'FitLounge' WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes_loja);

-- 2. Reabertura de comanda
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS reaberta_em timestamptz,
  ADD COLUMN IF NOT EXISTS reaberta_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_reabertura text;

-- 3. Drop fluxo antigo de pagamento
DROP FUNCTION IF EXISTS public.confirmar_pagamento_pedido(uuid, forma_pagamento, numeric, text);

-- 4. RPC reabrir_comanda (admin only)
CREATE OR REPLACE FUNCTION public.reabrir_comanda(_pedido_id uuid, _motivo text)
RETURNS public.pedidos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p public.pedidos;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administrador pode reabrir comanda';
  END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo é obrigatório';
  END IF;
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF p.status_comanda <> 'paga' THEN
    RAISE EXCEPTION 'Só é possível reabrir uma comanda paga (status atual: %)', p.status_comanda;
  END IF;

  -- Devolve estoque se foi baixado
  IF p.estoque_baixado THEN
    PERFORM public.devolver_estoque_comanda(_pedido_id, 'Reabertura: ' || _motivo);
  END IF;

  -- Estorna lançamentos financeiros ativos vinculados
  UPDATE public.financeiro_lancamentos
     SET status='estornado',
         observacoes = COALESCE(observacoes,'') || E'\n[Estornado por reabertura] ' || _motivo
   WHERE pedido_id = _pedido_id AND status='ativo';

  -- Cancela pagamentos confirmados
  UPDATE public.pedido_pagamentos
     SET status='cancelado'
   WHERE pedido_id = _pedido_id AND status='confirmado';

  UPDATE public.pedidos
     SET status_comanda='em_consumo',
         status_pagamento='pendente',
         status_pedido='recebido',
         pago_em=NULL,
         fechada_em=NULL,
         valor_pago=0,
         valor_pendente=total,
         valor_recebido=NULL,
         troco=0,
         reaberta_em=now(),
         reaberta_por=auth.uid(),
         motivo_reabertura=_motivo
   WHERE id=_pedido_id
   RETURNING * INTO p;
  RETURN p;
END $$;

-- 5. RPC cancelar_lancamento_financeiro
CREATE OR REPLACE FUNCTION public.cancelar_lancamento_financeiro(_id uuid, _motivo text)
RETURNS public.financeiro_lancamentos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE l public.financeiro_lancamentos;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administrador pode cancelar lançamento';
  END IF;
  IF _motivo IS NULL OR length(trim(_motivo))=0 THEN
    RAISE EXCEPTION 'Motivo é obrigatório';
  END IF;
  UPDATE public.financeiro_lancamentos
     SET status='cancelado',
         observacoes = COALESCE(observacoes,'') || E'\n[Cancelado] ' || _motivo
   WHERE id=_id AND status='ativo'
   RETURNING * INTO l;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado ou já cancelado'; END IF;
  RETURN l;
END $$;

-- 6. Bloqueia DELETE direto em financeiro via revoke
REVOKE DELETE ON public.financeiro_lancamentos FROM authenticated, anon;

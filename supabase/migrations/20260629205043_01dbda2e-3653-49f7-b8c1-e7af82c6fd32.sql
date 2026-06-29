
-- 1) Garantir que NÃO existe trigger de baixa automática ao inserir item de pedido.
-- (A função existe, mas se algum dia for atrelada, garantimos remoção do trigger.)
DROP TRIGGER IF EXISTS tg_pedido_item_baixa_estoque ON public.pedido_itens;

-- 2) Pedidos: novos campos de controle de baixa, pagamento e cancelamento
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS desconto NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_baixado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estoque_baixado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baixado_por UUID,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
  ADD COLUMN IF NOT EXISTS valor_recebido NUMERIC(10,2);

-- 3) Financeiro: rastreabilidade e estornos
ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS referencia_tipo TEXT,
  ADD COLUMN IF NOT EXISTS referencia_id UUID,
  ADD COLUMN IF NOT EXISTS estorno_de UUID REFERENCES public.financeiro_lancamentos(id);

-- 4) Movimentações de estoque: motivo descritivo
ALTER TABLE public.estoque_movimentacoes
  ADD COLUMN IF NOT EXISTS tipo_movimentacao TEXT;

-- 5) Recriar trigger financeiro: paga = entra no financeiro (não exige "entregue")
CREATE OR REPLACE FUNCTION public.tg_pedido_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status_pagamento = 'pago' AND COALESCE(OLD.status_pagamento,'pendente') <> 'pago' THEN
    IF NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos WHERE pedido_id = NEW.id AND status='ativo') THEN
      INSERT INTO public.financeiro_lancamentos(tipo, categoria, descricao, valor, forma_pagamento, data, pedido_id, usuario_id, status, referencia_tipo, referencia_id)
      VALUES ('entrada','Venda FitLounge','Pedido #' || NEW.numero, NEW.total, NEW.forma_pagamento, COALESCE(NEW.pago_em, now())::date, NEW.id, COALESCE(NEW.baixado_por, NEW.usuario_id), 'ativo','pedido', NEW.id);
    END IF;
  ELSIF (NEW.status_pedido = 'cancelado' OR NEW.status_pagamento = 'cancelado')
        AND (COALESCE(OLD.status_pedido,'') <> 'cancelado' AND COALESCE(OLD.status_pagamento,'') <> 'cancelado') THEN
    UPDATE public.financeiro_lancamentos SET status='estornado' WHERE pedido_id = NEW.id AND status='ativo';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tg_pedidos_financeiro ON public.pedidos;
CREATE TRIGGER tg_pedidos_financeiro
AFTER UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_financeiro();

-- 6) Função: confirmar pagamento (baixa financeiro + estoque, idempotente)
CREATE OR REPLACE FUNCTION public.confirmar_pagamento_pedido(
  _pedido_id UUID,
  _forma_pagamento forma_pagamento,
  _valor_recebido NUMERIC DEFAULT NULL,
  _observacoes TEXT DEFAULT NULL
) RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p public.pedidos;
  r RECORD;
  _uid UUID := auth.uid();
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id = _pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_pedido = 'cancelado' THEN RAISE EXCEPTION 'Pedido cancelado'; END IF;
  IF p.status_pagamento = 'pago' THEN
    RETURN p; -- idempotente
  END IF;

  UPDATE public.pedidos
     SET status_pagamento = 'pago',
         forma_pagamento = _forma_pagamento,
         pago_em = now(),
         baixado_por = _uid,
         valor_recebido = COALESCE(_valor_recebido, total),
         observacoes = COALESCE(NULLIF(_observacoes,''), observacoes)
   WHERE id = _pedido_id
   RETURNING * INTO p;

  -- Baixa de estoque por composição (apenas se ainda não baixado)
  IF NOT p.estoque_baixado THEN
    FOR r IN
      SELECT pc.estoque_item_id, SUM(pc.quantidade_por_unidade * pi.quantidade) AS qtd
        FROM public.pedido_itens pi
        JOIN public.produto_composicao pc ON pc.produto_id = pi.produto_id
       WHERE pi.pedido_id = _pedido_id
       GROUP BY pc.estoque_item_id
    LOOP
      UPDATE public.estoque_itens SET quantidade_atual = quantidade_atual - r.qtd WHERE id = r.estoque_item_id;
      INSERT INTO public.estoque_movimentacoes(item_id, tipo, tipo_movimentacao, quantidade, motivo, pedido_id, usuario_id)
      VALUES (r.estoque_item_id, 'saida','venda', r.qtd, 'Baixa por pedido #' || p.numero, p.id, _uid);
    END LOOP;
    UPDATE public.pedidos SET estoque_baixado = true, estoque_baixado_em = now() WHERE id = _pedido_id RETURNING * INTO p;
  END IF;

  RETURN p;
END;
$$;

-- 7) Função: cancelar pedido (devolve estoque + estorna financeiro)
CREATE OR REPLACE FUNCTION public.cancelar_pedido(
  _pedido_id UUID,
  _motivo TEXT DEFAULT NULL
) RETURNS public.pedidos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p public.pedidos;
  r RECORD;
  _uid UUID := auth.uid();
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id = _pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_pedido = 'cancelado' THEN RETURN p; END IF;

  -- Devolve estoque se houve baixa
  IF p.estoque_baixado THEN
    FOR r IN
      SELECT pc.estoque_item_id, SUM(pc.quantidade_por_unidade * pi.quantidade) AS qtd
        FROM public.pedido_itens pi
        JOIN public.produto_composicao pc ON pc.produto_id = pi.produto_id
       WHERE pi.pedido_id = _pedido_id
       GROUP BY pc.estoque_item_id
    LOOP
      UPDATE public.estoque_itens SET quantidade_atual = quantidade_atual + r.qtd WHERE id = r.estoque_item_id;
      INSERT INTO public.estoque_movimentacoes(item_id, tipo, tipo_movimentacao, quantidade, motivo, pedido_id, usuario_id)
      VALUES (r.estoque_item_id, 'entrada','devolucao', r.qtd, 'Devolução por cancelamento do pedido #' || p.numero, p.id, _uid);
    END LOOP;
  END IF;

  UPDATE public.pedidos
     SET status_pedido = 'cancelado',
         status_pagamento = CASE WHEN status_pagamento='pago' THEN 'cancelado'::status_pagamento ELSE status_pagamento END,
         cancelado_em = now(),
         motivo_cancelamento = _motivo,
         estoque_baixado = false
   WHERE id = _pedido_id
   RETURNING * INTO p;

  RETURN p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_pedido(UUID, forma_pagamento, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(UUID, TEXT) TO authenticated;

-- 8) Despesas: cadastro manual entra direto via financeiro_lancamentos (tipo='saida').
-- Garantir índices úteis
CREATE INDEX IF NOT EXISTS idx_fin_data ON public.financeiro_lancamentos(data DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tipo_status ON public.financeiro_lancamentos(tipo, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_pag ON public.pedidos(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_pedidos_data ON public.pedidos(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_item ON public.estoque_movimentacoes(item_id, created_at DESC);

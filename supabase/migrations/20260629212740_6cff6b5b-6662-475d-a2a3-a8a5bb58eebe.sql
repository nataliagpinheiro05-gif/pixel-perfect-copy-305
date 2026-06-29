
-- ========== PRODUTOS ==========
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS envia_para_cozinha boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS produto_fechado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_sabor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_adicionais boolean NOT NULL DEFAULT false;

-- Backfill permite_sabor / permite_adicionais a partir das tabelas de vínculo existentes
UPDATE public.produtos p SET permite_sabor = true
  WHERE EXISTS (SELECT 1 FROM public.produto_sabores ps WHERE ps.produto_id = p.id);
UPDATE public.produtos p SET permite_adicionais = true
  WHERE EXISTS (SELECT 1 FROM public.produto_adicionais pa WHERE pa.produto_id = p.id);

-- ========== PEDIDOS / COMANDAS ==========
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS tipo_registro text NOT NULL DEFAULT 'comanda',
  ADD COLUMN IF NOT EXISTS status_comanda text NOT NULL DEFAULT 'aberta',
  ADD COLUMN IF NOT EXISTS aberta_em timestamptz,
  ADD COLUMN IF NOT EXISTS fechada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cliente_nome_rapido text,
  ADD COLUMN IF NOT EXISTS cliente_telefone_rapido text,
  ADD COLUMN IF NOT EXISTS troco numeric(10,2);

-- Backfill: linhas antigas
UPDATE public.pedidos SET aberta_em = COALESCE(aberta_em, data_hora);
UPDATE public.pedidos
   SET status_comanda = CASE
     WHEN status_pagamento = 'pago' THEN 'paga'
     WHEN status_pedido = 'cancelado' THEN 'cancelada'
     ELSE 'aberta'
   END
 WHERE status_comanda = 'aberta';
UPDATE public.pedidos SET fechada_em = pago_em WHERE fechada_em IS NULL AND pago_em IS NOT NULL;

-- ========== PEDIDO_ITENS ==========
ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS status_preparo text NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS envia_para_cozinha boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enviado_cozinha_em timestamptz,
  ADD COLUMN IF NOT EXISTS preparo_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pronto_em timestamptz,
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS observacoes_cozinha text,
  ADD COLUMN IF NOT EXISTS rodada int NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_pi_status_preparo ON public.pedido_itens(status_preparo);
CREATE INDEX IF NOT EXISTS idx_pedidos_status_comanda ON public.pedidos(status_comanda);

-- Remover trigger antigo de baixa de estoque ao inserir item — baixa só no pagamento
DROP TRIGGER IF EXISTS trg_pi_baixa_estoque ON public.pedido_itens;

-- ========== RPC: abrir_comanda ==========
CREATE OR REPLACE FUNCTION public.abrir_comanda(
  _cliente_id uuid DEFAULT NULL,
  _cliente_nome text DEFAULT NULL,
  _cliente_telefone text DEFAULT NULL,
  _observacoes text DEFAULT NULL
) RETURNS public.pedidos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.pedidos;
BEGIN
  INSERT INTO public.pedidos(
    cliente_id, usuario_id, tipo_registro, status_comanda, status_pedido,
    status_pagamento, aberta_em, data_hora,
    cliente_nome_rapido, cliente_telefone_rapido, observacoes
  ) VALUES (
    _cliente_id, auth.uid(), 'comanda', 'aberta', 'recebido',
    'pendente', now(), now(),
    NULLIF(_cliente_nome,''), NULLIF(_cliente_telefone,''), NULLIF(_observacoes,'')
  ) RETURNING * INTO p;
  RETURN p;
END;
$$;

-- ========== RPC: adicionar_item_comanda ==========
CREATE OR REPLACE FUNCTION public.adicionar_item_comanda(
  _pedido_id uuid,
  _produto_id uuid,
  _quantidade numeric DEFAULT 1,
  _sabor text DEFAULT NULL,
  _adicionais jsonb DEFAULT '[]'::jsonb,
  _observacoes text DEFAULT NULL
) RETURNS public.pedido_itens
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pr public.produtos;
  ped public.pedidos;
  it public.pedido_itens;
  _rodada int;
BEGIN
  SELECT * INTO ped FROM public.pedidos WHERE id = _pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF ped.status_comanda IN ('paga','cancelada') THEN
    RAISE EXCEPTION 'Comanda já fechada (%) — não é possível adicionar itens', ped.status_comanda;
  END IF;

  SELECT * INTO pr FROM public.produtos WHERE id = _produto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  SELECT COALESCE(MAX(rodada),0) + 1 INTO _rodada
    FROM public.pedido_itens WHERE pedido_id = _pedido_id;

  INSERT INTO public.pedido_itens(
    pedido_id, produto_id, nome_produto, quantidade, preco_unitario, custo_unitario,
    sabor, adicionais, observacoes,
    status_preparo, envia_para_cozinha, enviado_cozinha_em, rodada
  ) VALUES (
    _pedido_id, _produto_id, pr.nome, _quantidade, pr.preco, pr.custo,
    NULLIF(_sabor,''), COALESCE(_adicionais,'[]'::jsonb), NULLIF(_observacoes,''),
    'novo', pr.envia_para_cozinha,
    CASE WHEN pr.envia_para_cozinha THEN now() ELSE NULL END,
    _rodada
  ) RETURNING * INTO it;

  -- Marca comanda como "em_consumo" assim que recebe o primeiro item
  IF ped.status_comanda = 'aberta' THEN
    UPDATE public.pedidos SET status_comanda = 'em_consumo' WHERE id = _pedido_id;
  END IF;

  RETURN it;
END;
$$;

-- ========== RPC: cancelar_item_comanda ==========
CREATE OR REPLACE FUNCTION public.cancelar_item_comanda(
  _item_id uuid,
  _motivo text DEFAULT NULL
) RETURNS public.pedido_itens
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.pedido_itens; ped public.pedidos;
BEGIN
  SELECT * INTO it FROM public.pedido_itens WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  SELECT * INTO ped FROM public.pedidos WHERE id = it.pedido_id;
  IF ped.status_comanda IN ('paga','cancelada') THEN
    RAISE EXCEPTION 'Comanda já fechada — não é possível alterar itens';
  END IF;

  IF it.status_preparo = 'novo' THEN
    -- Pode remover sem fricção
    DELETE FROM public.pedido_itens WHERE id = _item_id;
    it.status_preparo := 'cancelado';
    RETURN it;
  ELSE
    IF _motivo IS NULL OR _motivo = '' THEN
      RAISE EXCEPTION 'Motivo obrigatório para cancelar item já em preparo';
    END IF;
    UPDATE public.pedido_itens
       SET status_preparo = 'cancelado',
           cancelado_em = now(),
           motivo_cancelamento = _motivo
     WHERE id = _item_id
     RETURNING * INTO it;
    -- Recalcula totais (sem o item cancelado)
    PERFORM public.recalc_pedido_totais(it.pedido_id);
    RETURN it;
  END IF;
END;
$$;

-- Ajusta recalc para ignorar itens cancelados
CREATE OR REPLACE FUNCTION public.recalc_pedido_totais(_pedido_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE _sub NUMERIC(10,2); _custo NUMERIC(10,2); _desc NUMERIC(10,2);
BEGIN
  SELECT COALESCE(SUM(subtotal),0), COALESCE(SUM(custo_unitario * quantidade),0)
    INTO _sub, _custo
    FROM public.pedido_itens
   WHERE pedido_id = _pedido_id AND status_preparo <> 'cancelado';
  SELECT COALESCE(desconto,0) INTO _desc FROM public.pedidos WHERE id = _pedido_id;
  UPDATE public.pedidos
     SET subtotal = _sub,
         total = GREATEST(_sub - COALESCE(_desc,0), 0),
         custo_total = _custo,
         lucro_estimado = GREATEST(_sub - COALESCE(_desc,0),0) - _custo,
         updated_at = now()
   WHERE id = _pedido_id;
END;
$$;

-- ========== RPC: fechar_comanda ==========
CREATE OR REPLACE FUNCTION public.fechar_comanda(
  _pedido_id uuid,
  _forma_pagamento forma_pagamento,
  _valor_recebido numeric DEFAULT NULL,
  _desconto numeric DEFAULT 0,
  _observacoes text DEFAULT NULL
) RETURNS public.pedidos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.pedidos;
  r RECORD;
  _uid uuid := auth.uid();
  _troco numeric;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id = _pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF p.status_comanda = 'paga' THEN RETURN p; END IF;
  IF p.status_comanda = 'cancelada' THEN RAISE EXCEPTION 'Comanda cancelada'; END IF;

  -- Aplica desconto e recalcula totais
  UPDATE public.pedidos SET desconto = COALESCE(_desconto,0) WHERE id = _pedido_id;
  PERFORM public.recalc_pedido_totais(_pedido_id);
  SELECT * INTO p FROM public.pedidos WHERE id = _pedido_id;

  _troco := CASE WHEN _valor_recebido IS NOT NULL AND _valor_recebido > p.total
                 THEN _valor_recebido - p.total ELSE 0 END;

  UPDATE public.pedidos
     SET status_pagamento = 'pago',
         status_comanda = 'paga',
         status_pedido = 'entregue',
         forma_pagamento = _forma_pagamento,
         pago_em = now(),
         fechada_em = now(),
         baixado_por = _uid,
         valor_recebido = COALESCE(_valor_recebido, total),
         troco = _troco,
         observacoes = COALESCE(NULLIF(_observacoes,''), observacoes)
   WHERE id = _pedido_id
   RETURNING * INTO p;

  -- Baixa de estoque por composição (apenas itens não cancelados)
  IF NOT p.estoque_baixado THEN
    FOR r IN
      SELECT pc.estoque_item_id, SUM(pc.quantidade_por_unidade * pi.quantidade) AS qtd
        FROM public.pedido_itens pi
        JOIN public.produto_composicao pc ON pc.produto_id = pi.produto_id
       WHERE pi.pedido_id = _pedido_id AND pi.status_preparo <> 'cancelado'
       GROUP BY pc.estoque_item_id
    LOOP
      UPDATE public.estoque_itens SET quantidade_atual = quantidade_atual - r.qtd WHERE id = r.estoque_item_id;
      INSERT INTO public.estoque_movimentacoes(item_id, tipo, tipo_movimentacao, quantidade, motivo, pedido_id, usuario_id)
      VALUES (r.estoque_item_id, 'saida','venda', r.qtd, 'Baixa por comanda #' || p.numero, p.id, _uid);
    END LOOP;
    UPDATE public.pedidos SET estoque_baixado = true, estoque_baixado_em = now() WHERE id = _pedido_id RETURNING * INTO p;
  END IF;

  RETURN p;
END;
$$;

-- ========== RPC: avancar_item_preparo ==========
CREATE OR REPLACE FUNCTION public.avancar_item_preparo(_item_id uuid, _novo_status text)
RETURNS public.pedido_itens
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.pedido_itens;
BEGIN
  IF _novo_status NOT IN ('em_preparo','pronto','entregue') THEN
    RAISE EXCEPTION 'Status inválido: %', _novo_status;
  END IF;
  UPDATE public.pedido_itens
     SET status_preparo = _novo_status,
         preparo_iniciado_em = CASE WHEN _novo_status = 'em_preparo' AND preparo_iniciado_em IS NULL THEN now() ELSE preparo_iniciado_em END,
         pronto_em = CASE WHEN _novo_status = 'pronto' AND pronto_em IS NULL THEN now() ELSE pronto_em END,
         entregue_em = CASE WHEN _novo_status = 'entregue' AND entregue_em IS NULL THEN now() ELSE entregue_em END
   WHERE id = _item_id
   RETURNING * INTO it;
  RETURN it;
END;
$$;

GRANT EXECUTE ON FUNCTION public.abrir_comanda(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adicionar_item_comanda(uuid,uuid,numeric,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_item_comanda(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_comanda(uuid,forma_pagamento,numeric,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.avancar_item_preparo(uuid,text) TO authenticated;

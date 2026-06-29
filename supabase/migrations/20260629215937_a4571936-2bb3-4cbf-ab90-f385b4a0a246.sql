
-- ============ COLUNAS ============
ALTER TABLE public.estoque_itens
  ADD COLUMN IF NOT EXISTS data_ultima_compra date,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS alerta_vencimento_dias integer NOT NULL DEFAULT 15;

ALTER TABLE public.estoque_movimentacoes
  ADD COLUMN IF NOT EXISTS pedido_item_id uuid,
  ADD COLUMN IF NOT EXISTS produto_id uuid,
  ADD COLUMN IF NOT EXISTS quantidade_anterior numeric(12,3),
  ADD COLUMN IF NOT EXISTS quantidade_posterior numeric(12,3);

ALTER TABLE public.produto_composicao
  ADD COLUMN IF NOT EXISTS unidade_medida text,
  ADD COLUMN IF NOT EXISTS obrigatorio boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS estoque_baixado boolean NOT NULL DEFAULT false;

ALTER TABLE public.configuracoes_loja
  ADD COLUMN IF NOT EXISTS permitir_estoque_negativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_alerta_vencimento integer NOT NULL DEFAULT 15;

-- ============ TABELA adicional_composicao ============
CREATE TABLE IF NOT EXISTS public.adicional_composicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adicional_id uuid REFERENCES public.adicionais(id) ON DELETE CASCADE,
  nome_adicional text,
  estoque_item_id uuid NOT NULL REFERENCES public.estoque_itens(id) ON DELETE RESTRICT,
  quantidade_utilizada numeric(12,3) NOT NULL DEFAULT 1,
  unidade_medida text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (adicional_id IS NOT NULL OR nome_adicional IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS adicional_composicao_adicional_idx ON public.adicional_composicao(adicional_id);
CREATE INDEX IF NOT EXISTS adicional_composicao_nome_idx ON public.adicional_composicao(lower(nome_adicional));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adicional_composicao TO authenticated;
GRANT ALL ON public.adicional_composicao TO service_role;
ALTER TABLE public.adicional_composicao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adicional_composicao_select" ON public.adicional_composicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "adicional_composicao_admin" ON public.adicional_composicao FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS adicional_composicao_set_updated ON public.adicional_composicao;
CREATE TRIGGER adicional_composicao_set_updated BEFORE UPDATE ON public.adicional_composicao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS produto_composicao_set_updated ON public.produto_composicao;
CREATE TRIGGER produto_composicao_set_updated BEFORE UPDATE ON public.produto_composicao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ Remove trigger de baixa antiga (baixa no insert do item) ============
DROP TRIGGER IF EXISTS pedido_item_baixa_estoque ON public.pedido_itens;

-- ============ FUNÇÃO: registrar_entrada_estoque ============
CREATE OR REPLACE FUNCTION public.registrar_entrada_estoque(
  _item_id uuid,
  _quantidade numeric,
  _custo_unitario numeric DEFAULT NULL,
  _validade date DEFAULT NULL,
  _fornecedor text DEFAULT NULL,
  _observacoes text DEFAULT NULL
) RETURNS public.estoque_itens
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE it public.estoque_itens; _ant numeric; _uid uuid := auth.uid();
BEGIN
  IF _quantidade IS NULL OR _quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  SELECT * INTO it FROM public.estoque_itens WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  _ant := it.quantidade_atual;
  UPDATE public.estoque_itens SET
    quantidade_atual = quantidade_atual + _quantidade,
    custo_unitario = COALESCE(_custo_unitario, custo_unitario),
    validade = COALESCE(_validade, validade),
    fornecedor = COALESCE(NULLIF(_fornecedor,''), fornecedor),
    data_ultima_compra = COALESCE(now()::date, data_ultima_compra),
    updated_at = now()
  WHERE id = _item_id RETURNING * INTO it;

  INSERT INTO public.estoque_movimentacoes(
    item_id, tipo, tipo_movimentacao, quantidade, quantidade_anterior, quantidade_posterior,
    custo_unitario, motivo, usuario_id
  ) VALUES (
    _item_id, 'entrada', 'compra', _quantidade, _ant, it.quantidade_atual,
    _custo_unitario, COALESCE(NULLIF(_observacoes,''),'Entrada de estoque'), _uid
  );
  RETURN it;
END $fn$;

-- ============ FUNÇÃO: registrar_saida_manual_estoque ============
CREATE OR REPLACE FUNCTION public.registrar_saida_manual_estoque(
  _item_id uuid,
  _quantidade numeric,
  _tipo_movimentacao text,
  _motivo text DEFAULT NULL
) RETURNS public.estoque_movimentacoes
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE it public.estoque_itens; m public.estoque_movimentacoes; _ant numeric; _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administrador pode registrar saída/perda/ajuste'; END IF;
  IF _quantidade IS NULL OR _quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF _tipo_movimentacao NOT IN ('saida_manual','ajuste','perda','vencimento','uso_interno') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', _tipo_movimentacao;
  END IF;
  SELECT * INTO it FROM public.estoque_itens WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  _ant := it.quantidade_atual;
  UPDATE public.estoque_itens SET quantidade_atual = quantidade_atual - _quantidade, updated_at = now()
    WHERE id = _item_id RETURNING * INTO it;
  INSERT INTO public.estoque_movimentacoes(
    item_id, tipo, tipo_movimentacao, quantidade, quantidade_anterior, quantidade_posterior, motivo, usuario_id
  ) VALUES (
    _item_id, 'saida', _tipo_movimentacao, _quantidade, _ant, it.quantidade_atual, _motivo, _uid
  ) RETURNING * INTO m;
  RETURN m;
END $fn$;

-- ============ FUNÇÃO: baixar_estoque_comanda ============
CREATE OR REPLACE FUNCTION public.baixar_estoque_comanda(
  _pedido_id uuid,
  _forcar boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  p public.pedidos;
  cfg public.configuracoes_loja;
  _uid uuid := auth.uid();
  _consumo jsonb := '{}'::jsonb;
  _insuf jsonb := '[]'::jsonb;
  r record;
  add_el jsonb;
  qtd numeric;
  _ant numeric;
  _posterior numeric;
  _key text;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF p.estoque_baixado THEN RETURN jsonb_build_object('ok',true,'ja_baixado',true); END IF;
  IF p.status_pagamento <> 'pago' THEN
    RAISE EXCEPTION 'Comanda não está paga — não pode baixar estoque';
  END IF;

  -- Composição de produtos (itens não cancelados, produto com controla_estoque)
  FOR r IN
    SELECT pc.estoque_item_id AS item_id,
           SUM(pc.quantidade_utilizada * pi.quantidade)::numeric AS qtd,
           pi.id AS pedido_item_id,
           pi.produto_id AS produto_id
      FROM public.pedido_itens pi
      JOIN public.produtos pr ON pr.id = pi.produto_id
      JOIN public.produto_composicao pc ON pc.produto_id = pi.produto_id
     WHERE pi.pedido_id = _pedido_id
       AND pi.status_preparo <> 'cancelado'
       AND COALESCE(pr.controla_estoque,true) = true
       AND COALESCE(pc.ativo,true) = true
     GROUP BY pc.estoque_item_id, pi.id, pi.produto_id
  LOOP
    _key := r.item_id::text;
    _consumo := jsonb_set(_consumo, ARRAY[_key],
      to_jsonb( COALESCE((_consumo->>_key)::numeric,0) + r.qtd ));
  END LOOP;

  -- Composição de adicionais (jsonb adicionais por item)
  FOR r IN
    SELECT pi.id AS pedido_item_id, pi.quantidade AS qtd_item, pi.adicionais AS adds
      FROM public.pedido_itens pi
     WHERE pi.pedido_id = _pedido_id
       AND pi.status_preparo <> 'cancelado'
       AND jsonb_array_length(COALESCE(pi.adicionais,'[]'::jsonb)) > 0
  LOOP
    FOR add_el IN SELECT value FROM jsonb_array_elements(r.adds)
    LOOP
      FOR _ant, _posterior, qtd, _key IN
        SELECT NULL::numeric, NULL::numeric,
               (ac.quantidade_utilizada * r.qtd_item)::numeric,
               ac.estoque_item_id::text
          FROM public.adicional_composicao ac
         WHERE ac.ativo = true
           AND (
             (add_el ? 'id' AND ac.adicional_id = (add_el->>'id')::uuid)
             OR (add_el ? 'nome' AND lower(ac.nome_adicional) = lower(add_el->>'nome'))
           )
      LOOP
        _consumo := jsonb_set(_consumo, ARRAY[_key],
          to_jsonb( COALESCE((_consumo->>_key)::numeric,0) + qtd ));
      END LOOP;
    END LOOP;
  END LOOP;

  -- Verifica estoque insuficiente
  SELECT * INTO cfg FROM public.configuracoes_loja LIMIT 1;
  FOR _key, qtd IN SELECT k, (v)::numeric FROM jsonb_each_text(_consumo) AS j(k,v)
  LOOP
    SELECT quantidade_atual INTO _ant FROM public.estoque_itens WHERE id = _key::uuid;
    IF _ant IS NULL THEN CONTINUE; END IF;
    IF _ant < qtd THEN
      _insuf := _insuf || jsonb_build_object('item_id',_key,'disponivel',_ant,'necessario',qtd);
    END IF;
  END LOOP;

  IF jsonb_array_length(_insuf) > 0 AND NOT _forcar
     AND NOT COALESCE(cfg.permitir_estoque_negativo,false) THEN
    RETURN jsonb_build_object('ok',false,'insuficientes',_insuf);
  END IF;

  -- Aplica baixa
  FOR _key, qtd IN SELECT k, (v)::numeric FROM jsonb_each_text(_consumo) AS j(k,v)
  LOOP
    SELECT quantidade_atual INTO _ant FROM public.estoque_itens WHERE id = _key::uuid FOR UPDATE;
    IF _ant IS NULL THEN CONTINUE; END IF;
    _posterior := _ant - qtd;
    UPDATE public.estoque_itens SET quantidade_atual = _posterior, updated_at = now()
      WHERE id = _key::uuid;
    INSERT INTO public.estoque_movimentacoes(
      item_id, tipo, tipo_movimentacao, quantidade, quantidade_anterior, quantidade_posterior,
      motivo, pedido_id, usuario_id
    ) VALUES (
      _key::uuid, 'saida','venda', qtd, _ant, _posterior,
      'Baixa por comanda #' || p.numero, p.id, _uid
    );
  END LOOP;

  UPDATE public.pedidos
     SET estoque_baixado = true, estoque_baixado_em = now(), baixado_por = COALESCE(baixado_por,_uid)
   WHERE id = _pedido_id;
  UPDATE public.pedido_itens SET estoque_baixado = true
   WHERE pedido_id = _pedido_id AND status_preparo <> 'cancelado';

  RETURN jsonb_build_object('ok',true,'insuficientes',_insuf);
END $fn$;

-- ============ FUNÇÃO: devolver_estoque_comanda ============
CREATE OR REPLACE FUNCTION public.devolver_estoque_comanda(
  _pedido_id uuid, _motivo text DEFAULT 'Estorno/Cancelamento'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE p public.pedidos; r record; _ant numeric; _post numeric; _uid uuid := auth.uid(); _qtd numeric;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF NOT p.estoque_baixado THEN RETURN jsonb_build_object('ok',true,'nada_a_devolver',true); END IF;

  FOR r IN
    SELECT item_id, SUM(quantidade) AS qtd
      FROM public.estoque_movimentacoes
     WHERE pedido_id = _pedido_id AND tipo='saida' AND tipo_movimentacao='venda'
     GROUP BY item_id
  LOOP
    _qtd := r.qtd;
    SELECT quantidade_atual INTO _ant FROM public.estoque_itens WHERE id=r.item_id FOR UPDATE;
    IF _ant IS NULL THEN CONTINUE; END IF;
    _post := _ant + _qtd;
    UPDATE public.estoque_itens SET quantidade_atual=_post, updated_at=now() WHERE id=r.item_id;
    INSERT INTO public.estoque_movimentacoes(
      item_id, tipo, tipo_movimentacao, quantidade, quantidade_anterior, quantidade_posterior,
      motivo, pedido_id, usuario_id
    ) VALUES (
      r.item_id,'entrada','devolucao', _qtd, _ant, _post,
      _motivo || ' #' || p.numero, p.id, _uid
    );
  END LOOP;

  UPDATE public.pedidos SET estoque_baixado=false WHERE id=_pedido_id;
  UPDATE public.pedido_itens SET estoque_baixado=false WHERE pedido_id=_pedido_id;
  RETURN jsonb_build_object('ok',true);
END $fn$;

-- ============ Atualiza fechar_comanda para usar baixar_estoque_comanda ============
CREATE OR REPLACE FUNCTION public.fechar_comanda(
  _pedido_id uuid, _forma_pagamento forma_pagamento,
  _valor_recebido numeric DEFAULT NULL, _desconto numeric DEFAULT 0,
  _observacoes text DEFAULT NULL
) RETURNS pedidos
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE p public.pedidos; _uid uuid := auth.uid(); _troco numeric;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id = _pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF p.status_comanda = 'paga' THEN RETURN p; END IF;
  IF p.status_comanda = 'cancelada' THEN RAISE EXCEPTION 'Comanda cancelada'; END IF;

  UPDATE public.pedidos SET desconto = COALESCE(_desconto,0) WHERE id = _pedido_id;
  PERFORM public.recalc_pedido_totais(_pedido_id);
  SELECT * INTO p FROM public.pedidos WHERE id = _pedido_id;

  _troco := CASE WHEN _valor_recebido IS NOT NULL AND _valor_recebido > p.total
                 THEN _valor_recebido - p.total ELSE 0 END;

  UPDATE public.pedidos
     SET status_pagamento='pago', status_comanda='paga', status_pedido='entregue',
         forma_pagamento=_forma_pagamento, pago_em=now(), fechada_em=now(), baixado_por=_uid,
         valor_recebido=COALESCE(_valor_recebido, total), troco=_troco,
         observacoes=COALESCE(NULLIF(_observacoes,''), observacoes)
   WHERE id=_pedido_id RETURNING * INTO p;

  PERFORM public.baixar_estoque_comanda(_pedido_id, false);
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id;
  RETURN p;
END $fn$;

-- ============ Atualiza registrar_pagamento_comanda para usar baixar_estoque_comanda ============
CREATE OR REPLACE FUNCTION public.registrar_pagamento_comanda(_pedido_id uuid, _pagamentos jsonb)
 RETURNS pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE
  p public.pedidos; pg jsonb;
  _forma forma_pagamento; _valor numeric; _recebido numeric; _troco numeric; _obs text;
  _total_novo numeric := 0; _ja_pago numeric; _restante numeric;
  _uid uuid := auth.uid(); _caixa uuid; _lanc uuid; _novo_pp uuid;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF p.status_comanda='cancelada' OR p.status_pedido='cancelado' THEN RAISE EXCEPTION 'Comanda cancelada'; END IF;
  IF p.status_pagamento='pago' THEN RETURN p; END IF;

  PERFORM public.recalc_pedido_totais(_pedido_id);
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id;
  SELECT COALESCE(SUM(valor),0) INTO _ja_pago FROM public.pedido_pagamentos WHERE pedido_id=_pedido_id AND status='confirmado';
  _restante := p.total - _ja_pago;
  IF _restante <= 0 THEN
    UPDATE public.pedidos SET status_pagamento='pago', valor_pago=_ja_pago, valor_pendente=0,
      status_comanda='paga', pago_em=COALESCE(pago_em,now()), fechada_em=COALESCE(fechada_em,now())
     WHERE id=_pedido_id RETURNING * INTO p;
    PERFORM public.baixar_estoque_comanda(_pedido_id, false);
    SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id;
    RETURN p;
  END IF;

  SELECT id INTO _caixa FROM public.caixas WHERE status='aberto' LIMIT 1;

  FOR pg IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    _forma := (pg->>'forma')::forma_pagamento;
    _valor := COALESCE((pg->>'valor')::numeric, 0);
    _recebido := COALESCE(NULLIF(pg->>'valor_recebido','')::numeric, _valor);
    _obs := NULLIF(pg->>'observacoes','');
    IF _valor <= 0 THEN CONTINUE; END IF;
    IF _valor > (_restante - _total_novo) AND _forma <> 'dinheiro' THEN
      _valor := _restante - _total_novo;
      IF _valor <= 0 THEN CONTINUE; END IF;
    END IF;
    _troco := CASE WHEN _forma='dinheiro' AND _recebido > _valor THEN _recebido - _valor ELSE 0 END;

    INSERT INTO public.pedido_pagamentos(pedido_id, forma_pagamento, valor, valor_recebido, troco,
      observacoes, usuario_id, caixa_id, status)
    VALUES (_pedido_id, _forma, _valor, _recebido, _troco, _obs, _uid, _caixa, 'confirmado')
    RETURNING id INTO _novo_pp;

    INSERT INTO public.financeiro_lancamentos(
      tipo, categoria, descricao, valor, forma_pagamento, data, data_lancamento,
      pedido_id, usuario_id, status, referencia_tipo, referencia_id, caixa_id
    ) VALUES ('entrada','Venda FitLounge','Pedido #' || p.numero || COALESCE(' • '||_obs,''),
      _valor, _forma, now()::date, now(), _pedido_id, _uid, 'ativo','pedido_pagamento', _novo_pp, _caixa)
    RETURNING id INTO _lanc;

    UPDATE public.pedido_pagamentos SET financeiro_lancamento_id=_lanc WHERE id=_novo_pp;
    PERFORM public._caixa_acumula(_caixa, _forma, _valor);
    INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, forma_pagamento,
      financeiro_lancamento_id, pedido_id, pedido_pagamento_id, usuario_id)
    VALUES (_caixa, 'entrada', _valor, 'Pagamento pedido #'||p.numero, _forma,
      _lanc, _pedido_id, _novo_pp, _uid);
    _total_novo := _total_novo + _valor;
  END LOOP;

  SELECT COALESCE(SUM(valor),0) INTO _ja_pago FROM public.pedido_pagamentos
    WHERE pedido_id=_pedido_id AND status='confirmado';
  _restante := GREATEST(p.total - _ja_pago, 0);

  IF _restante <= 0.005 THEN
    UPDATE public.pedidos
       SET status_pagamento='pago', status_comanda='paga', status_pedido='entregue',
           forma_pagamento=(SELECT forma_pagamento FROM public.pedido_pagamentos
                            WHERE pedido_id=_pedido_id ORDER BY valor DESC LIMIT 1),
           valor_pago=_ja_pago, valor_pendente=0, valor_recebido=_ja_pago,
           pago_em=now(), fechada_em=now(), caixa_id=COALESCE(caixa_id,_caixa), baixado_por=_uid
     WHERE id=_pedido_id RETURNING * INTO p;
    PERFORM public.baixar_estoque_comanda(_pedido_id, false);
    SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id;
  ELSE
    UPDATE public.pedidos
       SET status_pagamento='parcial', status_comanda='aguardando_pagamento',
           valor_pago=_ja_pago, valor_pendente=_restante, caixa_id=COALESCE(caixa_id,_caixa)
     WHERE id=_pedido_id RETURNING * INTO p;
  END IF;
  RETURN p;
END $fn$;

-- ============ Atualiza cancelar_pedido para usar devolver_estoque_comanda ============
CREATE OR REPLACE FUNCTION public.cancelar_pedido(_pedido_id uuid, _motivo text DEFAULT NULL)
 RETURNS pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE p public.pedidos;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_pedido='cancelado' THEN RETURN p; END IF;

  IF p.estoque_baixado THEN
    PERFORM public.devolver_estoque_comanda(_pedido_id, 'Cancelamento');
  END IF;

  UPDATE public.pedidos
     SET status_pedido='cancelado',
         status_pagamento = CASE WHEN status_pagamento='pago' THEN 'cancelado'::status_pagamento ELSE status_pagamento END,
         status_comanda='cancelada',
         cancelado_em=now(), motivo_cancelamento=_motivo
   WHERE id=_pedido_id RETURNING * INTO p;
  RETURN p;
END $fn$;

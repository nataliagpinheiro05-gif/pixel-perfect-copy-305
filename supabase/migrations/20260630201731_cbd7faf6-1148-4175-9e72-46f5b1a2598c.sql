
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS estoque_item_id uuid REFERENCES public.estoque_itens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estoque_quantidade_por_unidade numeric NOT NULL DEFAULT 1;

-- Auto-vínculo por nome exato (case-insensitive)
UPDATE public.produtos p
   SET estoque_item_id = ei.id, estoque_quantidade_por_unidade = 1, controla_estoque = true
  FROM public.estoque_itens ei
 WHERE p.estoque_item_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.produto_composicao pc WHERE pc.produto_id = p.id)
   AND lower(trim(ei.nome)) = lower(trim(p.nome));

-- Casos por prefixo
UPDATE public.produtos p SET estoque_item_id = ei.id, estoque_quantidade_por_unidade=1, controla_estoque=true
  FROM public.estoque_itens ei
 WHERE p.estoque_item_id IS NULL
   AND ((p.nome ILIKE 'Muffin%' AND ei.nome ILIKE 'Muffin')
     OR (p.nome ILIKE 'Waffle%' AND ei.nome ILIKE 'Waffle')
     OR (p.nome ILIKE 'Pão de Queijo%' AND ei.nome ILIKE 'Pão de queijo')
     OR (p.nome ILIKE 'Bolo de Pote%' AND ei.nome ILIKE 'Bolo de pote')
     OR (p.nome ILIKE 'Empadinha%' AND ei.nome ILIKE 'Empadinha')
     OR (p.nome ILIKE 'Brigadeiro%' AND ei.nome ILIKE 'Brigadeiro%')
     OR (p.nome ILIKE 'Pão de Mel%' AND ei.nome ILIKE 'Pão de mel'));

CREATE OR REPLACE FUNCTION public.baixar_estoque_comanda(_pedido_id uuid, _forcar boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  p public.pedidos;
  cfg public.configuracoes_loja;
  _uid uuid := auth.uid();
  _consumo jsonb := '{}'::jsonb;
  _insuf jsonb := '[]'::jsonb;
  r record; add_el jsonb;
  qtd numeric; _ant numeric; _posterior numeric; _key text;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF p.estoque_baixado THEN RETURN jsonb_build_object('ok',true,'ja_baixado',true); END IF;
  IF p.status_pagamento <> 'pago' THEN RAISE EXCEPTION 'Comanda não está paga — não pode baixar estoque'; END IF;

  -- (a) Composição
  FOR r IN
    SELECT pc.estoque_item_id AS item_id, SUM(pc.quantidade_por_unidade * pi.quantidade)::numeric AS qtd
      FROM public.pedido_itens pi
      JOIN public.produtos pr ON pr.id = pi.produto_id
      JOIN public.produto_composicao pc ON pc.produto_id = pi.produto_id
     WHERE pi.pedido_id = _pedido_id AND pi.status_preparo <> 'cancelado'
       AND COALESCE(pr.controla_estoque,true)=true AND COALESCE(pc.ativo,true)=true
     GROUP BY pc.estoque_item_id
  LOOP
    _key := r.item_id::text;
    _consumo := jsonb_set(_consumo, ARRAY[_key], to_jsonb(COALESCE((_consumo->>_key)::numeric,0) + r.qtd));
  END LOOP;

  -- (b) Vínculo direto (quando sem composição)
  FOR r IN
    SELECT pr.estoque_item_id AS item_id,
           SUM(COALESCE(pr.estoque_quantidade_por_unidade,1) * pi.quantidade)::numeric AS qtd
      FROM public.pedido_itens pi
      JOIN public.produtos pr ON pr.id = pi.produto_id
     WHERE pi.pedido_id = _pedido_id AND pi.status_preparo <> 'cancelado'
       AND COALESCE(pr.controla_estoque,true)=true AND pr.estoque_item_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.produto_composicao pc
                        WHERE pc.produto_id = pr.id AND COALESCE(pc.ativo,true)=true)
     GROUP BY pr.estoque_item_id
  LOOP
    _key := r.item_id::text;
    _consumo := jsonb_set(_consumo, ARRAY[_key], to_jsonb(COALESCE((_consumo->>_key)::numeric,0) + r.qtd));
  END LOOP;

  -- (c) Adicionais
  FOR r IN
    SELECT pi.quantidade AS qtd_item, pi.adicionais AS adds
      FROM public.pedido_itens pi
     WHERE pi.pedido_id = _pedido_id AND pi.status_preparo <> 'cancelado'
       AND jsonb_array_length(COALESCE(pi.adicionais,'[]'::jsonb)) > 0
  LOOP
    FOR add_el IN SELECT value FROM jsonb_array_elements(r.adds) LOOP
      FOR qtd, _key IN
        SELECT (ac.quantidade_utilizada * r.qtd_item)::numeric, ac.estoque_item_id::text
          FROM public.adicional_composicao ac
         WHERE ac.ativo=true AND (
           (add_el ? 'id' AND ac.adicional_id = (add_el->>'id')::uuid)
           OR (add_el ? 'nome' AND lower(ac.nome_adicional) = lower(add_el->>'nome'))
         )
      LOOP
        _consumo := jsonb_set(_consumo, ARRAY[_key], to_jsonb(COALESCE((_consumo->>_key)::numeric,0) + qtd));
      END LOOP;
    END LOOP;
  END LOOP;

  SELECT * INTO cfg FROM public.configuracoes_loja LIMIT 1;
  FOR _key, qtd IN SELECT k,(v)::numeric FROM jsonb_each_text(_consumo) AS j(k,v) LOOP
    SELECT quantidade_atual INTO _ant FROM public.estoque_itens WHERE id=_key::uuid;
    IF _ant IS NULL THEN CONTINUE; END IF;
    IF _ant < qtd THEN
      _insuf := _insuf || jsonb_build_object('item_id',_key,'disponivel',_ant,'necessario',qtd);
    END IF;
  END LOOP;

  IF jsonb_array_length(_insuf) > 0 AND NOT _forcar
     AND NOT COALESCE(cfg.permitir_estoque_negativo,false) THEN
    RETURN jsonb_build_object('ok',false,'insuficientes',_insuf);
  END IF;

  FOR _key, qtd IN SELECT k,(v)::numeric FROM jsonb_each_text(_consumo) AS j(k,v) LOOP
    SELECT quantidade_atual INTO _ant FROM public.estoque_itens WHERE id=_key::uuid FOR UPDATE;
    IF _ant IS NULL THEN CONTINUE; END IF;
    _posterior := _ant - qtd;
    UPDATE public.estoque_itens SET quantidade_atual=_posterior, updated_at=now() WHERE id=_key::uuid;
    INSERT INTO public.estoque_movimentacoes(
      item_id, tipo, tipo_movimentacao, quantidade, quantidade_anterior, quantidade_posterior,
      motivo, pedido_id, usuario_id
    ) VALUES (
      _key::uuid,'saida','venda', qtd, _ant, _posterior,
      'Baixa por venda — comanda #' || p.numero, p.id, _uid
    );
  END LOOP;

  UPDATE public.pedidos SET estoque_baixado=true, estoque_baixado_em=now(),
         baixado_por=COALESCE(baixado_por,_uid) WHERE id=_pedido_id;
  UPDATE public.pedido_itens SET estoque_baixado=true
   WHERE pedido_id=_pedido_id AND status_preparo <> 'cancelado';

  RETURN jsonb_build_object('ok',true,'insuficientes',_insuf);
END $function$;

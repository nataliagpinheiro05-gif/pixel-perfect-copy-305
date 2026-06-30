CREATE OR REPLACE FUNCTION public.adicionar_item_comanda(
  _pedido_id uuid,
  _produto_id uuid,
  _quantidade numeric DEFAULT 1,
  _sabor text DEFAULT NULL,
  _adicionais jsonb DEFAULT '[]'::jsonb,
  _observacoes text DEFAULT NULL,
  _envia_para_cozinha boolean DEFAULT NULL
)
RETURNS pedido_itens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pr public.produtos;
  ped public.pedidos;
  it public.pedido_itens;
  _rodada int;
  _envia boolean;
BEGIN
  SELECT * INTO ped FROM public.pedidos WHERE id = _pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF ped.status_comanda IN ('paga','cancelada') THEN
    RAISE EXCEPTION 'Comanda já fechada (%) — não é possível adicionar itens', ped.status_comanda;
  END IF;

  SELECT * INTO pr FROM public.produtos WHERE id = _produto_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  _envia := COALESCE(_envia_para_cozinha, pr.envia_para_cozinha);

  SELECT COALESCE(MAX(rodada),0) + 1 INTO _rodada
    FROM public.pedido_itens WHERE pedido_id = _pedido_id;

  INSERT INTO public.pedido_itens(
    pedido_id, produto_id, nome_produto, quantidade, preco_unitario, custo_unitario,
    sabor, adicionais, observacoes,
    status_preparo, envia_para_cozinha, enviado_cozinha_em, rodada
  ) VALUES (
    _pedido_id, _produto_id, pr.nome, _quantidade, pr.preco, pr.custo,
    NULLIF(_sabor,''), COALESCE(_adicionais,'[]'::jsonb), NULLIF(_observacoes,''),
    'novo', _envia,
    CASE WHEN _envia THEN now() ELSE NULL END,
    _rodada
  ) RETURNING * INTO it;

  IF ped.status_comanda = 'aberta' THEN
    UPDATE public.pedidos SET status_comanda = 'em_consumo' WHERE id = _pedido_id;
  END IF;

  RETURN it;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome text,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  descricao text,
  motivo text,
  metadata jsonb
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin lê auditoria" ON public.audit_log;
DROP POLICY IF EXISTS "Sistema insere auditoria" ON public.audit_log;
CREATE POLICY "Admin lê auditoria" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Sistema insere auditoria" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entidade ON public.audit_log(entidade, entidade_id);

CREATE OR REPLACE FUNCTION public.log_audit(
  _acao text, _entidade text, _entidade_id uuid,
  _descricao text DEFAULT NULL, _motivo text DEFAULT NULL, _metadata jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nome text;
BEGIN
  SELECT nome INTO _nome FROM public.users_profiles WHERE user_id = auth.uid() LIMIT 1;
  INSERT INTO public.audit_log(usuario_id, usuario_nome, acao, entidade, entidade_id, descricao, motivo, metadata)
  VALUES (auth.uid(), _nome, _acao, _entidade, _entidade_id, _descricao, _motivo, _metadata);
END $$;

CREATE OR REPLACE FUNCTION public.reabrir_comanda(_pedido_id uuid, _motivo text)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.pedidos;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administrador pode reabrir comanda'; END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) = 0 THEN RAISE EXCEPTION 'Motivo é obrigatório'; END IF;
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF p.status_comanda <> 'paga' THEN
    RAISE EXCEPTION 'Só é possível reabrir uma comanda paga (status atual: %)', p.status_comanda;
  END IF;
  IF p.estoque_baixado THEN
    PERFORM public.devolver_estoque_comanda(_pedido_id, 'Reabertura: ' || _motivo);
  END IF;
  UPDATE public.financeiro_lancamentos
     SET status='estornado',
         observacoes = COALESCE(observacoes,'') || E'\n[Estornado por reabertura] ' || _motivo
   WHERE pedido_id = _pedido_id AND status='ativo';
  UPDATE public.pedido_pagamentos SET status='cancelado'
   WHERE pedido_id = _pedido_id AND status='confirmado';
  UPDATE public.pedidos
     SET status_comanda='em_consumo', status_pagamento='pendente', status_pedido='recebido',
         pago_em=NULL, fechada_em=NULL, valor_pago=0, valor_pendente=total,
         valor_recebido=NULL, troco=0,
         reaberta_em=now(), reaberta_por=auth.uid(), motivo_reabertura=_motivo
   WHERE id=_pedido_id RETURNING * INTO p;
  PERFORM public.log_audit('reabrir_comanda','pedido',p.id,'Comanda #'||p.numero||' reaberta',_motivo,NULL);
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido(_pedido_id uuid, _motivo text DEFAULT NULL)
RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.pedidos;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF p.status_pedido='cancelado' THEN RETURN p; END IF;
  IF _motivo IS NULL OR length(trim(_motivo))=0 THEN RAISE EXCEPTION 'Motivo é obrigatório'; END IF;
  IF p.estoque_baixado THEN
    PERFORM public.devolver_estoque_comanda(_pedido_id, 'Cancelamento');
  END IF;
  UPDATE public.pedidos
     SET status_pedido='cancelado',
         status_pagamento = CASE WHEN status_pagamento='pago' THEN 'cancelado'::status_pagamento ELSE status_pagamento END,
         status_comanda='cancelada', cancelado_em=now(), motivo_cancelamento=_motivo
   WHERE id=_pedido_id RETURNING * INTO p;
  PERFORM public.log_audit('cancelar_pedido','pedido',p.id,'Pedido #'||p.numero,_motivo,NULL);
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.cancelar_lancamento_financeiro(_id uuid, _motivo text)
RETURNS public.financeiro_lancamentos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.financeiro_lancamentos;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administrador pode cancelar lançamento'; END IF;
  IF _motivo IS NULL OR length(trim(_motivo))=0 THEN RAISE EXCEPTION 'Motivo é obrigatório'; END IF;
  UPDATE public.financeiro_lancamentos
     SET status='cancelado',
         observacoes = COALESCE(observacoes,'') || E'\n[Cancelado] ' || _motivo
   WHERE id=_id AND status='ativo' RETURNING * INTO l;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado ou já cancelado'; END IF;
  PERFORM public.log_audit('cancelar_lancamento','financeiro',l.id,l.descricao,_motivo,
    jsonb_build_object('valor',l.valor,'tipo',l.tipo));
  RETURN l;
END $$;

CREATE OR REPLACE FUNCTION public.estornar_lancamento(_lancamento_id uuid, _motivo text)
RETURNS public.financeiro_lancamentos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.financeiro_lancamentos; novo public.financeiro_lancamentos;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administrador pode estornar'; END IF;
  IF _motivo IS NULL OR _motivo='' THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  SELECT * INTO l FROM public.financeiro_lancamentos WHERE id=_lancamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado'; END IF;
  IF l.status='estornado' THEN RETURN l; END IF;
  UPDATE public.financeiro_lancamentos SET status='estornado' WHERE id=_lancamento_id;
  INSERT INTO public.financeiro_lancamentos(
    tipo, categoria, descricao, valor, forma_pagamento, data, data_lancamento,
    pedido_id, usuario_id, status, referencia_tipo, referencia_id, estorno_de, caixa_id, observacoes
  ) VALUES (
    CASE WHEN l.tipo='entrada' THEN 'saida'::tipo_financeiro ELSE 'entrada'::tipo_financeiro END,
    'Estorno', 'Estorno: ' || l.descricao, l.valor, l.forma_pagamento, now()::date, now(),
    l.pedido_id, auth.uid(), 'ativo', 'estorno', l.id, l.id, l.caixa_id, _motivo
  ) RETURNING * INTO novo;
  PERFORM public.log_audit('estornar_lancamento','financeiro',l.id,'Estorno: '||l.descricao,_motivo,
    jsonb_build_object('valor',l.valor,'estorno_id',novo.id));
  RETURN novo;
END $$;

DROP FUNCTION IF EXISTS public.registrar_saida_manual_estoque(uuid, numeric, text, text);
CREATE FUNCTION public.registrar_saida_manual_estoque(
  _item_id uuid, _quantidade numeric, _tipo_movimentacao text, _motivo text
) RETURNS public.estoque_movimentacoes
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.estoque_itens; m public.estoque_movimentacoes; _ant numeric; _uid uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administrador pode registrar saída/perda/ajuste'; END IF;
  IF _quantidade IS NULL OR _quantidade <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF _motivo IS NULL OR length(trim(_motivo)) = 0 THEN RAISE EXCEPTION 'Motivo é obrigatório'; END IF;
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
  PERFORM public.log_audit('estoque_saida_manual','estoque_item',_item_id,
    it.nome||' '||_tipo_movimentacao||' '||_quantidade::text,_motivo,
    jsonb_build_object('anterior',_ant,'posterior',it.quantidade_atual));
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_sangria(_valor numeric, _motivo text)
RETURNS public.caixa_movimentacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.caixas; m public.caixa_movimentacoes;
BEGIN
  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF _motivo IS NULL OR length(trim(_motivo))=0 THEN RAISE EXCEPTION 'Motivo é obrigatório'; END IF;
  SELECT * INTO c FROM public.caixas WHERE status='aberto' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum caixa aberto'; END IF;
  INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, usuario_id, forma_pagamento)
  VALUES (c.id, 'sangria', _valor, _motivo, auth.uid(), 'dinheiro') RETURNING * INTO m;
  UPDATE public.caixas SET total_sangrias = total_sangrias + _valor WHERE id = c.id;
  PERFORM public.log_audit('sangria','caixa',c.id,'Sangria R$ '||_valor::text,_motivo,
    jsonb_build_object('valor',_valor));
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_reforco(_valor numeric, _motivo text)
RETURNS public.caixa_movimentacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.caixas; m public.caixa_movimentacoes;
BEGIN
  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF _motivo IS NULL OR length(trim(_motivo))=0 THEN RAISE EXCEPTION 'Motivo é obrigatório'; END IF;
  SELECT * INTO c FROM public.caixas WHERE status='aberto' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum caixa aberto'; END IF;
  INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, usuario_id, forma_pagamento)
  VALUES (c.id, 'reforco', _valor, _motivo, auth.uid(), 'dinheiro') RETURNING * INTO m;
  UPDATE public.caixas SET total_reforcos = total_reforcos + _valor WHERE id = c.id;
  PERFORM public.log_audit('reforco','caixa',c.id,'Reforço R$ '||_valor::text,_motivo,
    jsonb_build_object('valor',_valor));
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.abrir_caixa(_valor_inicial numeric DEFAULT 0, _observacoes text DEFAULT NULL)
RETURNS public.caixas LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.caixas; _uid uuid := auth.uid();
BEGIN
  IF EXISTS (SELECT 1 FROM public.caixas WHERE status='aberto') THEN
    RAISE EXCEPTION 'Já existe um caixa aberto';
  END IF;
  INSERT INTO public.caixas(valor_inicial, usuario_abertura_id, observacoes_abertura)
  VALUES (COALESCE(_valor_inicial,0), _uid, NULLIF(_observacoes,'')) RETURNING * INTO c;
  INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, usuario_id)
  VALUES (c.id, 'abertura', c.valor_inicial, 'Abertura de caixa', _uid);
  PERFORM public.log_audit('abrir_caixa','caixa',c.id,'Abertura R$ '||c.valor_inicial::text,NULL,NULL);
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.fechar_caixa(_valor_dinheiro numeric, _observacoes text DEFAULT NULL)
RETURNS public.caixas LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.caixas; _esp numeric; _dif numeric; _st text; _uid uuid := auth.uid();
BEGIN
  SELECT * INTO c FROM public.caixas WHERE status='aberto' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum caixa aberto'; END IF;
  IF NOT (public.is_admin() OR public.pode_financeiro()) THEN
    RAISE EXCEPTION 'Sem permissão para fechar caixa';
  END IF;
  _esp := c.valor_inicial + c.total_dinheiro + c.total_reforcos - c.total_sangrias - c.total_saidas;
  _dif := COALESCE(_valor_dinheiro,0) - _esp;
  _st  := CASE WHEN abs(_dif) < 0.005 THEN 'fechado' ELSE 'divergente' END;
  UPDATE public.caixas
     SET status = _st, fechado_em = now(),
         valor_dinheiro_informado = COALESCE(_valor_dinheiro,0),
         valor_dinheiro_esperado = _esp, diferenca = _dif, saldo_final = _esp,
         usuario_fechamento_id = _uid, observacoes_fechamento = NULLIF(_observacoes,'')
   WHERE id = c.id RETURNING * INTO c;
  INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, usuario_id)
  VALUES (c.id, 'fechamento', COALESCE(_valor_dinheiro,0),
          'Fechamento (esperado '||_esp::text||', diferença '||_dif::text||')', _uid);
  PERFORM public.log_audit('fechar_caixa','caixa',c.id,
    'Fechamento '||_st,_observacoes,
    jsonb_build_object('esperado',_esp,'informado',_valor_dinheiro,'diferenca',_dif));
  RETURN c;
END $$;

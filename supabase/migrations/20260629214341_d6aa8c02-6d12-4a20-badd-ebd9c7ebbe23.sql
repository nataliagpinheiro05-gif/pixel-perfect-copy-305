
-- 1) Corrige trigger financeiro: tratar INSERT (OLD null) sem cast vazio em enum
CREATE OR REPLACE FUNCTION public.tg_pedido_financeiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Pagamento confirmado: cria lançamento se ainda não houver
  IF NEW.status_pagamento = 'pago'
     AND (TG_OP = 'INSERT' OR OLD.status_pagamento IS DISTINCT FROM 'pago') THEN
    IF NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos
                   WHERE pedido_id = NEW.id AND status='ativo') THEN
      INSERT INTO public.financeiro_lancamentos(
        tipo, categoria, descricao, valor, forma_pagamento, data,
        pedido_id, usuario_id, status, referencia_tipo, referencia_id
      ) VALUES (
        'entrada','Venda FitLounge','Pedido #' || NEW.numero,
        NEW.total, NEW.forma_pagamento,
        COALESCE(NEW.pago_em, now())::date,
        NEW.id, COALESCE(NEW.baixado_por, NEW.usuario_id),
        'ativo','pedido', NEW.id
      );
    END IF;
  -- Cancelamento: estorna lançamentos ativos
  ELSIF TG_OP = 'UPDATE'
        AND (NEW.status_pedido = 'cancelado' OR NEW.status_pagamento = 'cancelado')
        AND (OLD.status_pedido IS DISTINCT FROM 'cancelado'
             AND OLD.status_pagamento IS DISTINCT FROM 'cancelado') THEN
    UPDATE public.financeiro_lancamentos SET status='estornado'
     WHERE pedido_id = NEW.id AND status='ativo';
  END IF;
  RETURN NEW;
END $$;

-- 2) Novo valor de enum
ALTER TYPE public.status_pagamento ADD VALUE IF NOT EXISTS 'parcial';

-- 3) Colunas extras em pedidos / financeiro
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS valor_pago numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pendente numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS caixa_id uuid;

ALTER TABLE public.financeiro_lancamentos
  ADD COLUMN IF NOT EXISTS caixa_id uuid,
  ADD COLUMN IF NOT EXISTS data_lancamento timestamptz NOT NULL DEFAULT now();

-- 4) Tabela pedido_pagamentos
CREATE TABLE IF NOT EXISTS public.pedido_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  forma_pagamento forma_pagamento NOT NULL,
  valor numeric(10,2) NOT NULL CHECK (valor > 0),
  valor_recebido numeric(10,2),
  troco numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmado', -- confirmado | estornado
  observacoes text,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  caixa_id uuid,
  financeiro_lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pp_pedido ON public.pedido_pagamentos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pp_caixa ON public.pedido_pagamentos(caixa_id);
GRANT SELECT, INSERT, UPDATE ON public.pedido_pagamentos TO authenticated;
GRANT ALL ON public.pedido_pagamentos TO service_role;
ALTER TABLE public.pedido_pagamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pp_select" ON public.pedido_pagamentos;
DROP POLICY IF EXISTS "pp_admin" ON public.pedido_pagamentos;
DROP POLICY IF EXISTS "pp_insert" ON public.pedido_pagamentos;
CREATE POLICY "pp_select" ON public.pedido_pagamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "pp_insert" ON public.pedido_pagamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pp_admin"  ON public.pedido_pagamentos FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE TRIGGER trg_pp_updated_at BEFORE UPDATE ON public.pedido_pagamentos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5) Tabela caixas
CREATE TABLE IF NOT EXISTS public.caixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'aberto', -- aberto | fechado | divergente
  aberto_em timestamptz NOT NULL DEFAULT now(),
  fechado_em timestamptz,
  valor_inicial numeric(10,2) NOT NULL DEFAULT 0,
  valor_dinheiro_informado numeric(10,2),
  valor_dinheiro_esperado numeric(10,2),
  diferenca numeric(10,2),
  total_pix numeric(10,2) NOT NULL DEFAULT 0,
  total_dinheiro numeric(10,2) NOT NULL DEFAULT 0,
  total_debito numeric(10,2) NOT NULL DEFAULT 0,
  total_credito numeric(10,2) NOT NULL DEFAULT 0,
  total_entradas numeric(10,2) NOT NULL DEFAULT 0,
  total_saidas numeric(10,2) NOT NULL DEFAULT 0,
  total_sangrias numeric(10,2) NOT NULL DEFAULT 0,
  total_reforcos numeric(10,2) NOT NULL DEFAULT 0,
  saldo_final numeric(10,2),
  usuario_abertura_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_fechamento_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes_abertura text,
  observacoes_fechamento text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_caixa_aberto ON public.caixas(status) WHERE status='aberto';
GRANT SELECT, INSERT, UPDATE ON public.caixas TO authenticated;
GRANT ALL ON public.caixas TO service_role;
ALTER TABLE public.caixas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "caixa_select" ON public.caixas;
DROP POLICY IF EXISTS "caixa_admin" ON public.caixas;
CREATE POLICY "caixa_select" ON public.caixas FOR SELECT TO authenticated USING (true);
CREATE POLICY "caixa_admin" ON public.caixas FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE TRIGGER trg_caixas_updated_at BEFORE UPDATE ON public.caixas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 6) Tabela caixa_movimentacoes
CREATE TABLE IF NOT EXISTS public.caixa_movimentacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id uuid NOT NULL REFERENCES public.caixas(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- abertura | fechamento | sangria | reforco | entrada | saida
  valor numeric(10,2) NOT NULL DEFAULT 0,
  descricao text,
  forma_pagamento forma_pagamento,
  financeiro_lancamento_id uuid REFERENCES public.financeiro_lancamentos(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  pedido_pagamento_id uuid REFERENCES public.pedido_pagamentos(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cm_caixa ON public.caixa_movimentacoes(caixa_id);
GRANT SELECT, INSERT ON public.caixa_movimentacoes TO authenticated;
GRANT ALL ON public.caixa_movimentacoes TO service_role;
ALTER TABLE public.caixa_movimentacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm_select" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS "cm_insert" ON public.caixa_movimentacoes;
DROP POLICY IF EXISTS "cm_admin" ON public.caixa_movimentacoes;
CREATE POLICY "cm_select" ON public.caixa_movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "cm_insert" ON public.caixa_movimentacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cm_admin"  ON public.caixa_movimentacoes FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- FK pedidos.caixa_id (criada fora do CREATE TABLE por causa do IF NOT EXISTS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedidos_caixa_id_fkey') THEN
    ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_caixa_id_fkey
      FOREIGN KEY (caixa_id) REFERENCES public.caixas(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedido_pagamentos_caixa_id_fkey') THEN
    ALTER TABLE public.pedido_pagamentos ADD CONSTRAINT pedido_pagamentos_caixa_id_fkey
      FOREIGN KEY (caixa_id) REFERENCES public.caixas(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='financeiro_caixa_id_fkey') THEN
    ALTER TABLE public.financeiro_lancamentos ADD CONSTRAINT financeiro_caixa_id_fkey
      FOREIGN KEY (caixa_id) REFERENCES public.caixas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7) RPC abrir_caixa
CREATE OR REPLACE FUNCTION public.abrir_caixa(_valor_inicial numeric DEFAULT 0, _observacoes text DEFAULT NULL)
RETURNS public.caixas LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.caixas; _uid uuid := auth.uid();
BEGIN
  IF EXISTS (SELECT 1 FROM public.caixas WHERE status='aberto') THEN
    RAISE EXCEPTION 'Já existe um caixa aberto';
  END IF;
  INSERT INTO public.caixas(valor_inicial, usuario_abertura_id, observacoes_abertura)
  VALUES (COALESCE(_valor_inicial,0), _uid, NULLIF(_observacoes,''))
  RETURNING * INTO c;
  INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, usuario_id)
  VALUES (c.id, 'abertura', c.valor_inicial, 'Abertura de caixa', _uid);
  RETURN c;
END $$;

-- 8) RPC registrar_sangria / reforco
CREATE OR REPLACE FUNCTION public.registrar_sangria(_valor numeric, _motivo text)
RETURNS public.caixa_movimentacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.caixas; m public.caixa_movimentacoes;
BEGIN
  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  SELECT * INTO c FROM public.caixas WHERE status='aberto' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum caixa aberto'; END IF;
  INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, usuario_id, forma_pagamento)
  VALUES (c.id, 'sangria', _valor, COALESCE(NULLIF(_motivo,''),'Sangria'), auth.uid(), 'dinheiro')
  RETURNING * INTO m;
  UPDATE public.caixas SET total_sangrias = total_sangrias + _valor WHERE id = c.id;
  RETURN m;
END $$;

CREATE OR REPLACE FUNCTION public.registrar_reforco(_valor numeric, _motivo text)
RETURNS public.caixa_movimentacoes LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.caixas; m public.caixa_movimentacoes;
BEGIN
  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  SELECT * INTO c FROM public.caixas WHERE status='aberto' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhum caixa aberto'; END IF;
  INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, usuario_id, forma_pagamento)
  VALUES (c.id, 'reforco', _valor, COALESCE(NULLIF(_motivo,''),'Reforço'), auth.uid(), 'dinheiro')
  RETURNING * INTO m;
  UPDATE public.caixas SET total_reforcos = total_reforcos + _valor WHERE id = c.id;
  RETURN m;
END $$;

-- 9) RPC fechar_caixa
CREATE OR REPLACE FUNCTION public.fechar_caixa(_valor_dinheiro numeric, _observacoes text DEFAULT NULL)
RETURNS public.caixas LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
     SET status = _st,
         fechado_em = now(),
         valor_dinheiro_informado = COALESCE(_valor_dinheiro,0),
         valor_dinheiro_esperado = _esp,
         diferenca = _dif,
         saldo_final = _esp,
         usuario_fechamento_id = _uid,
         observacoes_fechamento = NULLIF(_observacoes,'')
   WHERE id = c.id
   RETURNING * INTO c;

  INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, usuario_id)
  VALUES (c.id, 'fechamento', COALESCE(_valor_dinheiro,0),
          'Fechamento de caixa (esperado ' || _esp::text || ', diferença ' || _dif::text || ')', _uid);
  RETURN c;
END $$;

-- 10) Helper: atualiza totais do caixa para uma forma de pagamento
CREATE OR REPLACE FUNCTION public._caixa_acumula(_caixa_id uuid, _forma forma_pagamento, _valor numeric)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF _caixa_id IS NULL THEN RETURN; END IF;
  UPDATE public.caixas SET
    total_pix      = total_pix      + CASE WHEN _forma='pix'      THEN _valor ELSE 0 END,
    total_dinheiro = total_dinheiro + CASE WHEN _forma='dinheiro' THEN _valor ELSE 0 END,
    total_debito   = total_debito   + CASE WHEN _forma='debito'   THEN _valor ELSE 0 END,
    total_credito  = total_credito  + CASE WHEN _forma='credito'  THEN _valor ELSE 0 END,
    total_entradas = total_entradas + _valor
  WHERE id = _caixa_id;
END $$;

-- 11) RPC registrar_pagamento_comanda — único, misto e parcial
CREATE OR REPLACE FUNCTION public.registrar_pagamento_comanda(
  _pedido_id uuid,
  _pagamentos jsonb  -- [{ "forma":"pix","valor":30,"valor_recebido":30,"observacoes":"" }, ...]
) RETURNS public.pedidos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  p public.pedidos;
  pg jsonb;
  _forma forma_pagamento;
  _valor numeric;
  _recebido numeric;
  _troco numeric;
  _obs text;
  _total_novo numeric := 0;
  _ja_pago numeric;
  _restante numeric;
  _uid uuid := auth.uid();
  _caixa uuid;
  _lanc uuid;
  _novo_pp uuid;
  _r record;
BEGIN
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF p.status_comanda='cancelada' OR p.status_pedido='cancelado' THEN
    RAISE EXCEPTION 'Comanda cancelada';
  END IF;
  IF p.status_pagamento='pago' THEN RETURN p; END IF;

  -- Garante totais atualizados
  PERFORM public.recalc_pedido_totais(_pedido_id);
  SELECT * INTO p FROM public.pedidos WHERE id=_pedido_id;

  SELECT COALESCE(SUM(valor),0) INTO _ja_pago
    FROM public.pedido_pagamentos WHERE pedido_id=_pedido_id AND status='confirmado';
  _restante := p.total - _ja_pago;
  IF _restante <= 0 THEN
    UPDATE public.pedidos SET status_pagamento='pago', valor_pago=_ja_pago, valor_pendente=0,
      status_comanda='paga', pago_em = COALESCE(pago_em, now()), fechada_em = COALESCE(fechada_em, now())
     WHERE id=_pedido_id RETURNING * INTO p;
    RETURN p;
  END IF;

  SELECT id INTO _caixa FROM public.caixas WHERE status='aberto' LIMIT 1;

  -- Itera pagamentos
  FOR pg IN SELECT * FROM jsonb_array_elements(_pagamentos)
  LOOP
    _forma   := (pg->>'forma')::forma_pagamento;
    _valor   := COALESCE((pg->>'valor')::numeric, 0);
    _recebido:= COALESCE(NULLIF(pg->>'valor_recebido','')::numeric, _valor);
    _obs     := NULLIF(pg->>'observacoes','');
    IF _valor <= 0 THEN CONTINUE; END IF;
    -- Limita o último pagamento ao restante (evita exceder em formas não-dinheiro)
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
    ) VALUES (
      'entrada','Venda FitLounge','Pedido #' || p.numero || COALESCE(' • '||_obs,''),
      _valor, _forma, now()::date, now(),
      _pedido_id, _uid, 'ativo', 'pedido_pagamento', _novo_pp, _caixa
    ) RETURNING id INTO _lanc;

    UPDATE public.pedido_pagamentos SET financeiro_lancamento_id=_lanc WHERE id=_novo_pp;

    PERFORM public._caixa_acumula(_caixa, _forma, _valor);
    INSERT INTO public.caixa_movimentacoes(caixa_id, tipo, valor, descricao, forma_pagamento,
                                           financeiro_lancamento_id, pedido_id, pedido_pagamento_id, usuario_id)
    VALUES (_caixa, 'entrada', _valor, 'Pagamento pedido #'||p.numero, _forma,
            _lanc, _pedido_id, _novo_pp, _uid);

    _total_novo := _total_novo + _valor;
  END LOOP;

  -- Atualiza pedido
  SELECT COALESCE(SUM(valor),0) INTO _ja_pago
    FROM public.pedido_pagamentos WHERE pedido_id=_pedido_id AND status='confirmado';
  _restante := GREATEST(p.total - _ja_pago, 0);

  IF _restante <= 0.005 THEN
    UPDATE public.pedidos
       SET status_pagamento='pago',
           status_comanda='paga',
           status_pedido='entregue',
           forma_pagamento = (SELECT forma_pagamento FROM public.pedido_pagamentos
                              WHERE pedido_id=_pedido_id ORDER BY valor DESC LIMIT 1),
           valor_pago=_ja_pago,
           valor_pendente=0,
           valor_recebido=_ja_pago,
           pago_em=now(),
           fechada_em=now(),
           caixa_id = COALESCE(caixa_id, _caixa),
           baixado_por = _uid
     WHERE id=_pedido_id RETURNING * INTO p;

    -- Baixa de estoque (se ainda não baixado)
    IF NOT p.estoque_baixado THEN
      FOR _r IN
        SELECT pc.estoque_item_id, SUM(pc.quantidade_por_unidade * pi.quantidade) AS qtd
          FROM public.pedido_itens pi
          JOIN public.produto_composicao pc ON pc.produto_id = pi.produto_id
         WHERE pi.pedido_id = _pedido_id AND pi.status_preparo <> 'cancelado'
         GROUP BY pc.estoque_item_id
      LOOP
        UPDATE public.estoque_itens SET quantidade_atual = quantidade_atual - _r.qtd WHERE id = _r.estoque_item_id;
        INSERT INTO public.estoque_movimentacoes(item_id, tipo, tipo_movimentacao, quantidade, motivo, pedido_id, usuario_id)
        VALUES (_r.estoque_item_id, 'saida','venda', _r.qtd, 'Baixa por pedido #'||p.numero, p.id, _uid);
      END LOOP;
      UPDATE public.pedidos SET estoque_baixado=true, estoque_baixado_em=now()
        WHERE id=_pedido_id RETURNING * INTO p;
    END IF;
  ELSE
    UPDATE public.pedidos
       SET status_pagamento='parcial',
           status_comanda='aguardando_pagamento',
           valor_pago=_ja_pago,
           valor_pendente=_restante,
           caixa_id = COALESCE(caixa_id, _caixa)
     WHERE id=_pedido_id RETURNING * INTO p;
  END IF;

  RETURN p;
END $$;

-- 12) RPC estornar_lancamento (apenas admin)
CREATE OR REPLACE FUNCTION public.estornar_lancamento(_lancamento_id uuid, _motivo text)
RETURNS public.financeiro_lancamentos LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
  RETURN novo;
END $$;

-- 13) Permissões nas funções
GRANT EXECUTE ON FUNCTION public.abrir_caixa(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_caixa(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_sangria(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_reforco(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_comanda(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_lancamento(uuid,text) TO authenticated;

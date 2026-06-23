export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adicionais: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          preco: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          preco?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          preco?: number
        }
        Relationships: []
      }
      categorias_produtos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          observacoes: string | null
          por_quem_veio: string | null
          quem_indicou: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          por_quem_veio?: string | null
          quem_indicou?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          por_quem_veio?: string | null
          quem_indicou?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_loja: {
        Row: {
          cnpj: string | null
          endereco: string | null
          estoque_minimo_padrao: number
          id: string
          logo_url: string | null
          nome_loja: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          endereco?: string | null
          estoque_minimo_padrao?: number
          id?: string
          logo_url?: string | null
          nome_loja?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          endereco?: string | null
          estoque_minimo_padrao?: number
          id?: string
          logo_url?: string | null
          nome_loja?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estoque_itens: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          custo_unitario: number
          estoque_minimo: number
          fornecedor: string | null
          id: string
          nome: string
          quantidade_atual: number
          unidade_medida: string
          updated_at: string
          validade: string | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_unitario?: number
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          nome: string
          quantidade_atual?: number
          unidade_medida?: string
          updated_at?: string
          validade?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_unitario?: number
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          nome?: string
          quantidade_atual?: number
          unidade_medida?: string
          updated_at?: string
          validade?: string | null
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          custo_unitario: number | null
          id: string
          item_id: string
          motivo: string | null
          pedido_id: string | null
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_mov_estoque"]
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          item_id: string
          motivo?: string | null
          pedido_id?: string | null
          quantidade: number
          tipo: Database["public"]["Enums"]["tipo_mov_estoque"]
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          item_id?: string
          motivo?: string | null
          pedido_id?: string | null
          quantidade?: number
          tipo?: Database["public"]["Enums"]["tipo_mov_estoque"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "vw_estoque_alertas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_lancamentos: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          meu_slim_venda_id: string | null
          observacoes: string | null
          pedido_id: string | null
          tipo: Database["public"]["Enums"]["tipo_financeiro"]
          usuario_id: string | null
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data?: string
          descricao: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          meu_slim_venda_id?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_financeiro"]
          usuario_id?: string | null
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          meu_slim_venda_id?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_financeiro"]
          usuario_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_lancamentos_meu_slim_venda_id_fkey"
            columns: ["meu_slim_venda_id"]
            isOneToOne: false
            referencedRelation: "meu_slim_vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      meu_slim_vendas: {
        Row: {
          cliente_id: string | null
          created_at: string
          custo: number
          data_prevista_entrega: string | null
          data_venda: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lucro: number | null
          nome_cliente: string
          observacoes: string | null
          status_entrega: Database["public"]["Enums"]["status_entrega_kit"]
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          telefone: string | null
          tipo_kit: string
          updated_at: string
          usuario_id: string | null
          valor: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          custo?: number
          data_prevista_entrega?: string | null
          data_venda?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lucro?: number | null
          nome_cliente: string
          observacoes?: string | null
          status_entrega?: Database["public"]["Enums"]["status_entrega_kit"]
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          telefone?: string | null
          tipo_kit: string
          updated_at?: string
          usuario_id?: string | null
          valor?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          custo?: number
          data_prevista_entrega?: string | null
          data_venda?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lucro?: number | null
          nome_cliente?: string
          observacoes?: string | null
          status_entrega?: Database["public"]["Enums"]["status_entrega_kit"]
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          telefone?: string | null
          tipo_kit?: string
          updated_at?: string
          usuario_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "meu_slim_vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meu_slim_vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_clientes_inativos_30dias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meu_slim_vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_clientes_top"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          adicionais: Json
          created_at: string
          custo_unitario: number
          id: string
          nome_produto: string
          observacoes: string | null
          pedido_id: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          sabor: string | null
          subtotal: number
        }
        Insert: {
          adicionais?: Json
          created_at?: string
          custo_unitario?: number
          id?: string
          nome_produto: string
          observacoes?: string | null
          pedido_id: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          sabor?: string | null
          subtotal?: number
        }
        Update: {
          adicionais?: Json
          created_at?: string
          custo_unitario?: number
          id?: string
          nome_produto?: string
          observacoes?: string | null
          pedido_id?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          sabor?: string | null
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string | null
          created_at: string
          custo_total: number
          data_hora: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lucro_estimado: number
          numero: number
          observacoes: string | null
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          status_pedido: Database["public"]["Enums"]["status_pedido"]
          subtotal: number
          total: number
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          custo_total?: number
          data_hora?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lucro_estimado?: number
          numero?: number
          observacoes?: string | null
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          status_pedido?: Database["public"]["Enums"]["status_pedido"]
          subtotal?: number
          total?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          custo_total?: number
          data_hora?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lucro_estimado?: number
          numero?: number
          observacoes?: string | null
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          status_pedido?: Database["public"]["Enums"]["status_pedido"]
          subtotal?: number
          total?: number
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_clientes_inativos_30dias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_clientes_top"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_adicionais: {
        Row: {
          adicional_id: string
          produto_id: string
        }
        Insert: {
          adicional_id: string
          produto_id: string
        }
        Update: {
          adicional_id?: string
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_adicionais_adicional_id_fkey"
            columns: ["adicional_id"]
            isOneToOne: false
            referencedRelation: "adicionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_adicionais_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_composicao: {
        Row: {
          estoque_item_id: string
          id: string
          produto_id: string
          quantidade_por_unidade: number
        }
        Insert: {
          estoque_item_id: string
          id?: string
          produto_id: string
          quantidade_por_unidade?: number
        }
        Update: {
          estoque_item_id?: string
          id?: string
          produto_id?: string
          quantidade_por_unidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_composicao_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_composicao_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "vw_estoque_alertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_composicao_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_sabores: {
        Row: {
          produto_id: string
          sabor_id: string
        }
        Insert: {
          produto_id: string
          sabor_id: string
        }
        Update: {
          produto_id?: string
          sabor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_sabores_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_sabores_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          aparece_no_pedido: boolean
          ativo: boolean
          categoria_id: string | null
          controla_estoque: boolean
          created_at: string
          custo: number
          descricao: string | null
          estoque_minimo: number
          id: string
          lucro: number | null
          nome: string
          preco: number
          updated_at: string
        }
        Insert: {
          aparece_no_pedido?: boolean
          ativo?: boolean
          categoria_id?: string | null
          controla_estoque?: boolean
          created_at?: string
          custo?: number
          descricao?: string | null
          estoque_minimo?: number
          id?: string
          lucro?: number | null
          nome: string
          preco?: number
          updated_at?: string
        }
        Update: {
          aparece_no_pedido?: boolean
          ativo?: boolean
          categoria_id?: string | null
          controla_estoque?: boolean
          created_at?: string
          custo?: number
          descricao?: string | null
          estoque_minimo?: number
          id?: string
          lucro?: number | null
          nome?: string
          preco?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      sabores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      users_profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          nome: string
          pode_ver_financeiro: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          pode_ver_financeiro?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          pode_ver_financeiro?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_clientes_inativos_30dias: {
        Row: {
          id: string | null
          nome: string | null
          telefone: string | null
          ultima_compra: string | null
        }
        Relationships: []
      }
      vw_clientes_top: {
        Row: {
          id: string | null
          nome: string | null
          qtd_pedidos: number | null
          telefone: string | null
          total_gasto: number | null
          ultima_compra: string | null
        }
        Relationships: []
      }
      vw_estoque_alertas: {
        Row: {
          alerta: string | null
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          custo_unitario: number | null
          estoque_minimo: number | null
          fornecedor: string | null
          id: string | null
          nome: string | null
          quantidade_atual: number | null
          unidade_medida: string | null
          updated_at: string | null
          validade: string | null
        }
        Insert: {
          alerta?: never
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          custo_unitario?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string | null
          nome?: string | null
          quantidade_atual?: number | null
          unidade_medida?: string | null
          updated_at?: string | null
          validade?: string | null
        }
        Update: {
          alerta?: never
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          custo_unitario?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string | null
          nome?: string | null
          quantidade_atual?: number | null
          unidade_medida?: string | null
          updated_at?: string | null
          validade?: string | null
        }
        Relationships: []
      }
      vw_produtos_mais_vendidos: {
        Row: {
          nome_produto: string | null
          produto_id: string | null
          qtd_vendida: number | null
          total_vendido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      pode_financeiro: { Args: never; Returns: boolean }
      recalc_pedido_totais: { Args: { _pedido_id: string }; Returns: undefined }
      upsert_cliente: {
        Args: {
          _data_nascimento?: string
          _nome: string
          _observacoes?: string
          _por_quem_veio?: string
          _quem_indicou?: string
          _telefone: string
        }
        Returns: {
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          observacoes: string | null
          por_quem_veio: string | null
          quem_indicou: string | null
          telefone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clientes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "funcionario"
      forma_pagamento: "pix" | "dinheiro" | "debito" | "credito"
      status_entrega_kit: "pendente" | "em_producao" | "entregue" | "cancelado"
      status_pagamento: "pago" | "pendente" | "cancelado"
      status_pedido: "em_preparo" | "pronto" | "entregue" | "cancelado"
      tipo_financeiro: "entrada" | "saida"
      tipo_mov_estoque:
        | "entrada"
        | "saida"
        | "ajuste"
        | "perda"
        | "vencimento"
        | "uso_interno"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "funcionario"],
      forma_pagamento: ["pix", "dinheiro", "debito", "credito"],
      status_entrega_kit: ["pendente", "em_producao", "entregue", "cancelado"],
      status_pagamento: ["pago", "pendente", "cancelado"],
      status_pedido: ["em_preparo", "pronto", "entregue", "cancelado"],
      tipo_financeiro: ["entrada", "saida"],
      tipo_mov_estoque: [
        "entrada",
        "saida",
        "ajuste",
        "perda",
        "vencimento",
        "uso_interno",
      ],
    },
  },
} as const

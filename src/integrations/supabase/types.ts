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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cash_book: {
        Row: {
          amount: number
          branch_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_business_accounting: boolean | null
          note: string | null
          payment_source: string
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
          type: Database["public"]["Enums"]["cash_book_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_business_accounting?: boolean | null
          note?: string | null
          payment_source: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          type: Database["public"]["Enums"]["cash_book_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_business_accounting?: boolean | null
          note?: string | null
          payment_source?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["cash_book_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_book_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_book_categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          type: Database["public"]["Enums"]["cash_book_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          type: Database["public"]["Enums"]["cash_book_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          type?: Database["public"]["Enums"]["cash_book_type"]
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          note: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          note?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          note?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      export_receipt_items: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          imei: string | null
          note: string | null
          product_id: string | null
          product_name: string
          receipt_id: string
          sale_price: number
          sku: string
          status: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          note?: string | null
          product_id?: string | null
          product_name: string
          receipt_id: string
          sale_price: number
          sku: string
          status?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          note?: string | null
          product_id?: string | null
          product_name?: string
          receipt_id?: string
          sale_price?: number
          sku?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_receipt_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "export_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      export_receipt_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_type: string
          receipt_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_type: string
          receipt_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_type?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_receipt_payments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "export_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      export_receipts: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          debt_amount: number
          export_date: string
          id: string
          note: string | null
          paid_amount: number
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          debt_amount?: number
          export_date?: string
          id?: string
          note?: string | null
          paid_amount?: number
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          debt_amount?: number
          export_date?: string
          id?: string
          note?: string | null
          paid_amount?: number
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      imei_histories: {
        Row: {
          action_type: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          imei: string
          note: string | null
          price: number | null
          product_id: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          imei: string
          note?: string | null
          price?: number | null
          product_id: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          imei?: string
          note?: string | null
          price?: number | null
          product_id?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imei_histories_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imei_histories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      import_receipts: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          debt_amount: number
          id: string
          import_date: string
          note: string | null
          paid_amount: number
          status: Database["public"]["Enums"]["receipt_status"]
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          debt_amount?: number
          id?: string
          import_date?: string
          note?: string | null
          paid_amount?: number
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          debt_amount?: number
          id?: string
          import_date?: string
          note?: string | null
          paid_amount?: number
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          created_at: string
          field_order: Json | null
          font_size: string | null
          id: string
          is_default: boolean | null
          name: string
          paper_size: string
          show_customer_info: boolean | null
          show_debt: boolean | null
          show_imei: boolean | null
          show_logo: boolean | null
          show_note: boolean | null
          show_paid_amount: boolean | null
          show_product_name: boolean | null
          show_receipt_code: boolean | null
          show_sale_date: boolean | null
          show_sale_price: boolean | null
          show_sku: boolean | null
          show_store_address: boolean | null
          show_store_name: boolean | null
          show_store_phone: boolean | null
          show_thank_you: boolean | null
          show_total: boolean | null
          store_address: string | null
          store_name: string | null
          store_phone: string | null
          text_align: string | null
          thank_you_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_order?: Json | null
          font_size?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          paper_size?: string
          show_customer_info?: boolean | null
          show_debt?: boolean | null
          show_imei?: boolean | null
          show_logo?: boolean | null
          show_note?: boolean | null
          show_paid_amount?: boolean | null
          show_product_name?: boolean | null
          show_receipt_code?: boolean | null
          show_sale_date?: boolean | null
          show_sale_price?: boolean | null
          show_sku?: boolean | null
          show_store_address?: boolean | null
          show_store_name?: boolean | null
          show_store_phone?: boolean | null
          show_thank_you?: boolean | null
          show_total?: boolean | null
          store_address?: string | null
          store_name?: string | null
          store_phone?: string | null
          text_align?: string | null
          thank_you_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_order?: Json | null
          font_size?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          paper_size?: string
          show_customer_info?: boolean | null
          show_debt?: boolean | null
          show_imei?: boolean | null
          show_logo?: boolean | null
          show_note?: boolean | null
          show_paid_amount?: boolean | null
          show_product_name?: boolean | null
          show_receipt_code?: boolean | null
          show_sale_date?: boolean | null
          show_sale_price?: boolean | null
          show_sku?: boolean | null
          show_store_address?: boolean | null
          show_store_name?: boolean | null
          show_store_phone?: boolean | null
          show_thank_you?: boolean | null
          show_total?: boolean | null
          store_address?: string | null
          store_name?: string | null
          store_phone?: string | null
          text_align?: string | null
          thank_you_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          branch_id: string | null
          category_id: string | null
          created_at: string
          id: string
          imei: string | null
          import_date: string
          import_price: number
          import_receipt_id: string | null
          name: string
          note: string | null
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          import_date?: string
          import_price: number
          import_receipt_id?: string | null
          name: string
          note?: string | null
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          import_date?: string
          import_price?: number
          import_receipt_id?: string | null
          name?: string
          note?: string | null
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_import_receipt_id_fkey"
            columns: ["import_receipt_id"]
            isOneToOne: false
            referencedRelation: "import_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          receipt_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          receipt_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_payments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "import_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
      cash_book_type: "expense" | "income"
      payment_type: "cash" | "bank_card" | "e_wallet" | "debt"
      product_status: "in_stock" | "sold" | "returned"
      receipt_status: "completed" | "cancelled"
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
      app_role: ["admin", "staff"],
      cash_book_type: ["expense", "income"],
      payment_type: ["cash", "bank_card", "e_wallet", "debt"],
      product_status: ["in_stock", "sold", "returned"],
      receipt_status: ["completed", "cancelled"],
    },
  },
} as const

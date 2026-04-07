export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          id: string
          lead_id: string | null
          scheduled_at: string | null
          source: Database["public"]["Enums"]["entry_source"]
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          scheduled_at?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          scheduled_at?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_fkey"
            columns: ["company_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "activities_lead_fkey"
            columns: ["company_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "activities_user_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          changes: Json
          company_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json
          company_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json
          company_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      authorized_emails: {
        Row: {
          added_by: string | null
          company_id: string
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["authorized_email_role"]
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          company_id: string
          created_at?: string
          email: string
          id?: string
          role: Database["public"]["Enums"]["authorized_email_role"]
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["authorized_email_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorized_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorized_emails_company_user_fkey"
            columns: ["company_id", "added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      channel_credentials: {
        Row: {
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at: string
          credentials: Json
          id: string
          last_sync_at: string | null
          status: Database["public"]["Enums"]["channel_connection_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["channel_type"]
          company_id: string
          created_at?: string
          credentials?: Json
          id?: string
          last_sync_at?: string | null
          status?: Database["public"]["Enums"]["channel_connection_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_type"]
          company_id?: string
          created_at?: string
          credentials?: Json
          id?: string
          last_sync_at?: string | null
          status?: Database["public"]["Enums"]["channel_connection_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_credentials_company_user_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: Database["public"]["Enums"]["company_plan"]
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
          vendor_limit: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: Database["public"]["Enums"]["company_plan"]
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          vendor_limit?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: Database["public"]["Enums"]["company_plan"]
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          vendor_limit?: number
        }
        Relationships: []
      }
      contacts: {
        Row: {
          assigned_to: string | null
          company_id: string
          company_name: string | null
          created_at: string
          created_by: string
          custom_fields: Json
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          position: string | null
          source: Database["public"]["Enums"]["crm_source"]
          tags: string[]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          position?: string | null
          source?: Database["public"]["Enums"]["crm_source"]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          position?: string | null
          source?: Database["public"]["Enums"]["crm_source"]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_to_fkey"
            columns: ["company_id", "assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["company_id", "created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      invite_links: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string
          company_id: string
          contact_id: string
          created_at: string
          created_by: string
          currency: string
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          metadata: Json
          pipeline_id: string
          probability: number
          source: Database["public"]["Enums"]["crm_source"]
          stage_id: string
          status: Database["public"]["Enums"]["lead_status"]
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to: string
          company_id: string
          contact_id: string
          created_at?: string
          created_by: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          metadata?: Json
          pipeline_id: string
          probability?: number
          source?: Database["public"]["Enums"]["crm_source"]
          stage_id: string
          status?: Database["public"]["Enums"]["lead_status"]
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string
          company_id?: string
          contact_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          metadata?: Json
          pipeline_id?: string
          probability?: number
          source?: Database["public"]["Enums"]["crm_source"]
          stage_id?: string
          status?: Database["public"]["Enums"]["lead_status"]
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["company_id", "assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_fkey"
            columns: ["company_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["company_id", "created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "leads_pipeline_fkey"
            columns: ["company_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "leads_stage_fkey"
            columns: ["company_id", "pipeline_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["company_id", "pipeline_id", "id"]
          },
        ]
      }
      notes: {
        Row: {
          company_id: string
          contact_id: string | null
          content: string
          created_at: string
          id: string
          lead_id: string | null
          source: Database["public"]["Enums"]["entry_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          content: string
          created_at?: string
          id?: string
          lead_id?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          content?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          source?: Database["public"]["Enums"]["entry_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_contact_fkey"
            columns: ["company_id", "contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "notes_lead_fkey"
            columns: ["company_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "notes_user_fkey"
            columns: ["company_id", "user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["company_id", "id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          is_lost_stage: boolean
          is_won_stage: boolean
          name: string
          pipeline_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color: string
          company_id: string
          created_at?: string
          id?: string
          is_lost_stage?: boolean
          is_won_stage?: boolean
          name: string
          pipeline_id: string
          position: number
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          is_lost_stage?: boolean
          is_won_stage?: boolean
          name?: string
          pipeline_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_company_pipeline_fkey"
            columns: ["company_id", "pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["company_id", "id"]
          },
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string
          department: string | null
          email: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string
          department?: string | null
          email: string
          id: string
          is_active?: boolean
          name: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          department?: string | null
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_vendor_edit_assignment: {
        Args: { assigned_user_id: string; target_company_id: string }
        Returns: boolean
      }
      current_company_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_company_analyst: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_company_owner: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      is_company_vendor: {
        Args: { target_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_type:
        | "call"
        | "email"
        | "meeting"
        | "note"
        | "task"
        | "whatsapp"
        | "instagram"
      authorized_email_role: "owner" | "analyst" | "vendor"
      channel_connection_status:
        | "connected"
        | "disconnected"
        | "error"
        | "pending"
      channel_type:
        | "whatsapp_business"
        | "whatsapp_personal"
        | "gmail"
        | "instagram"
        | "meet"
        | "zoom"
        | "teams"
        | "fathom"
      company_plan: "starter" | "pro" | "enterprise"
      company_status: "active" | "inactive" | "suspended"
      crm_source:
        | "manual"
        | "whatsapp"
        | "gmail"
        | "instagram"
        | "zoom"
        | "meet"
        | "import"
      entry_source: "manual" | "automatic"
      lead_status: "open" | "won" | "lost" | "paused"
      user_role: "owner" | "analyst" | "vendor"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: [
        "call",
        "email",
        "meeting",
        "note",
        "task",
        "whatsapp",
        "instagram",
      ],
      authorized_email_role: ["owner", "analyst", "vendor"],
      channel_connection_status: [
        "connected",
        "disconnected",
        "error",
        "pending",
      ],
      channel_type: [
        "whatsapp_business",
        "whatsapp_personal",
        "gmail",
        "instagram",
        "meet",
        "zoom",
        "teams",
        "fathom",
      ],
      company_plan: ["starter", "pro", "enterprise"],
      company_status: ["active", "inactive", "suspended"],
      crm_source: [
        "manual",
        "whatsapp",
        "gmail",
        "instagram",
        "zoom",
        "meet",
        "import",
      ],
      entry_source: ["manual", "automatic"],
      lead_status: ["open", "won", "lost", "paused"],
      user_role: ["owner", "analyst", "vendor"],
    },
  },
} as const

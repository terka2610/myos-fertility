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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      care_program_memberships: {
        Row: {
          care_role: string
          created_at: string
          id: string
          program_id: string
          treatment_stage: string | null
          user_id: string
        }
        Insert: {
          care_role?: string
          created_at?: string
          id?: string
          program_id: string
          treatment_stage?: string | null
          user_id: string
        }
        Update: {
          care_role?: string
          created_at?: string
          id?: string
          program_id?: string
          treatment_stage?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_program_memberships_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "care_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      care_programs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      consultation_messages: {
        Row: {
          care_role: string | null
          consultation_id: string
          content: string
          created_at: string
          id: string
          mode: string
          provenance: string
          safety: Json | null
          sender: string
          sources: Json
        }
        Insert: {
          care_role?: string | null
          consultation_id: string
          content: string
          created_at?: string
          id?: string
          mode?: string
          provenance?: string
          safety?: Json | null
          sender: string
          sources?: Json
        }
        Update: {
          care_role?: string | null
          consultation_id?: string
          content?: string
          created_at?: string
          id?: string
          mode?: string
          provenance?: string
          safety?: Json | null
          sender?: string
          sources?: Json
        }
        Relationships: [
          {
            foreignKeyName: "consultation_messages_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          care_role: string
          created_at: string
          id: string
          last_activity_at: string
          last_mode: string
          program_id: string
          summary: string | null
          user_id: string
        }
        Insert: {
          care_role?: string
          created_at?: string
          id?: string
          last_activity_at?: string
          last_mode?: string
          program_id: string
          summary?: string | null
          user_id: string
        }
        Update: {
          care_role?: string
          created_at?: string
          id?: string
          last_activity_at?: string
          last_mode?: string
          program_id?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "care_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_user_map: {
        Row: {
          auth_user_id: string | null
          email: string
          imported_profile: Json
          legacy_user_id: string
          linked_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          email: string
          imported_profile?: Json
          legacy_user_id: string
          linked_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          email?: string
          imported_profile?: Json
          legacy_user_id?: string
          linked_at?: string | null
        }
        Relationships: []
      }
      linq_contacts: {
        Row: {
          awaiting_booking_at: string | null
          created_at: string
          handle: string
        }
        Insert: {
          awaiting_booking_at?: string | null
          created_at?: string
          handle: string
        }
        Update: {
          awaiting_booking_at?: string | null
          created_at?: string
          handle?: string
        }
        Relationships: []
      }
      linq_events: {
        Row: {
          created_at: string
          event_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
        }
        Relationships: []
      }
      patient_context_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          is_synthetic: boolean
          kind: string
          patient_id: string
          provenance: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_synthetic?: boolean
          kind: string
          patient_id: string
          provenance?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_synthetic?: boolean
          kind?: string
          patient_id?: string
          provenance?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          legacy_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          legacy_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          legacy_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      simulated_escalations: {
        Row: {
          category: string
          consultation_id: string
          created_at: string
          id: string
          summary: string
        }
        Insert: {
          category: string
          consultation_id: string
          created_at?: string
          id?: string
          summary: string
        }
        Update: {
          category?: string
          consultation_id?: string
          created_at?: string
          id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulated_escalations_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_booking_requests: {
        Row: {
          contact: string
          created_at: string
          doctor_id: string
          id: string
          note: string
          owner_id: string
          patient_name: string
          preferred_time: string
        }
        Insert: {
          contact: string
          created_at?: string
          doctor_id: string
          id?: string
          note?: string
          owner_id: string
          patient_name: string
          preferred_time?: string
        }
        Update: {
          contact?: string
          created_at?: string
          doctor_id?: string
          id?: string
          note?: string
          owner_id?: string
          patient_name?: string
          preferred_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_booking_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "twin_doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_chunks: {
        Row: {
          content: string
          created_at: string
          doc_name: string
          doctor_id: string
          document_id: string | null
          id: string
          section: string
        }
        Insert: {
          content: string
          created_at?: string
          doc_name: string
          doctor_id: string
          document_id?: string | null
          id?: string
          section: string
        }
        Update: {
          content?: string
          created_at?: string
          doc_name?: string
          doctor_id?: string
          document_id?: string | null
          id?: string
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_chunks_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "twin_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twin_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "twin_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_doctors: {
        Row: {
          bio: string
          clinic: string
          consent: boolean
          created_at: string
          id: string
          is_demo: boolean
          is_female: boolean
          languages: string
          mouth_x: number
          mouth_y: number
          name: string
          owner_id: string
          photos: string[]
          specialty: string
          status: string
          supports_queer_trans: boolean
          supports_single_women: boolean
          treats_endo: boolean
          treats_pcos: boolean
          videos: Json
          voice_id: string | null
        }
        Insert: {
          bio?: string
          clinic?: string
          consent?: boolean
          created_at?: string
          id?: string
          is_demo?: boolean
          is_female?: boolean
          languages?: string
          mouth_x?: number
          mouth_y?: number
          name: string
          owner_id: string
          photos?: string[]
          specialty?: string
          status?: string
          supports_queer_trans?: boolean
          supports_single_women?: boolean
          treats_endo?: boolean
          treats_pcos?: boolean
          videos?: Json
          voice_id?: string | null
        }
        Update: {
          bio?: string
          clinic?: string
          consent?: boolean
          created_at?: string
          id?: string
          is_demo?: boolean
          is_female?: boolean
          languages?: string
          mouth_x?: number
          mouth_y?: number
          name?: string
          owner_id?: string
          photos?: string[]
          specialty?: string
          status?: string
          supports_queer_trans?: boolean
          supports_single_women?: boolean
          treats_endo?: boolean
          treats_pcos?: boolean
          videos?: Json
          voice_id?: string | null
        }
        Relationships: []
      }
      twin_documents: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          name: string
          status: string
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          name: string
          status?: string
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          name?: string
          status?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twin_documents_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "twin_doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_nurse_reviews: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          owner_id: string
          patient_id: string | null
          patient_name: string
          question: string
          reason: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          owner_id: string
          patient_id?: string | null
          patient_name?: string
          question: string
          reason: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          owner_id?: string
          patient_id?: string | null
          patient_name?: string
          question?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "twin_nurse_reviews_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "twin_doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twin_nurse_reviews_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "twin_patients"
            referencedColumns: ["id"]
          },
        ]
      }
      twin_patients: {
        Row: {
          created_at: string
          diagnosis: string
          display_name: string
          id: string
          knowledge_level: string
          language: string
          medication: string
          owner_id: string
          preferences: string[]
          preferred_language: string
          reason: string
          values_note: string
        }
        Insert: {
          created_at?: string
          diagnosis?: string
          display_name: string
          id?: string
          knowledge_level?: string
          language?: string
          medication?: string
          owner_id: string
          preferences?: string[]
          preferred_language?: string
          reason?: string
          values_note?: string
        }
        Update: {
          created_at?: string
          diagnosis?: string
          display_name?: string
          id?: string
          knowledge_level?: string
          language?: string
          medication?: string
          owner_id?: string
          preferences?: string[]
          preferred_language?: string
          reason?: string
          values_note?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
    }
    Enums: {
      app_role: "admin" | "publisher" | "subscriber" | "clinic_staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "publisher", "subscriber", "clinic_staff"],
    },
  },
} as const

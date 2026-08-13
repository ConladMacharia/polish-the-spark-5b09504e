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
      ai_reports: {
        Row: {
          content: Json
          generated_at: string
          id: string
          language: Database["public"]["Enums"]["preferred_language"]
          patient_id: string
          period_end: string | null
          period_start: string | null
          recommended_followup_weeks: number | null
          report_type: Database["public"]["Enums"]["report_type"]
          summary: string
        }
        Insert: {
          content?: Json
          generated_at?: string
          id?: string
          language?: Database["public"]["Enums"]["preferred_language"]
          patient_id: string
          period_end?: string | null
          period_start?: string | null
          recommended_followup_weeks?: number | null
          report_type: Database["public"]["Enums"]["report_type"]
          summary: string
        }
        Update: {
          content?: Json
          generated_at?: string
          id?: string
          language?: Database["public"]["Enums"]["preferred_language"]
          patient_id?: string
          period_end?: string | null
          period_start?: string | null
          recommended_followup_weeks?: number | null
          report_type?: Database["public"]["Enums"]["report_type"]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at: string
          id: string
          message: string
          patient_id: string
          resolved: boolean
          severity: Database["public"]["Enums"]["alert_severity"]
          therapist_id: string
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          message: string
          patient_id: string
          resolved?: boolean
          severity?: Database["public"]["Enums"]["alert_severity"]
          therapist_id: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["alert_type"]
          created_at?: string
          id?: string
          message?: string
          patient_id?: string
          resolved?: boolean
          severity?: Database["public"]["Enums"]["alert_severity"]
          therapist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      child_exercise_targets: {
        Row: {
          created_at: string
          exercise_slug: string
          id: string
          note: string | null
          patient_id: string
          set_by: string
          side: string | null
          target_angle_primary: number | null
          target_angle_secondary: number | null
          target_duration_seconds: number | null
          target_reps: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exercise_slug: string
          id?: string
          note?: string | null
          patient_id: string
          set_by?: string
          side?: string | null
          target_angle_primary?: number | null
          target_angle_secondary?: number | null
          target_duration_seconds?: number | null
          target_reps?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exercise_slug?: string
          id?: string
          note?: string | null
          patient_id?: string
          set_by?: string
          side?: string | null
          target_angle_primary?: number | null
          target_angle_secondary?: number | null
          target_duration_seconds?: number | null
          target_reps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_exercise_targets_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_prescriptions: {
        Row: {
          active: boolean
          created_at: string
          difficulty_level: number
          exercise: Database["public"]["Enums"]["exercise_type"]
          frequency_per_week: number
          id: string
          notes: string | null
          patient_id: string
          target_angle_deg: number | null
          target_hold_ms: number
          target_reps: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          difficulty_level?: number
          exercise: Database["public"]["Enums"]["exercise_type"]
          frequency_per_week?: number
          id?: string
          notes?: string | null
          patient_id: string
          target_angle_deg?: number | null
          target_hold_ms?: number
          target_reps?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          difficulty_level?: number
          exercise?: Database["public"]["Enums"]["exercise_type"]
          frequency_per_week?: number
          id?: string
          notes?: string | null
          patient_id?: string
          target_angle_deg?: number | null
          target_hold_ms?: number
          target_reps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      pain_mood_logs: {
        Row: {
          created_at: string
          id: string
          mood: Database["public"]["Enums"]["mood_tag"]
          note: string | null
          pain_level: number | null
          patient_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood: Database["public"]["Enums"]["mood_tag"]
          note?: string | null
          pain_level?: number | null
          patient_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: Database["public"]["Enums"]["mood_tag"]
          note?: string | null
          pain_level?: number | null
          patient_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pain_mood_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pain_mood_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          active: boolean
          affected_side: Database["public"]["Enums"]["affected_side"]
          child_name: string
          claim_code: string
          claimed_at: string | null
          claimed_by_caregiver_id: string | null
          condition_notes: string | null
          contraindications: string | null
          created_at: string
          date_of_birth: string | null
          gmfcs_level: Database["public"]["Enums"]["gmfcs_level"] | null
          goals: string[]
          id: string
          next_followup_at: string | null
          preferred_language: Database["public"]["Enums"]["preferred_language"]
          therapist_id: string | null
          ui_language: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          affected_side?: Database["public"]["Enums"]["affected_side"]
          child_name: string
          claim_code: string
          claimed_at?: string | null
          claimed_by_caregiver_id?: string | null
          condition_notes?: string | null
          contraindications?: string | null
          created_at?: string
          date_of_birth?: string | null
          gmfcs_level?: Database["public"]["Enums"]["gmfcs_level"] | null
          goals?: string[]
          id?: string
          next_followup_at?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          therapist_id?: string | null
          ui_language?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          affected_side?: Database["public"]["Enums"]["affected_side"]
          child_name?: string
          claim_code?: string
          claimed_at?: string | null
          claimed_by_caregiver_id?: string | null
          condition_notes?: string | null
          contraindications?: string | null
          created_at?: string
          date_of_birth?: string | null
          gmfcs_level?: Database["public"]["Enums"]["gmfcs_level"] | null
          goals?: string[]
          id?: string
          next_followup_at?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          therapist_id?: string | null
          ui_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          preferred_language: Database["public"]["Enums"]["preferred_language"]
          ui_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          ui_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          ui_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      rep_evaluations: {
        Row: {
          angle_achieved_deg: number | null
          correctness_score: number
          created_at: string
          difficulty_at_time: number | null
          hold_achieved_ms: number | null
          id: string
          rep_number: number
          session_id: string
        }
        Insert: {
          angle_achieved_deg?: number | null
          correctness_score: number
          created_at?: string
          difficulty_at_time?: number | null
          hold_achieved_ms?: number | null
          id?: string
          rep_number: number
          session_id: string
        }
        Update: {
          angle_achieved_deg?: number | null
          correctness_score?: number
          created_at?: string
          difficulty_at_time?: number | null
          hold_achieved_ms?: number | null
          id?: string
          rep_number?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_evaluations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          avg_correctness: number | null
          avg_range_of_motion_deg: number | null
          caregiver_id: string | null
          completion_pct: number
          created_at: string
          demo_mode: boolean
          difficulty_level: number
          duration_seconds: number
          exercise: Database["public"]["Enums"]["exercise_type"]
          exercise_slug: string | null
          id: string
          language_used: Database["public"]["Enums"]["preferred_language"]
          patient_id: string
          reps_completed: number
          reps_target: number
          started_at: string
        }
        Insert: {
          avg_correctness?: number | null
          avg_range_of_motion_deg?: number | null
          caregiver_id?: string | null
          completion_pct?: number
          created_at?: string
          demo_mode?: boolean
          difficulty_level?: number
          duration_seconds?: number
          exercise: Database["public"]["Enums"]["exercise_type"]
          exercise_slug?: string | null
          id?: string
          language_used?: Database["public"]["Enums"]["preferred_language"]
          patient_id: string
          reps_completed?: number
          reps_target?: number
          started_at?: string
        }
        Update: {
          avg_correctness?: number | null
          avg_range_of_motion_deg?: number | null
          caregiver_id?: string | null
          completion_pct?: number
          created_at?: string
          demo_mode?: boolean
          difficulty_level?: number
          duration_seconds?: number
          exercise?: Database["public"]["Enums"]["exercise_type"]
          exercise_slug?: string | null
          id?: string
          language_used?: Database["public"]["Enums"]["preferred_language"]
          patient_id?: string
          reps_completed?: number
          reps_target?: number
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      therapists: {
        Row: {
          city: string | null
          clinic_name: string
          country: string | null
          created_at: string
          license_number: string | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          city?: string | null
          clinic_name: string
          country?: string | null
          created_at?: string
          license_number?: string | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          city?: string | null
          clinic_name?: string
          country?: string | null
          created_at?: string
          license_number?: string | null
          updated_at?: string
          user_id?: string
          verified?: boolean
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
          role: Database["public"]["Enums"]["app_role"]
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
      claim_patient_by_code: { Args: { _claim_code: string }; Returns: string }
      generate_claim_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_can_access_patient: {
        Args: { _patient_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      affected_side: "left" | "right" | "bilateral" | "none"
      alert_severity: "info" | "warning" | "urgent"
      alert_type:
        | "missed_sessions"
        | "pain_reported"
        | "regression"
        | "poor_form"
        | "goal_reached"
      app_role: "admin" | "therapist" | "caregiver"
      exercise_type:
        | "arm_raise"
        | "leg_kick"
        | "balance_hold"
        | "gait"
        | "postural_control"
        | "occupational"
      gmfcs_level: "I" | "II" | "III" | "IV" | "V"
      mood_tag: "happy" | "tired" | "pain" | "frustrated" | "proud"
      preferred_language: "en" | "sw" | "ki"
      report_type: "daily" | "weekly" | "monthly" | "on_demand"
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
      affected_side: ["left", "right", "bilateral", "none"],
      alert_severity: ["info", "warning", "urgent"],
      alert_type: [
        "missed_sessions",
        "pain_reported",
        "regression",
        "poor_form",
        "goal_reached",
      ],
      app_role: ["admin", "therapist", "caregiver"],
      exercise_type: [
        "arm_raise",
        "leg_kick",
        "balance_hold",
        "gait",
        "postural_control",
        "occupational",
      ],
      gmfcs_level: ["I", "II", "III", "IV", "V"],
      mood_tag: ["happy", "tired", "pain", "frustrated", "proud"],
      preferred_language: ["en", "sw", "ki"],
      report_type: ["daily", "weekly", "monthly", "on_demand"],
    },
  },
} as const

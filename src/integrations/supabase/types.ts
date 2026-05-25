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
      practice_configs: {
        Row: {
          club: string
          config_key: string
          created_at: string
          id: string
          metrics: Json
          power: string
          shot_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          club: string
          config_key: string
          created_at?: string
          id?: string
          metrics?: Json
          power: string
          shot_type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          club?: string
          config_key?: string
          created_at?: string
          id?: string
          metrics?: Json
          power?: string
          shot_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      practice_drill_scores: {
        Row: {
          balls: number | null
          config_key: string
          created_at: string
          drill_id: string
          drill_kind: string
          id: string
          max_score: number
          notes: string | null
          payload: Json
          score: number
          score_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balls?: number | null
          config_key: string
          created_at?: string
          drill_id: string
          drill_kind: string
          id?: string
          max_score: number
          notes?: string | null
          payload?: Json
          score: number
          score_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balls?: number | null
          config_key?: string
          created_at?: string
          drill_id?: string
          drill_kind?: string
          id?: string
          max_score?: number
          notes?: string | null
          payload?: Json
          score?: number
          score_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      practice_sessions: {
        Row: {
          club_id: string
          created_at: string
          id: string
          metrics: Json
          notes: string | null
          session_date: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          metrics?: Json
          notes?: string | null
          session_date: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          metrics?: Json
          notes?: string | null
          session_date?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      practice_shots: {
        Row: {
          created_at: string
          excluded: boolean
          id: string
          metrics: Json
          session_id: string
          shot_number: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          excluded?: boolean
          id?: string
          metrics?: Json
          session_id: string
          shot_number: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          excluded?: boolean
          id?: string
          metrics?: Json
          session_id?: string
          shot_number?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_shots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shot_profiles: {
        Row: {
          club_id: string
          created_at: string
          enabled: boolean
          id: string
          power: string
          profile_key: string
          routine: string | null
          shot_type: string
          show_in_practice: boolean
          show_on_course: boolean
          target_carry: number | null
          target_side_left: number | null
          target_side_right: number | null
          target_total: number | null
          target_variation_pct: number | null
          targets: string[]
          technique: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          power: string
          profile_key: string
          routine?: string | null
          shot_type: string
          show_in_practice?: boolean
          show_on_course?: boolean
          target_carry?: number | null
          target_side_left?: number | null
          target_side_right?: number | null
          target_total?: number | null
          target_variation_pct?: number | null
          targets?: string[]
          technique?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          power?: string
          profile_key?: string
          routine?: string | null
          shot_type?: string
          show_in_practice?: boolean
          show_on_course?: boolean
          target_carry?: number | null
          target_side_left?: number | null
          target_side_right?: number | null
          target_total?: number | null
          target_variation_pct?: number | null
          targets?: string[]
          technique?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      putting_drills: {
        Row: {
          category: string
          created_at: string
          id: string
          is_builtin: boolean
          level_bands: Json
          max_score: number
          name: string
          purpose: string | null
          recommendation: string | null
          reps: number
          scaled: boolean
          scaled_max: number | null
          scoring_inputs: Json
          setup: string | null
          sort_order: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_builtin?: boolean
          level_bands?: Json
          max_score?: number
          name: string
          purpose?: string | null
          recommendation?: string | null
          reps?: number
          scaled?: boolean
          scaled_max?: number | null
          scoring_inputs?: Json
          setup?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_builtin?: boolean
          level_bands?: Json
          max_score?: number
          name?: string
          purpose?: string | null
          recommendation?: string | null
          reps?: number
          scaled?: boolean
          scaled_max?: number | null
          scoring_inputs?: Json
          setup?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      putting_sessions: {
        Row: {
          best_drill: string | null
          carpet_speed: string | null
          category: string
          created_at: string
          drill_results: Json
          id: string
          level: string | null
          location: string | null
          main_miss: string | null
          max_total: number
          notes_before: string | null
          recommendation: string | null
          session_date: string
          session_length: string | null
          target_type: string | null
          total_score: number
          updated_at: string
          user_id: string
          weakest_drill: string | null
        }
        Insert: {
          best_drill?: string | null
          carpet_speed?: string | null
          category?: string
          created_at?: string
          drill_results?: Json
          id?: string
          level?: string | null
          location?: string | null
          main_miss?: string | null
          max_total?: number
          notes_before?: string | null
          recommendation?: string | null
          session_date?: string
          session_length?: string | null
          target_type?: string | null
          total_score?: number
          updated_at?: string
          user_id: string
          weakest_drill?: string | null
        }
        Update: {
          best_drill?: string | null
          carpet_speed?: string | null
          category?: string
          created_at?: string
          drill_results?: Json
          id?: string
          level?: string | null
          location?: string | null
          main_miss?: string | null
          max_total?: number
          notes_before?: string | null
          recommendation?: string | null
          session_date?: string
          session_length?: string | null
          target_type?: string | null
          total_score?: number
          updated_at?: string
          user_id?: string
          weakest_drill?: string | null
        }
        Relationships: []
      }
      shots: {
        Row: {
          carry: number | null
          club: string
          created_at: string
          curve: string | null
          end_distance_from_target: number | null
          end_lie: string | null
          id: string
          notes: string | null
          offline: number | null
          shot_date: string | null
          shot_quality: string | null
          shot_type: string | null
          start_lie: string | null
          start_line: string | null
          strike_quality: string | null
          target: number | null
          total: number | null
          user_id: string | null
        }
        Insert: {
          carry?: number | null
          club: string
          created_at?: string
          curve?: string | null
          end_distance_from_target?: number | null
          end_lie?: string | null
          id?: string
          notes?: string | null
          offline?: number | null
          shot_date?: string | null
          shot_quality?: string | null
          shot_type?: string | null
          start_lie?: string | null
          start_line?: string | null
          strike_quality?: string | null
          target?: number | null
          total?: number | null
          user_id?: string | null
        }
        Update: {
          carry?: number | null
          club?: string
          created_at?: string
          curve?: string | null
          end_distance_from_target?: number | null
          end_lie?: string | null
          id?: string
          notes?: string | null
          offline?: number | null
          shot_date?: string | null
          shot_quality?: string | null
          shot_type?: string | null
          start_lie?: string | null
          start_line?: string | null
          strike_quality?: string | null
          target?: number | null
          total?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

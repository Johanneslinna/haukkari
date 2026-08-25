export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      baseline_tests: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          result: Json
          test_type: string
          tested_on: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          result: Json
          test_type: string
          tested_on: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          result?: Json
          test_type?: string
          tested_on?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      body_metrics: {
        Row: {
          body_fat_percent: number | null
          created_at: string
          deleted_at: string | null
          id: string
          measured_on: string
          measurements: Json
          updated_at: string
          user_id: string
          version: number
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          body_fat_percent?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          measured_on: string
          measurements?: Json
          updated_at?: string
          user_id: string
          version?: number
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          body_fat_percent?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          measured_on?: string
          measurements?: Json
          updated_at?: string
          user_id?: string
          version?: number
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      competition_events: {
        Row: {
          created_at: string
          deleted_at: string | null
          details: Json
          id: string
          name: string
          priority: string
          sport_profile_id: string | null
          starts_at: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          details?: Json
          id?: string
          name: string
          priority: string
          sport_profile_id?: string | null
          starts_at: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          details?: Json
          id?: string
          name?: string
          priority?: string
          sport_profile_id?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "competitions_profile_fk"
            columns: ["sport_profile_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sport_profiles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          answers: Json
          checkin_date: string
          created_at: string
          deleted_at: string | null
          id: string
          readiness: Database["public"]["Enums"]["readiness_state"]
          reasons: string[]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          answers: Json
          checkin_date: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          readiness: Database["public"]["Enums"]["readiness_state"]
          reasons?: string[]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          answers?: Json
          checkin_date?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          readiness?: Database["public"]["Enums"]["readiness_state"]
          reasons?: string[]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      exercise_definitions: {
        Row: {
          content_release_id: string
          created_at: string
          definition: Json
          definition_version: string
          exercise_code: string
          name_fi: string
        }
        Insert: {
          content_release_id: string
          created_at?: string
          definition: Json
          definition_version: string
          exercise_code: string
          name_fi: string
        }
        Update: {
          content_release_id?: string
          created_at?: string
          definition?: Json
          definition_version?: string
          exercise_code?: string
          name_fi?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_definitions_content_release_id_fkey"
            columns: ["content_release_id"]
            isOneToOne: false
            referencedRelation: "training_content_releases"
            referencedColumns: ["release_id"]
          },
        ]
      }
      exercise_set_logs: {
        Row: {
          created_at: string
          data: Json
          deleted_at: string | null
          id: string
          load_kg: number | null
          ordinal: number
          repetitions: number | null
          rir: number | null
          updated_at: string
          user_id: string
          version: number
          workout_exercise_id: string | null
          workout_log_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          id?: string
          load_kg?: number | null
          ordinal: number
          repetitions?: number | null
          rir?: number | null
          updated_at?: string
          user_id: string
          version?: number
          workout_exercise_id?: string | null
          workout_log_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          deleted_at?: string | null
          id?: string
          load_kg?: number | null
          ordinal?: number
          repetitions?: number | null
          rir?: number | null
          updated_at?: string
          user_id?: string
          version?: number
          workout_exercise_id?: string | null
          workout_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_set_logs_exercise_fk"
            columns: ["workout_exercise_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "exercise_set_logs_log_fk"
            columns: ["workout_log_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: string
          code: string
          content_release_id: string | null
          content_version: string | null
          created_at: string
          definition: Json
          equipment: string[]
          id: string
          instructions_fi: string
          is_active: boolean
          name_fi: string
          updated_at: string
        }
        Insert: {
          category: string
          code: string
          content_release_id?: string | null
          content_version?: string | null
          created_at?: string
          definition?: Json
          equipment?: string[]
          id?: string
          instructions_fi?: string
          is_active?: boolean
          name_fi: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          content_release_id?: string | null
          content_version?: string | null
          created_at?: string
          definition?: Json
          equipment?: string[]
          id?: string
          instructions_fi?: string
          is_active?: boolean
          name_fi?: string
          updated_at?: string
        }
        Relationships: []
      }
      fixed_sport_sessions: {
        Row: {
          coach_defined: boolean
          created_at: string
          deleted_at: string | null
          duration_minutes: number
          id: string
          rpe: number | null
          session_data: Json
          sport_profile_id: string
          starts_at: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          coach_defined?: boolean
          created_at?: string
          deleted_at?: string | null
          duration_minutes: number
          id?: string
          rpe?: number | null
          session_data?: Json
          sport_profile_id: string
          starts_at: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          coach_defined?: boolean
          created_at?: string
          deleted_at?: string | null
          duration_minutes?: number
          id?: string
          rpe?: number | null
          session_data?: Json
          sport_profile_id?: string
          starts_at?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_sessions_profile_fk"
            columns: ["sport_profile_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sport_profiles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goal_periods: {
        Row: {
          created_at: string
          deleted_at: string | null
          ends_on: string | null
          goal_profile_id: string
          id: string
          starts_on: string
          status: string
          summary: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          ends_on?: string | null
          goal_profile_id: string
          id?: string
          starts_on: string
          status?: string
          summary?: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          ends_on?: string | null
          goal_profile_id?: string
          id?: string
          starts_on?: string
          status?: string
          summary?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_periods_goal_profile_fk"
            columns: ["goal_profile_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goal_profiles"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      goal_profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          preferences: Json
          primary_goal: Database["public"]["Enums"]["goal_type"]
          secondary_goals: Database["public"]["Enums"]["goal_type"][]
          target_date: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          preferences?: Json
          primary_goal: Database["public"]["Enums"]["goal_type"]
          secondary_goals?: Database["public"]["Enums"]["goal_type"][]
          target_date?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          preferences?: Json
          primary_goal?: Database["public"]["Enums"]["goal_type"]
          secondary_goals?: Database["public"]["Enums"]["goal_type"][]
          target_date?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      health_screenings: {
        Row: {
          answers: Json
          consent_at: string
          created_at: string
          deleted_at: string | null
          id: string
          screened_on: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          answers: Json
          consent_at: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          screened_on?: string
          status: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          answers?: Json
          consent_at?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          screened_on?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          carbohydrate_g: number | null
          created_at: string
          deleted_at: string | null
          energy_kcal: number | null
          fat_g: number | null
          id: string
          logged_at: string
          meals: Json
          protein_g: number | null
          tracking_mode: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          carbohydrate_g?: number | null
          created_at?: string
          deleted_at?: string | null
          energy_kcal?: number | null
          fat_g?: number | null
          id?: string
          logged_at: string
          meals?: Json
          protein_g?: number | null
          tracking_mode: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          carbohydrate_g?: number | null
          created_at?: string
          deleted_at?: string | null
          energy_kcal?: number | null
          fat_g?: number | null
          id?: string
          logged_at?: string
          meals?: Json
          protein_g?: number | null
          tracking_mode?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      plan_versions: {
        Row: {
          change_reason: string
          created_at: string
          deleted_at: string | null
          effective_from: string
          goal_period_id: string
          id: string
          previous_plan_version_id: string | null
          snapshot: Json
          updated_at: string
          user_id: string
          version: number
          version_number: number
        }
        Insert: {
          change_reason: string
          created_at?: string
          deleted_at?: string | null
          effective_from: string
          goal_period_id: string
          id?: string
          previous_plan_version_id?: string | null
          snapshot: Json
          updated_at?: string
          user_id: string
          version?: number
          version_number: number
        }
        Update: {
          change_reason?: string
          created_at?: string
          deleted_at?: string | null
          effective_from?: string
          goal_period_id?: string
          id?: string
          previous_plan_version_id?: string | null
          snapshot?: Json
          updated_at?: string
          user_id?: string
          version?: number
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_versions_goal_period_fk"
            columns: ["goal_period_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goal_periods"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "plan_versions_previous_fk"
            columns: ["previous_plan_version_id", "user_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_settings: Json
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          height_cm: number | null
          id: string
          locale: string
          onboarding_completed: boolean
          sensitive_data_consent_at: string | null
          timezone: string
          updated_at: string
          user_id: string
          version: number
          weight_kg: number | null
        }
        Insert: {
          app_settings?: Json
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          height_cm?: number | null
          id?: string
          locale?: string
          onboarding_completed?: boolean
          sensitive_data_consent_at?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
          version?: number
          weight_kg?: number | null
        }
        Update: {
          app_settings?: Json
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          height_cm?: number | null
          id?: string
          locale?: string
          onboarding_completed?: boolean
          sensitive_data_consent_at?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          version?: number
          weight_kg?: number | null
        }
        Relationships: []
      }
      push_delivery_receipts: {
        Row: {
          created_at: string
          id: string
          reminder_id: string
          schedule_key: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reminder_id: string
          schedule_key: string
          subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reminder_id?: string
          schedule_key?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_delivery_receipts_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_delivery_receipts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          deleted_at: string | null
          device_key: string
          endpoint: string
          expires_at: string | null
          id: string
          p256dh: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          auth_key: string
          created_at?: string
          deleted_at?: string | null
          device_key: string
          endpoint: string
          expires_at?: string | null
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          auth_key?: string
          created_at?: string
          deleted_at?: string | null
          device_key?: string
          endpoint?: string
          expires_at?: string | null
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      reassessments: {
        Row: {
          assessed_on: string
          created_at: string
          deleted_at: string | null
          id: string
          result: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          assessed_on: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          result: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          assessed_on?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          result?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      reminders: {
        Row: {
          channel: string
          created_at: string
          deleted_at: string | null
          enabled: boolean
          id: string
          local_time: string
          timezone: string
          title: string
          updated_at: string
          user_id: string
          version: number
          weekdays: number[]
        }
        Insert: {
          channel?: string
          created_at?: string
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          local_time: string
          timezone: string
          title: string
          updated_at?: string
          user_id: string
          version?: number
          weekdays?: number[]
        }
        Update: {
          channel?: string
          created_at?: string
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          local_time?: string
          timezone?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
          weekdays?: number[]
        }
        Relationships: []
      }
      run_logs: {
        Row: {
          average_heart_rate: number | null
          created_at: string
          deleted_at: string | null
          distance_m: number
          duration_seconds: number
          id: string
          route_data: Json
          rpe: number | null
          started_at: string
          updated_at: string
          user_id: string
          version: number
          workout_log_id: string | null
        }
        Insert: {
          average_heart_rate?: number | null
          created_at?: string
          deleted_at?: string | null
          distance_m: number
          duration_seconds: number
          id?: string
          route_data?: Json
          rpe?: number | null
          started_at: string
          updated_at?: string
          user_id: string
          version?: number
          workout_log_id?: string | null
        }
        Update: {
          average_heart_rate?: number | null
          created_at?: string
          deleted_at?: string | null
          distance_m?: number
          duration_seconds?: number
          id?: string
          route_data?: Json
          rpe?: number | null
          started_at?: string
          updated_at?: string
          user_id?: string
          version?: number
          workout_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "run_logs_workout_log_fk"
            columns: ["workout_log_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      sport_profiles: {
        Row: {
          created_at: string
          deleted_at: string | null
          demand_profile: Json
          experience_years: number | null
          id: string
          priority: string
          settings: Json
          sport_code: string
          subtype: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          demand_profile?: Json
          experience_years?: number | null
          id?: string
          priority?: string
          settings?: Json
          sport_code: string
          subtype?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          demand_profile?: Json
          experience_years?: number | null
          id?: string
          priority?: string
          settings?: Json
          sport_code?: string
          subtype?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      sync_conflicts: {
        Row: {
          created_at: string
          deleted_at: string | null
          entity_id: string
          entity_table: string
          id: string
          local_snapshot: Json
          local_version: number
          remote_snapshot: Json
          remote_version: number
          resolution: Json | null
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entity_id: string
          entity_table: string
          id?: string
          local_snapshot: Json
          local_version: number
          remote_snapshot: Json
          remote_version: number
          resolution?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          entity_table?: string
          id?: string
          local_snapshot?: Json
          local_version?: number
          remote_snapshot?: Json
          remote_version?: number
          resolution?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      sync_devices: {
        Row: {
          created_at: string
          deleted_at: string | null
          device_key: string
          display_name: string
          id: string
          last_pulled_at: string | null
          last_pulled_id: string | null
          last_seen_at: string | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          device_key: string
          display_name: string
          id?: string
          last_pulled_at?: string | null
          last_pulled_id?: string | null
          last_seen_at?: string | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          device_key?: string
          display_name?: string
          id?: string
          last_pulled_at?: string | null
          last_pulled_id?: string | null
          last_seen_at?: string | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      sync_operations: {
        Row: {
          applied_at: string | null
          base_version: number | null
          created_at: string
          deleted_at: string | null
          device_id: string | null
          entity_id: string
          entity_table: string
          error_code: string | null
          id: string
          operation: string
          payload: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          applied_at?: string | null
          base_version?: number | null
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          entity_id: string
          entity_table: string
          error_code?: string | null
          id: string
          operation: string
          payload: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          applied_at?: string | null
          base_version?: number | null
          created_at?: string
          deleted_at?: string | null
          device_id?: string | null
          entity_id?: string
          entity_table?: string
          error_code?: string | null
          id?: string
          operation?: string
          payload?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sync_operations_device_fk"
            columns: ["device_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sync_devices"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      training_content_releases: {
        Row: {
          content_digest: string
          created_at: string
          immutable: boolean
          published_at: string
          release_id: string
          semantic_version: string
          status: string
        }
        Insert: {
          content_digest: string
          created_at?: string
          immutable?: boolean
          published_at: string
          release_id: string
          semantic_version: string
          status: string
        }
        Update: {
          content_digest?: string
          created_at?: string
          immutable?: boolean
          published_at?: string
          release_id?: string
          semantic_version?: string
          status?: string
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          plan: Json
          plan_version_id: string
          status: string
          updated_at: string
          user_id: string
          version: number
          week_count: number
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          plan: Json
          plan_version_id: string
          status?: string
          updated_at?: string
          user_id: string
          version?: number
          week_count: number
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          plan?: Json
          plan_version_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
          week_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_version_fk"
            columns: ["plan_version_id", "user_id"]
            isOneToOne: false
            referencedRelation: "plan_versions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          created_at: string
          deleted_at: string | null
          exercise_id: string | null
          id: string
          ordinal: number
          prescription: Json
          updated_at: string
          user_id: string
          version: number
          workout_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          exercise_id?: string | null
          id?: string
          ordinal: number
          prescription: Json
          updated_at?: string
          user_id: string
          version?: number
          workout_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          exercise_id?: string | null
          id?: string
          ordinal?: number
          prescription?: Json
          updated_at?: string
          user_id?: string
          version?: number
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_fk"
            columns: ["workout_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          completion_status: string
          created_at: string
          decision_trace: Json
          deleted_at: string | null
          duration_minutes: number | null
          feedback: Json
          id: string
          notes: string | null
          performed_at: string
          rpe: number | null
          updated_at: string
          user_id: string
          version: number
          workout_id: string | null
        }
        Insert: {
          completion_status?: string
          created_at?: string
          decision_trace?: Json
          deleted_at?: string | null
          duration_minutes?: number | null
          feedback?: Json
          id?: string
          notes?: string | null
          performed_at: string
          rpe?: number | null
          updated_at?: string
          user_id: string
          version?: number
          workout_id?: string | null
        }
        Update: {
          completion_status?: string
          created_at?: string
          decision_trace?: Json
          deleted_at?: string | null
          duration_minutes?: number | null
          feedback?: Json
          id?: string
          notes?: string | null
          performed_at?: string
          rpe?: number | null
          updated_at?: string
          user_id?: string
          version?: number
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_workout_fk"
            columns: ["workout_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          template: Json
          title: string
          updated_at: string
          user_id: string
          version: number
          workout_type: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          template: Json
          title: string
          updated_at?: string
          user_id: string
          version?: number
          workout_type: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          template?: Json
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
          workout_type?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          created_at: string
          decision_trace: Json
          deleted_at: string | null
          duration_minutes: number
          id: string
          intensity: string
          prescription: Json
          scheduled_for: string
          status: string
          title: string
          training_plan_id: string | null
          updated_at: string
          user_id: string
          variants: Json
          version: number
          workout_template_id: string | null
        }
        Insert: {
          created_at?: string
          decision_trace?: Json
          deleted_at?: string | null
          duration_minutes: number
          id?: string
          intensity: string
          prescription?: Json
          scheduled_for: string
          status?: string
          title: string
          training_plan_id?: string | null
          updated_at?: string
          user_id: string
          variants?: Json
          version?: number
          workout_template_id?: string | null
        }
        Update: {
          created_at?: string
          decision_trace?: Json
          deleted_at?: string | null
          duration_minutes?: number
          id?: string
          intensity?: string
          prescription?: Json
          scheduled_for?: string
          status?: string
          title?: string
          training_plan_id?: string | null
          updated_at?: string
          user_id?: string
          variants?: Json
          version?: number
          workout_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workouts_plan_fk"
            columns: ["training_plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "workouts_template_fk"
            columns: ["workout_template_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      dispatch_push_reminders: { Args: never; Returns: number }
    }
    Enums: {
      goal_type:
        | "BODY_RECOMPOSITION"
        | "FAT_LOSS"
        | "MUSCLE_GAIN"
        | "MAX_STRENGTH"
        | "ENDURANCE"
        | "SPEED_POWER"
        | "GENERAL_FITNESS"
        | "POSTURE_MOBILITY"
        | "SPORT_PERFORMANCE"
      readiness_state: "GREEN" | "YELLOW" | "ORANGE_RECOVERY" | "RED_STOP"
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
      goal_type: [
        "BODY_RECOMPOSITION",
        "FAT_LOSS",
        "MUSCLE_GAIN",
        "MAX_STRENGTH",
        "ENDURANCE",
        "SPEED_POWER",
        "GENERAL_FITNESS",
        "POSTURE_MOBILITY",
        "SPORT_PERFORMANCE",
      ],
      readiness_state: ["GREEN", "YELLOW", "ORANGE_RECOVERY", "RED_STOP"],
    },
  },
} as const

// Mirrors the SQL in supabase/migrations/.
// Regenerate after schema changes with:
//   npx supabase gen types typescript --project-id <project-id> > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          username: string;
          role: Database["public"]["Enums"]["user_role"] | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          full_name: string;
          username: string;
          role?: Database["public"]["Enums"]["user_role"] | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          username?: string;
          role?: Database["public"]["Enums"]["user_role"] | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      shift_availabilities: {
        Row: {
          id: string;
          employee_id: string | null;
          shift_date: string;
          shift_type: Database["public"]["Enums"]["shift_type"];
          is_available: boolean | null;
        };
        Insert: {
          id?: string;
          employee_id?: string | null;
          shift_date: string;
          shift_type: Database["public"]["Enums"]["shift_type"];
          is_available?: boolean | null;
        };
        Update: {
          id?: string;
          employee_id?: string | null;
          shift_date?: string;
          shift_type?: Database["public"]["Enums"]["shift_type"];
          is_available?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "shift_availabilities_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shift_assignments: {
        Row: {
          id: string;
          shift_date: string;
          shift_type: Database["public"]["Enums"]["shift_type"];
          employee_id: string | null;
          created_by: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          shift_date: string;
          shift_type: Database["public"]["Enums"]["shift_type"];
          employee_id?: string | null;
          created_by?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          shift_date?: string;
          shift_type?: Database["public"]["Enums"]["shift_type"];
          employee_id?: string | null;
          created_by?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shift_assignments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_assignments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_availability_open: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: "admin" | "employee";
      shift_type: "morning" | "evening" | "night";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

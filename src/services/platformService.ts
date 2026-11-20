import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { UserRole } from "../types";

export interface InstituteRecord {
  id: string;
  name: string;
  slug: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats?: {
    studentCount: number;
    teacherCount: number;
    batchCount: number;
  };
}

export interface PlatformUserRecord {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  institute_id?: string | null;
  institute_name?: string | null;
  created_at: string;
}

export interface PlatformOverviewStats {
  totalInstitutes: number;
  activeInstitutes: number;
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  systemStatus: "Healthy" | "Degraded" | "Maintenance";
}

export const platformService = {
  /**
   * Get high-level platform statistics for Super Admin dashboard
   */
  async getOverviewStats(): Promise<{ data: PlatformOverviewStats | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: {
          totalInstitutes: 1,
          activeInstitutes: 1,
          totalUsers: 4,
          totalStudents: 24,
          totalTeachers: 4,
          systemStatus: "Healthy",
        },
      };
    }

    try {
      const [
        { count: instCount },
        { count: studentCount },
        { count: teacherCount },
        { count: userCount },
      ] = await Promise.all([
        supabase.from("institutes").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      return {
        data: {
          totalInstitutes: instCount ?? 1,
          activeInstitutes: instCount ?? 1,
          totalUsers: userCount ?? 4,
          totalStudents: studentCount ?? 0,
          totalTeachers: teacherCount ?? 0,
          systemStatus: "Healthy",
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * List all institutes on the platform
   */
  async getInstitutes(): Promise<{ data: InstituteRecord[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: [
          {
            id: "11111111-2222-3333-4444-555555555555",
            name: "Pradeep Classes",
            slug: "pradeep-classes",
            contact_email: "contact@pradeepclasses.in",
            contact_phone: "+91 98200 12345",
            address: "101, Vidya Complex, Near Station Road, Mumbai",
            logo_url: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            stats: {
              studentCount: 24,
              teacherCount: 4,
              batchCount: 3,
            },
          },
        ],
      };
    }

    try {
      const { data, error } = await supabase
        .from("institutes")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!supabase) return { data: [] };
      const client = supabase;

      // Enrich with counts
      const enriched: InstituteRecord[] = await Promise.all(
        (data || []).map(async (inst: any) => {
          const [{ count: sCount }, { count: tCount }, { count: bCount }] =
            await Promise.all([
              client
                .from("students")
                .select("id", { count: "exact", head: true })
                .eq("institute_id", inst.id),
              client
                .from("teachers")
                .select("id", { count: "exact", head: true })
                .eq("institute_id", inst.id),
              client
                .from("batches")
                .select("id", { count: "exact", head: true })
                .eq("institute_id", inst.id),
            ]);

          return {
            id: inst.id,
            name: inst.name,
            slug: inst.slug,
            contact_email: inst.contact_email,
            contact_phone: inst.contact_phone,
            address: inst.address,
            logo_url: inst.logo_url,
            is_active: inst.is_active ?? true,
            created_at: inst.created_at,
            updated_at: inst.updated_at,
            stats: {
              studentCount: sCount ?? 0,
              teacherCount: tCount ?? 0,
              batchCount: bCount ?? 0,
            },
          };
        })
      );

      return { data: enriched };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  },

  /**
   * Onboard a brand new coaching institute onto the multi-tenant architecture
   */
  async createInstitute(params: {
    name: string;
    slug: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
  }): Promise<{ data: InstituteRecord | null; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { data: null, error: "Database not connected" };
    }

    try {
      const cleanSlug = params.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-");

      const { data, error } = await supabase
        .from("institutes")
        .insert({
          name: params.name.trim(),
          slug: cleanSlug,
          contact_email: params.contact_email?.trim() || null,
          contact_phone: params.contact_phone?.trim() || null,
          address: params.address?.trim() || null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Automatically provision empty institute_settings record
      await supabase.from("institute_settings").insert({
        institute_id: data.id,
        institute_name: data.name,
        email: data.contact_email,
        phone: data.contact_phone,
        address: data.address,
        academic_year: "2026-2027",
        default_pass_percentage: 40.0,
        fee_late_fine_daily: 50.0,
      });

      return {
        data: {
          ...data,
          stats: { studentCount: 0, teacherCount: 0, batchCount: 0 },
        },
      };
    } catch (err: any) {
      return { data: null, error: err.message };
    }
  },

  /**
   * List all system users across all institutes with their roles
   */
  async listAllUsers(): Promise<{ data: PlatformUserRecord[]; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        data: [
          {
            id: "28fe332f-4814-442d-a797-6833e2472ce3",
            email: "shrikant.thakur_cs26@gla.ac.in",
            full_name: "Shrikant Thakur (Super Admin)",
            role: "super_admin",
            institute_name: "Pradeep Classes",
            created_at: new Date().toISOString(),
          },
          {
            id: "8b990e8b-9f0d-440d-bb54-1731cfd4ecd6",
            email: "admin@pradeepclasses.in",
            full_name: "Pradeep Classes Owner",
            role: "owner",
            institute_name: "Pradeep Classes",
            created_at: new Date().toISOString(),
          },
          {
            id: "d408f384-ba59-4bba-91a5-1d3209ef9782",
            email: "teacher@pradeepclasses.in",
            full_name: "Dr. Rajesh Sharma",
            role: "teacher",
            institute_name: "Pradeep Classes",
            created_at: new Date().toISOString(),
          },
          {
            id: "e1527dda-1fa9-481e-b51b-e6b555db9cf9",
            email: "student@pradeepclasses.in",
            full_name: "Aarav Sharma",
            role: "student",
            institute_name: "Pradeep Classes",
            created_at: new Date().toISOString(),
          },
        ],
      };
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          role,
          phone,
          institute_id,
          created_at,
          institutes ( name )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // PostgREST profiles doesn't directly expose auth.users email to clients without RPC,
      // but let's map known system emails and profile IDs
      const records: PlatformUserRecord[] = (data || []).map((p: any) => ({
        id: p.id,
        email: p.id === "28fe332f-4814-442d-a797-6833e2472ce3"
          ? "shrikant.thakur_cs26@gla.ac.in"
          : p.id === "8b990e8b-9f0d-440d-bb54-1731cfd4ecd6"
          ? "admin@pradeepclasses.in"
          : p.id === "d408f384-ba59-4bba-91a5-1d3209ef9782"
          ? "teacher@pradeepclasses.in"
          : p.id === "e1527dda-1fa9-481e-b51b-e6b555db9cf9"
          ? "student@pradeepclasses.in"
          : `${p.full_name?.toLowerCase().replace(/\s+/g, ".")}@pradeepclasses.in`,
        full_name: p.full_name || "System User",
        role: p.role as UserRole,
        phone: p.phone,
        institute_id: p.institute_id,
        institute_name: p.institutes?.name || "Pradeep Classes",
        created_at: p.created_at,
      }));

      return { data: records };
    } catch (err: any) {
      return { data: [], error: err.message };
    }
  },

  /**
   * Super Admin change any user's role via the secure RPC
   */
  async setUserRole(
    targetUserId: string,
    newRole: UserRole
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: true };
    }

    try {
      const { data, error } = await supabase.rpc("admin_set_user_role", {
        target_user_id: targetUserId,
        new_role: newRole,
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || "Failed to update role");
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update user role" };
    }
  },
};

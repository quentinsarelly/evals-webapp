import { supabase } from "../supabase";
import { Person } from "../types";

interface PersonRow {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  manager_id: string | null;
  team: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    fullName: row.full_name,
    email: row.email,
    managerId: row.manager_id,
    team: row.team,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Resolves the `people` row for the currently logged-in Supabase auth user.
 *
 * The roster is admin-imported (from directory.csv), never self-registered:
 * if no `people` row matches the auth user's email, this returns null rather
 * than creating one. On first login for a known person, binds `auth_user_id`
 * so future lookups can go straight through the FK instead of by email.
 */
export async function getCurrentPerson(): Promise<Person | null> {
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser?.email) {
    return null;
  }

  const { data: byAuthId } = await supabase
    .from("people")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (byAuthId) {
    return mapPerson(byAuthId);
  }

  const { data: byEmail } = await supabase
    .from("people")
    .select("*")
    .eq("email", authUser.email)
    .maybeSingle();

  if (!byEmail) {
    return null;
  }

  if (!byEmail.auth_user_id) {
    const { data: bound } = await supabase
      .from("people")
      .update({ auth_user_id: authUser.id })
      .eq("id", byEmail.id)
      .select()
      .single();

    if (bound) {
      return mapPerson(bound);
    }
  }

  return mapPerson(byEmail);
}

export async function isCurrentUserAdmin(personId: string): Promise<boolean> {
  const { data } = await supabase
    .from("admin_users")
    .select("person_id")
    .eq("person_id", personId)
    .maybeSingle();

  return !!data;
}

export async function listPeople(): Promise<Person[]> {
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .order("full_name");

  if (error) throw error;
  return (data ?? []).map(mapPerson);
}

export async function upsertPerson(
  person: Partial<Person> & { fullName: string; email: string }
): Promise<Person> {
  const { data, error } = await supabase
    .from("people")
    .upsert(
      {
        id: person.id,
        full_name: person.fullName,
        email: person.email,
        manager_id: person.managerId ?? null,
        team: person.team ?? null,
        active: person.active ?? true,
      },
      { onConflict: "email" }
    )
    .select()
    .single();

  if (error) throw error;
  return mapPerson(data);
}

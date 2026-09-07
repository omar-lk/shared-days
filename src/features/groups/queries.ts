import { supabase } from '../../lib/supabase';

export type Group = {
  id: string;
  name: string;
  currency: string;
  created_at: string;
};

export async function getGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, currency, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

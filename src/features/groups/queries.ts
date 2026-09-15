import { supabase } from '../../lib/supabase';

export type Group = {
  id: string;
  name: string;
  currency: string;
  created_by: string;
  created_at: string;
};

export async function getGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, currency, created_by, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('GET GROUPS ERROR:', error);
    throw error;
  }

  return data ?? [];
}
export async function getGroup(groupId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, currency, created_by, created_at')
    .eq('id', groupId)
    .single();

  if (error) {
    console.error('GET GROUP ERROR:', error);
    throw error;
  }

  return data;
}
export type GroupMember = {
  user_id: string;
  role: 'owner' | 'member';
  profile: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  }[];
};

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(
      `
      user_id,
      role,
      profile:profiles (
        id,
        display_name,
        avatar_url
      )
    `
    )
    .eq('group_id', groupId);

  if (error) {
    console.error('GET GROUP MEMBERS ERROR:', error);
    throw error;
  }

  return data ?? [];
}

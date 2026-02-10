import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, UserPermission } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  role: AppRole | null;
  permissions: UserPermission | null;
  canAccessAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultPermissions: UserPermission = {
  id: '',
  user_id: '',
  can_dashboard: false,
  can_products_view: false,
  can_products_create: false,
  can_products_edit: false,
  can_categories: false,
  can_content: false,
  can_analytics: false,
  can_alerts: false,
  can_users: false,
  created_at: '',
  updated_at: '',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<UserPermission | null>(null);

  const loadRoleAndPermissions = async (userId: string) => {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error checking role:', roleError);
        setIsAdmin(false);
        setRole(null);
        setPermissions(null);
        return;
      }

      const currentRole = roleData?.role ?? null;
      setRole(currentRole);

      if (currentRole === 'admin') {
        setIsAdmin(true);
        setPermissions({
          ...defaultPermissions,
          user_id: userId,
          can_dashboard: true,
          can_products_view: true,
          can_products_create: true,
          can_products_edit: true,
          can_categories: true,
          can_content: true,
          can_analytics: true,
          can_alerts: true,
          can_users: true,
        });
        return;
      }

      setIsAdmin(false);

      if (currentRole === 'miembro') {
        const { data: permData, error: permError } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (permError) {
          console.error('Error loading permissions:', permError);
          setPermissions({ ...defaultPermissions, user_id: userId });
          return;
        }

        setPermissions(permData ?? { ...defaultPermissions, user_id: userId });
        return;
      }

      setPermissions({ ...defaultPermissions, user_id: userId });
    } catch (err) {
      console.error('Error loading role/permissions:', err);
      setIsAdmin(false);
      setRole(null);
      setPermissions(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            loadRoleAndPermissions(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
          setRole(null);
          setPermissions(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadRoleAndPermissions(session.user.id);
      }

      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setRole(null);
    setPermissions(null);
  };

  const canAccessAdmin =
    isAdmin ||
    (permissions
      ? Object.values({
          can_dashboard: permissions.can_dashboard,
          can_products_view: permissions.can_products_view,
          can_products_create: permissions.can_products_create,
          can_products_edit: permissions.can_products_edit,
          can_categories: permissions.can_categories,
          can_content: permissions.can_content,
          can_analytics: permissions.can_analytics,
          can_alerts: permissions.can_alerts,
          can_users: permissions.can_users,
        }).some(Boolean)
      : false);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      isAdmin,
      role,
      permissions,
      canAccessAdmin,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
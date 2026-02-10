import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, UserPermission } from '@/types/database';

type UserRoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
};

const roleOptions: AppRole[] = ['admin', 'miembro'];

const permissionFields: { key: PermissionKey; label: string }[] = [
  { key: 'can_dashboard', label: 'Dashboard' },
  { key: 'can_products_view', label: 'Productos (ver)' },
  { key: 'can_products_create', label: 'Productos (crear)' },
  { key: 'can_products_edit', label: 'Productos (editar)' },
  { key: 'can_categories', label: 'Categorías' },
  { key: 'can_content', label: 'Contenido/Ajustes' },
  { key: 'can_analytics', label: 'Analítica' },
  { key: 'can_alerts', label: 'Alertas' },
  { key: 'can_users', label: 'Usuarios y roles' },
];

type PermissionKey = keyof Pick<
  UserPermission,
  | 'can_dashboard'
  | 'can_products_view'
  | 'can_products_create'
  | 'can_products_edit'
  | 'can_categories'
  | 'can_content'
  | 'can_analytics'
  | 'can_alerts'
  | 'can_users'
>;

const defaultPermissions: Omit<UserPermission, 'id' | 'created_at' | 'updated_at'> = {
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
};

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('miembro');

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserRoleRow[];
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserPermission[];
    },
  });

  const permissionsByUserId = permissions.reduce<Record<string, UserPermission>>((acc, perm) => {
    acc[perm.user_id] = perm;
    return acc;
  }, {});

  const upsertPermissions = async (userId: string, patch: Partial<UserPermission>) => {
    const base = permissionsByUserId[userId] ?? { ...defaultPermissions, user_id: userId };
    const payload = {
      user_id: userId,
      can_dashboard: base.can_dashboard,
      can_products_view: base.can_products_view,
      can_products_create: base.can_products_create,
      can_products_edit: base.can_products_edit,
      can_categories: base.can_categories,
      can_content: base.can_content,
      can_analytics: base.can_analytics,
      can_alerts: base.can_alerts,
      can_users: base.can_users,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_permissions')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) throw error;
  };

  const addRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .insert({ user_id, role })
        .select()
        .single();

      if (error) throw error;

      if (role === 'miembro') {
        await upsertPermissions(user_id, {});
      }

      return data as UserRoleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      setNewUserId('');
      setNewRole('miembro');
      toast({ title: 'Rol añadido', description: 'El usuario ya tiene rol asignado.' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, user_id, role }: { id: string; user_id: string; role: AppRole }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (role === 'miembro') {
        await upsertPermissions(user_id, {});
      }

      return data as UserRoleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      toast({ title: 'Rol actualizado', description: 'Los cambios se guardaron.' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updatePermission = useMutation({
    mutationFn: async ({ user_id, key, value }: { user_id: string; key: PermissionKey; value: boolean }) => {
      await upsertPermissions(user_id, { [key]: value } as Partial<UserPermission>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) {
      toast({ variant: 'destructive', title: 'Falta user_id', description: 'Introduce el ID del usuario.' });
      return;
    }
    addRole.mutate({ user_id: newUserId.trim(), role: newRole });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Usuarios y roles</h1>
          <p className="text-muted-foreground">Gestiona roles y permisos por user_id.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Asignar rol</CardTitle>
            <CardDescription>Añade o cambia el rol de un usuario.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="UUID del usuario"
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={newRole} onValueChange={(value) => setNewRole(value as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={addRole.isPending}>
                  {addRole.isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listado</CardTitle>
            <CardDescription>Usuarios con rol asignado.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : roles.length === 0 ? (
              <p className="text-muted-foreground">No hay usuarios con rol asignado.</p>
            ) : (
              <div className="space-y-4">
                {roles.map((row) => {
                  const currentPerms = permissionsByUserId[row.user_id];

                  return (
                    <div key={row.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="flex-1">
                          <p className="font-medium">{row.user_id}</p>
                          <p className="text-xs text-muted-foreground">ID: {row.id}</p>
                        </div>
                        <div className="w-full md:w-48">
                          <Select
                            value={row.role}
                            onValueChange={(value) => updateRole.mutate({ id: row.id, user_id: row.user_id, role: value as AppRole })}
                            disabled={updateRole.isPending}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {roleOptions.map((role) => (
                                <SelectItem key={role} value={role}>{role}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {row.role === 'miembro' && (
                        <div className="grid gap-3 md:grid-cols-2">
                          {permissionFields.map((field) => (
                            <div key={field.key} className="flex items-center justify-between rounded-md border p-3">
                              <span className="text-sm">{field.label}</span>
                              <Switch
                                checked={Boolean(currentPerms?.[field.key])}
                                onCheckedChange={(checked) => updatePermission.mutate({
                                  user_id: row.user_id,
                                  key: field.key,
                                  value: checked,
                                })}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
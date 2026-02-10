import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types/database';

type UserRoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
};

const roleOptions: AppRole[] = ['admin', 'user'];

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('user');

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

  const addRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .insert({ user_id, role })
        .select()
        .single();

      if (error) throw error;
      return data as UserRoleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      setNewUserId('');
      setNewRole('user');
      toast({ title: 'Rol añadido', description: 'El usuario ya tiene rol asignado.' });
    },
    onError: (error: any) => {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: AppRole }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as UserRoleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast({ title: 'Rol actualizado', description: 'Los cambios se guardaron.' });
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
          <p className="text-muted-foreground">Gestiona roles por user_id.</p>
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
              <div className="space-y-3">
                {roles.map((row) => (
                  <div key={row.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center">
                    <div className="flex-1">
                      <p className="font-medium">{row.user_id}</p>
                      <p className="text-xs text-muted-foreground">ID: {row.id}</p>
                    </div>
                    <div className="w-full md:w-48">
                      <Select
                        value={row.role}
                        onValueChange={(value) => updateRole.mutate({ id: row.id, role: value as AppRole })}
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

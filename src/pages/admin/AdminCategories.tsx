import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/useCategories';
import { Plus, Pencil, Trash2, GripVertical, Loader2, Save, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const EMOJI_OPTIONS = ['??', '??', '??', '??', '??', '??', '??', '?', '??', '??', '??', '??', '??', '??', '??'];

export default function AdminCategories() {
  const { toast } = useToast();
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('??');
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre es requerido' });
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: newName.trim(),
        slug: generateSlug(newName),
        icon: newIcon,
        display_order: (categories?.length || 0) + 1,
      });
      toast({ title: 'Categoría creada' });
      setNewName('');
      setNewIcon('??');
      setIsAdding(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre es requerido' });
      return;
    }

    try {
      await updateCategory.mutateAsync({
        id,
        name: editName.trim(),
        slug: generateSlug(editName),
        icon: editIcon,
      });
      toast({ title: 'Categoría actualizada' });
      setEditingId(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteCategory.mutateAsync(deleteId);
      toast({ title: 'Categoría eliminada' });
      setDeleteId(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const startEditing = (category: { id: string; name: string; icon: string }) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditIcon(category.icon);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Categorías</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona las categorías de productos
            </p>
          </div>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Categoría
            </Button>
          )}
        </div>

        {isAdding && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-lg">Nueva Categoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewIcon(emoji)}
                      className={`w-8 h-8 rounded text-lg hover:bg-secondary ${
                        newIcon === emoji ? 'bg-primary text-primary-foreground' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex-1 space-y-3">
                  <Input
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    placeholder="Emoji (puedes pegar cualquiera)"
                  />
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre de la categoría (puedes incluir emojis)"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={createCategory.isPending}>
                      {createCategory.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Guardar
                    </Button>
                    <Button variant="outline" onClick={() => setIsAdding(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : categories?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No hay categorías. ¡Crea la primera!
              </div>
            ) : (
              <div className="divide-y">
                {categories?.map((category) => (
                  <div key={category.id} className="flex items-center gap-3 p-4 hover:bg-muted/50">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                    {editingId === category.id ? (
                      <>
                        <div className="flex flex-wrap gap-1 max-w-[120px]">
                          {EMOJI_OPTIONS.slice(0, 6).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => setEditIcon(emoji)}
                              className={`w-6 h-6 rounded text-sm hover:bg-secondary ${
                                editIcon === emoji ? 'bg-primary text-primary-foreground' : ''
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                        <Input
                          value={editIcon}
                          onChange={(e) => setEditIcon(e.target.value)}
                          className="w-20"
                        />
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdate(category.id)}
                        />
                        <Button size="sm" onClick={() => handleUpdate(category.id)} disabled={updateCategory.isPending}>
                          {updateCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">{category.icon}</span>
                        <span className="flex-1 font-medium">{category.name}</span>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                          {category.slug}
                        </span>
                        <Button size="icon" variant="ghost" onClick={() => startEditing(category)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(category.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los productos de esta categoría quedarán sin categoría asignada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

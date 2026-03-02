import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Building2, MapPin, Phone, FileText, Star } from 'lucide-react';
import { useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch, Branch } from '@/hooks/useBranches';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function BranchesPage() {
  const { t } = useTranslation();
  const { data: branches = [], isLoading } = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deleteBranch = useDeleteBranch();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', phone: '', note: '' });

  const resetForm = () => { setFormData({ name: '', address: '', phone: '', note: '' }); setEditingBranch(null); };
  const handleOpenDialog = (branch?: Branch) => {
    if (branch) { setEditingBranch(branch); setFormData({ name: branch.name, address: branch.address || '', phone: branch.phone || '', note: branch.note || '' }); }
    else { resetForm(); }
    setIsDialogOpen(true);
  };
  const handleCloseDialog = () => { setIsDialogOpen(false); resetForm(); };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { toast.error(t('pages.branches.nameRequired')); return; }
    try {
      if (editingBranch) {
        await updateBranch.mutateAsync({ id: editingBranch.id, name: formData.name.trim(), address: formData.address.trim() || null, phone: formData.phone.trim() || null, note: formData.note.trim() || null });
        toast.success(t('pages.branches.updateSuccess'));
      } else {
        await createBranch.mutateAsync({ name: formData.name.trim(), address: formData.address.trim() || undefined, phone: formData.phone.trim() || undefined, note: formData.note.trim() || undefined });
        toast.success(t('pages.branches.createSuccess'));
      }
      handleCloseDialog();
    } catch (error) { toast.error(t('pages.branches.errorGeneric')); }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    const branch = branches.find((b) => b.id === deleteConfirmId);
    if (branch?.is_default) { toast.error(t('pages.branches.cannotDeleteDefault')); setDeleteConfirmId(null); return; }
    try {
      await deleteBranch.mutateAsync(deleteConfirmId);
      toast.success(t('pages.branches.deleteSuccess'));
    } catch (error) {
      const message = String((error as any)?.message || '');
      if (message.includes('CANNOT_DELETE_DEFAULT_BRANCH')) toast.error(t('pages.branches.cannotDeleteDefault'));
      else if (message.includes('BRANCH_IN_USE')) toast.error(t('pages.branches.branchInUse'));
      else if (message.includes('FORBIDDEN')) toast.error(t('pages.branches.forbidden'));
      else toast.error(t('pages.branches.errorGeneric'));
    }
    setDeleteConfirmId(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader title={t('pages.branches.title')} description={t('pages.branches.description')} helpText={t('pages.branches.helpText')} />
        <div className="flex justify-end">
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />{t('pages.branches.addBranch')}
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pages.branches.branchName')}</TableHead>
                <TableHead>{t('pages.branches.address')}</TableHead>
                <TableHead>{t('pages.branches.phone')}</TableHead>
                <TableHead>{t('pages.branches.note')}</TableHead>
                <TableHead>{t('pages.branches.createdAt')}</TableHead>
                <TableHead className="text-right">{t('pages.branches.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('pages.branches.loading')}</TableCell></TableRow>
              ) : branches.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('pages.branches.noBranches')}</TableCell></TableRow>
              ) : (
                branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{branch.name}</span>
                        {branch.is_default && (<Badge variant="secondary" className="gap-1"><Star className="h-3 w-3" />{t('pages.branches.default')}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>{branch.address ? (<div className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{branch.address}</div>) : <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell>{branch.phone ? (<div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{branch.phone}</div>) : <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell>{branch.note ? (<div className="flex items-center gap-1 text-muted-foreground max-w-xs truncate"><FileText className="h-3 w-3 flex-shrink-0" /><span className="truncate">{branch.note}</span></div>) : <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(branch.created_at), 'dd/MM/yyyy', { locale: vi })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(branch)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(branch.id)} disabled={branch.is_default}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingBranch ? t('pages.branches.editBranch') : t('pages.branches.addNewBranch')}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('pages.branches.branchName')} <span className="text-destructive">*</span></Label>
                <Input id="name" placeholder={t('pages.branches.enterBranchName')} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t('pages.branches.address')}</Label>
                <Input id="address" placeholder={t('pages.branches.enterAddress')} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t('pages.branches.phone')}</Label>
                <Input id="phone" placeholder={t('pages.branches.enterPhone')} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">{t('pages.branches.note')}</Label>
                <Textarea id="note" placeholder={t('pages.branches.enterNote')} value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>{t('pages.branches.cancel')}</Button>
              <Button onClick={handleSubmit} disabled={createBranch.isPending || updateBranch.isPending}>{editingBranch ? t('pages.branches.update') : t('pages.branches.addNew')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('pages.branches.confirmDeleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('pages.branches.confirmDeleteDesc')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('pages.branches.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('pages.branches.deleteBtn')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}

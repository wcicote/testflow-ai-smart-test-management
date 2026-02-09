import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug as BugIcon, ExternalLink, AlertCircle, MoreHorizontal, Trash2, ImageIcon } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bug } from '@/types';
import { BugStatusSelect } from '@/components/bugs/BugStatusSelect';
import { BugEvidenceModal } from '@/components/bugs/BugEvidenceModal';

export default function Bugs() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Bug | null>(null);
  const [syncTarget, setSyncTarget] = useState<Bug | null>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<Bug | null>(null);
  const { toast } = useToast();

  const fetchBugs = async () => {
    try {
      const { data, error } = await supabase
        .from('test_executions')
        .select(`
          id, bug_description, status, bug_status, created_at, test_case_id,
          test_cases!inner ( id, title, priority, project_id, projects!inner ( id, name ) )
        `)
        .eq('status', 'failed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBugs: Bug[] = (data || []).map((item: any) => ({
        id: item.id,
        bug_description: item.bug_description || 'Sem descrição',
        status: item.status,
        bug_status: item.bug_status || 'open',
        created_at: item.created_at,
        test_case_id: item.test_cases.id,
        test_case_title: item.test_cases.title,
        project_id: item.test_cases.projects.id,
        project_name: item.test_cases.projects.name,
        priority: item.test_cases.priority,
      }));

      setBugs(formattedBugs);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar bugs', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBugs(); }, []);

  const handleStatusChange = async (bug: Bug, newStatus: string) => {
    const { error } = await supabase
      .from('test_executions')
      .update({ bug_status: newStatus })
      .eq('id', bug.id);

    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return;
    }

    if (newStatus === 'resolved') {
      setSyncTarget(bug);
    }

    setBugs(prev => prev.map(b => b.id === bug.id ? { ...b, bug_status: newStatus as Bug['bug_status'] } : b));
    toast({ title: 'Status atualizado!' });
  };

  const handleSyncTestCase = async () => {
    if (!syncTarget) return;
    const { error } = await supabase
      .from('test_cases')
      .update({ status: 'ready' })
      .eq('id', syncTarget.test_case_id);

    if (error) {
      toast({ title: 'Erro ao sincronizar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Caso de teste atualizado para "Pronto" para reteste!' });
    }
    setSyncTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('test_executions').delete().eq('id', deleteTarget.id);

    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      setBugs(prev => prev.filter(b => b.id !== deleteTarget.id));
      toast({ title: 'Bug excluído com sucesso!' });
    }
    setDeleteTarget(null);
  };

  const getSeverityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-destructive text-destructive-foreground"><AlertCircle className="w-3 h-3 mr-1" />Alta</Badge>;
      case 'medium':
        return <Badge className="bg-warning text-warning-foreground">Média</Badge>;
      default:
        return <Badge variant="secondary">Baixa</Badge>;
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bugs</h1>
          <p className="text-muted-foreground mt-1">Todos os bugs registrados nas execuções de teste</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BugIcon className="w-5 h-5 text-destructive" />
              Lista de Bugs ({bugs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bugs.length === 0 ? (
              <div className="text-center py-12">
                <BugIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">Nenhum bug encontrado</h3>
                <p className="text-muted-foreground mt-1">Excelente! Não há bugs registrados no sistema.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Descrição do Bug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Caso de Teste</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-[150px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bugs.map((bug) => (
                      <TableRow key={bug.id}>
                        <TableCell>{getSeverityBadge(bug.priority)}</TableCell>
                        <TableCell className="max-w-xs">
                          <p className="truncate font-medium" title={bug.bug_description}>{bug.bug_description}</p>
                        </TableCell>
                        <TableCell>
                          <BugStatusSelect
                            value={bug.bug_status}
                            onValueChange={(v) => handleStatusChange(bug, v)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{bug.test_case_title}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{bug.project_name}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(bug.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link to={`/projects/${bug.project_id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4 mr-1" />
                                Ver Teste
                              </Button>
                            </Link>
                            <Button variant="ghost" size="sm" onClick={() => setEvidenceTarget(bug)}>
                              <ImageIcon className="w-4 h-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget(bug)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir Bug
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Bug</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este bug? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sync Confirmation */}
      <Dialog open={!!syncTarget} onOpenChange={(open) => !open && setSyncTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Caso de Teste?</DialogTitle>
            <DialogDescription>
              O bug foi marcado como resolvido. Deseja atualizar o caso de teste "{syncTarget?.test_case_title}" para "Pronto" para reteste?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncTarget(null)}>Não</Button>
            <Button onClick={handleSyncTestCase}>Sim, atualizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evidence Modal */}
      {evidenceTarget && (
        <BugEvidenceModal
          open={!!evidenceTarget}
          onOpenChange={(open) => !open && setEvidenceTarget(null)}
          executionId={evidenceTarget.id}
          bugDescription={evidenceTarget.bug_description}
        />
      )}
    </AppLayout>
  );
}

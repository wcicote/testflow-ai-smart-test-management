import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug as BugIcon, ExternalLink, AlertCircle, MoreHorizontal, Trash2, ImageIcon, X, VideoIcon, Eye } from 'lucide-react';
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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bug, BugEvidence } from '@/types';
import { BugStatusSelect } from '@/components/bugs/BugStatusSelect';

export default function Bugs() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Bug | null>(null);
  const [syncTarget, setSyncTarget] = useState<Bug | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<'image' | 'video'>('image');
  const [detailTarget, setDetailTarget] = useState<Bug | null>(null);
  const { toast } = useToast();

  const fetchBugs = async () => {
    try {
      const { data, error } = await supabase
        .from('test_executions')
        .select(`
          id, bug_description, status, bug_status, created_at, test_case_id,
          test_cases!inner ( id, title, priority, steps, project_id, projects!inner ( id, name ) )
        `)
        .eq('status', 'failed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const executionIds = (data || []).map((item: any) => item.id);

      // Fetch all evidences for these executions in one query
      let evidencesMap: Record<string, BugEvidence[]> = {};
      if (executionIds.length > 0) {
        const { data: evData } = await supabase
          .from('bug_evidences')
          .select('*')
          .in('test_execution_id', executionIds);

        if (evData) {
          for (const ev of evData as BugEvidence[]) {
            if (!evidencesMap[ev.test_execution_id]) evidencesMap[ev.test_execution_id] = [];
            evidencesMap[ev.test_execution_id].push(ev);
          }
        }
      }

      const formattedBugs: Bug[] = (data || []).map((item: any) => ({
        id: item.id,
        bug_description: item.bug_description || 'Sem descrição',
        status: item.status,
        bug_status: item.bug_status || 'open',
        created_at: item.created_at,
        test_case_id: item.test_cases.id,
        test_case_title: item.test_cases.title,
        test_case_steps: item.test_cases.steps || null,
        project_id: item.test_cases.projects.id,
        project_name: item.test_cases.projects.name,
        priority: item.test_cases.priority,
        evidences: evidencesMap[item.id] || [],
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

  const openLightbox = (url: string, type: 'image' | 'video') => {
    setLightboxUrl(url);
    setLightboxType(type);
  };

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
                      <TableHead>Evidência</TableHead>
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
                          {bug.evidences && bug.evidences.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {bug.evidences.slice(0, 2).map((ev) => (
                                <button
                                  key={ev.id}
                                  className="w-10 h-10 rounded border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer flex-shrink-0"
                                  onClick={() => openLightbox(ev.file_url, ev.file_type)}
                                >
                                  {ev.file_type === 'image' ? (
                                    <img src={ev.file_url} alt={ev.file_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-muted flex items-center justify-center">
                                      <VideoIcon className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </button>
                              ))}
                              {bug.evidences.length > 2 && (
                                <span className="text-xs text-muted-foreground">+{bug.evidences.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
                            <Button variant="ghost" size="sm" onClick={() => setDetailTarget(bug)}>
                              <Eye className="w-4 h-4 mr-1" />
                              Detalhes
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/projects/${bug.project_id}`}>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Ver Teste
                                  </Link>
                                </DropdownMenuItem>
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

      {/* Lightbox Modal */}
      <Dialog open={!!lightboxUrl} onOpenChange={(open) => !open && setLightboxUrl(null)}>
        <DialogContent className="max-w-4xl p-2 bg-background/95 backdrop-blur">
          <button
            className="absolute top-3 right-3 z-10 rounded-full bg-background/80 p-1.5 hover:bg-background transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
          {lightboxUrl && lightboxType === 'image' ? (
            <img src={lightboxUrl} alt="Evidência" className="w-full max-h-[80vh] object-contain rounded" />
          ) : lightboxUrl ? (
            <video src={lightboxUrl} controls autoPlay className="w-full max-h-[80vh] rounded" />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Bug Details Drawer */}
      <Sheet open={!!detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailTarget && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">Detalhes do Bug</SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  {getSeverityBadge(detailTarget.priority)}
                  <BugStatusSelect
                    value={detailTarget.bug_status}
                    onValueChange={(v) => handleStatusChange(detailTarget, v)}
                  />
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BugIcon className="w-4 h-4 text-destructive" />
                    Descrição do Erro
                  </h4>
                  <div className="p-4 rounded-lg bg-secondary">
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{detailTarget.bug_description}</p>
                  </div>
                </div>

                <Separator />

                {/* Steps to reproduce */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Passos para Reproduzir</h4>
                  <div className="p-4 rounded-lg bg-secondary">
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {detailTarget.test_case_steps || 'Nenhum passo registrado para este caso de teste.'}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Caso de Teste:</span>
                    <p className="font-medium">{detailTarget.test_case_title}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Projeto:</span>
                    <p className="font-medium">{detailTarget.project_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data:</span>
                    <p className="font-medium">{formatDate(detailTarget.created_at)}</p>
                  </div>
                </div>

                <Separator />

                {/* Evidences */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    Evidências ({detailTarget.evidences?.length || 0})
                  </h4>
                  {detailTarget.evidences && detailTarget.evidences.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {detailTarget.evidences.map((ev) => (
                        <div key={ev.id} className="border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all" onClick={() => openLightbox(ev.file_url, ev.file_type)}>
                          {ev.file_type === 'image' ? (
                            <img src={ev.file_url} alt={ev.file_name} className="w-full max-h-64 object-contain bg-muted" />
                          ) : (
                            <video src={ev.file_url} controls className="w-full max-h-64" />
                          )}
                          <p className="text-xs px-2 py-1 text-muted-foreground truncate">{ev.file_name}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">Nenhuma evidência anexada.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

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
    </AppLayout>
  );
}

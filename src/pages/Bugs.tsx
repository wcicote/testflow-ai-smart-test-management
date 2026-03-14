import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug as BugIcon, ExternalLink, AlertCircle, MoreHorizontal, Trash2, ImageIcon, X, VideoIcon, Eye, Sparkles, Filter, Flame, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bug, BugEvidence } from '@/types';
import { BugStatusSelect } from '@/components/bugs/BugStatusSelect';
import { callGeminiWithCache } from '@/lib/aiCache';

export default function Bugs() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Bug | null>(null);
  const [syncTarget, setSyncTarget] = useState<Bug | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<'image' | 'video'>('image');
  const [detailTarget, setDetailTarget] = useState<Bug | null>(null);
  const [linkedBugCounts, setLinkedBugCounts] = useState<{ total: number; open: number } | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [failureCounts, setFailureCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<'all' | 'urgent' | 'mine'>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBugs = async () => {
    try {
      const { data, error } = await supabase
        .from('test_executions')
        .select(`
          id, execution_number, bug_description, status, bug_status, created_at, test_case_id, executed_by,
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
        execution_number: item.execution_number,
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
        executed_by: item.executed_by,
      }));

      // Compute failure counts per test_case_id
      const counts: Record<string, number> = {};
      for (const b of formattedBugs) {
        counts[b.test_case_id] = (counts[b.test_case_id] || 0) + 1;
      }
      setFailureCounts(counts);

      setBugs(formattedBugs);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar bugs', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (bug: Bug) => {
    setDetailTarget(bug);
    setLinkedBugCounts(null);
    setAiSuggestion(null);
    const { count: totalCount } = await supabase
      .from('test_executions')
      .select('*', { count: 'exact', head: true })
      .eq('test_case_id', bug.test_case_id)
      .eq('status', 'failed');
    const { count: openCount } = await supabase
      .from('test_executions')
      .select('*', { count: 'exact', head: true })
      .eq('test_case_id', bug.test_case_id)
      .eq('status', 'failed')
      .neq('bug_status', 'resolved');
    setLinkedBugCounts({ total: totalCount || 0, open: openCount || 0 });
  };

  useEffect(() => {
    fetchBugs();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  const handleSuggestRootCause = async (bug: Bug) => {
    setAiLoading(true);
    setAiSuggestion(null);

    try {
      console.log('Starting AI analysis for bug:', bug.id);
      const prompt = `Você é um engenheiro de QA sênior. Analise o bug abaixo e forneça:
1. **Causa Raiz Provável**: Uma explicação técnica concisa do que provavelmente causou o erro.
2. **Sugestão de Correção**: Passos práticos que o desenvolvedor pode seguir para corrigir.

**Título do Caso de Teste:** ${bug.test_case_title}
**Descrição do Bug:** ${bug.bug_description}
**Passos para Reproduzir:** ${bug.test_case_steps || 'Não informado'}

Responda em português brasileiro, de forma técnica mas clara.`;

      const content = await callGeminiWithCache<string>(
        'root_cause_analysis',
        `${bug.id}:${bug.bug_description}`,
        prompt,
        { jsonMode: false }
      );

      setAiSuggestion(content || "Não foi possível gerar uma análise.");
    } catch (e: any) {
      console.error('AI Analysis error:', e);
      toast({
        title: 'Erro na análise de IA',
        description: e.message,
        variant: 'destructive'
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleStatusChange = async (bug: Bug, newStatus: string) => {
    const { error } = await supabase
      .from('test_executions')
      .update({ bug_status: newStatus })
      .eq('id', bug.id);

    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      return;
    }

    setBugs(prev => prev.map(b => b.id === bug.id ? { ...b, bug_status: newStatus as Bug['bug_status'] } : b));

    if (newStatus === 'resolved') {
      // Check if there are other unresolved bugs for the same test case
      const { count, error: countError } = await supabase
        .from('test_executions')
        .select('*', { count: 'exact', head: true })
        .eq('test_case_id', bug.test_case_id)
        .eq('status', 'failed')
        .neq('bug_status', 'resolved')
        .neq('id', bug.id);

      if (countError) {
        toast({ title: 'Status atualizado!' });
        return;
      }

      const remainingOpen = count || 0;

      if (remainingOpen > 0) {
        toast({
          title: 'Bug resolvido',
          description: `O teste continua com status "Falhou" pois ainda existem ${remainingOpen} bug(s) aberto(s).`,
        });
      } else {
        setSyncTarget(bug);
      }
    } else {
      toast({ title: 'Status atualizado!' });
    }
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <BugIcon className="w-5 h-5 text-destructive" />
                Lista de Bugs ({bugs.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  Todos
                </Button>
                <Button
                  variant={filter === 'mine' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('mine')}
                >
                  <User className="w-3.5 h-3.5 mr-1" />
                  Meus Bugs
                </Button>
                <Button
                  variant={filter === 'urgent' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('urgent')}
                >
                  <Flame className="w-3.5 h-3.5 mr-1" />
                  Urgentes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const filteredBugs = bugs.filter(bug => {
                if (filter === 'urgent') return bug.priority === 'high';
                if (filter === 'mine') return bug.executed_by === currentUserId;
                return true;
              });

              const getRowSeverityClass = (priority: string) => {
                switch (priority) {
                  case 'high': return 'bg-destructive/5 hover:bg-destructive/10';
                  case 'medium': return 'bg-warning/5 hover:bg-warning/10';
                  default: return '';
                }
              };

              return filteredBugs.length === 0 ? (
                <div className="text-center py-12">
                  <BugIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Nenhum bug encontrado</h3>
                  <p className="text-muted-foreground mt-1">
                    {filter !== 'all' ? 'Nenhum bug corresponde ao filtro selecionado.' : 'Excelente! Não há bugs registrados no sistema.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead>Severidade</TableHead>
                        <TableHead>Descrição do Bug</TableHead>

                        <TableHead>Status</TableHead>
                        <TableHead>Recorrência</TableHead>
                        <TableHead>Evidência</TableHead>
                        <TableHead>Caso de Teste</TableHead>
                        <TableHead>Projeto</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="w-[150px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBugs.map((bug) => (
                        <TableRow key={bug.id} className={getRowSeverityClass(bug.priority)}>
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            BUG-{bug.execution_number || bug.id.slice(0, 4).toUpperCase()}
                          </TableCell>
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
                            {(failureCounts[bug.test_case_id] || 1) > 1 ? (
                              <Badge variant="outline" className="border-destructive/50 text-destructive">
                                {failureCounts[bug.test_case_id]}ª falha registrada
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">1ª ocorrência</span>
                            )}
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
                              <Button variant="ghost" size="sm" onClick={() => openDetail(bug)}>
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
              );
            })()}
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
                {/* Linked bugs counter */}
                {linkedBugCounts && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
                    <BugIcon className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-foreground">
                      Este teste possui <strong>{linkedBugCounts.total}</strong> bug(s) vinculado(s) (<strong>{linkedBugCounts.open}</strong> aberto(s))
                    </span>
                  </div>
                )}
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

                {/* AI Root Cause Suggestion */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
                    onClick={() => handleSuggestRootCause(detailTarget)}
                    disabled={aiLoading}
                  >
                    <Sparkles className="w-4 h-4" />
                    {aiLoading ? 'Analisando...' : 'Sugerir Causa Raiz (IA)'}
                  </Button>

                  {aiLoading && (
                    <div className="space-y-2 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  )}

                  {aiSuggestion && !aiLoading && (
                    <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                        <ReactMarkdown>{aiSuggestion}</ReactMarkdown>
                      </div>
                    </div>
                  )}
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

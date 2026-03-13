import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestRun } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TestRunDialog } from './TestRunDialog';

interface TestRunsListProps {
    projectId: string;
}

export function TestRunsList({ projectId }: TestRunsListProps) {
    const [runs, setRuns] = useState<TestRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
    const [selectedRunForResume, setSelectedRunForResume] = useState<TestRun | null>(null);
    const { toast } = useToast();

    const fetchRuns = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('test_runs')
            .select(`
      *,
      test_suites ( name )
    `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            toast({
                title: 'Erro ao carregar execuções',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            setRuns((data as unknown as TestRun[]) || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRuns();
    }, [projectId]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'passed':
                return <Badge className="bg-success hover:bg-success/90">Aprovado</Badge>;
            case 'failed':
                return <Badge variant="destructive">Reprovado</Badge>;
            case 'paused':
                return <Badge variant="outline" className="border-amber-500 text-amber-500">Pausado</Badge>;
            case 'running':
                return <Badge variant="outline" className="border-blue-500 text-blue-500">Em Andamento</Badge>;
            case 'completed':
            default:
                return <Badge variant="secondary">Concluído</Badge>;
        }
    };

    if (loading) {
        return <div className="text-center py-6">Carregando execuções...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="bg-card p-4 rounded-lg border">
                <h3 className="text-lg font-semibold">Histórico de Execuções</h3>
                <p className="text-sm text-muted-foreground">Visualize o histórico completo de execuções de testes do projeto</p>
            </div>

            {runs.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-lg border">
                    <p className="text-muted-foreground text-sm">Nenhuma execução registrada.</p>
                </div>
            ) : (
                <div className="bg-card rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">ID</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Suíte</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Data</TableHead>
                                <TableHead className="w-[100px]">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {runs.map((run: any) => (
                                <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50">
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        RUN-{run.run_number}
                                    </TableCell>
                                    <TableCell className="font-medium">{run.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {run.test_suites?.name || '-'}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(run.status)}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {format(new Date(run.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                    </TableCell>
                                    <TableCell>
                                        {run.status === 'paused' && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-8 border-primary/50 text-primary hover:bg-primary/10"
                                                onClick={() => {
                                                    setSelectedRunForResume(run);
                                                    setResumeDialogOpen(true);
                                                }}
                                            >
                                                <PlayCircle className="w-4 h-4 mr-2" />
                                                Continuar
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {selectedRunForResume && (
                <TestRunDialog
                    open={resumeDialogOpen}
                    onOpenChange={setResumeDialogOpen}
                    projectId={projectId}
                    suiteId={selectedRunForResume.suite_id}
                    suiteName={selectedRunForResume.test_suites?.name || ''}
                    testRunId={selectedRunForResume.id}
                    onSuccess={() => fetchRuns()}
                />
            )}
        </div>
    );
}

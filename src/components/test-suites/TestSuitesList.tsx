import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestSuite } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, PlayCircle, MoreHorizontal, Edit2, Trash2, Sparkles } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TestSuiteDialog } from './TestSuiteDialog';
import { TestRunDialog } from '../test-runs/TestRunDialog';
import { AISuiteGeneratorDialog } from '../ai/AISuiteGeneratorDialog';

interface TestSuitesListProps {
    projectId: string;
    onSuccess?: () => void;
}

export function TestSuitesList({ projectId, onSuccess }: TestSuitesListProps) {
    const [suites, setSuites] = useState<TestSuite[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
    const [runDialogOpen, setRunDialogOpen] = useState(false);
    const [selectedSuiteForRun, setSelectedSuiteForRun] = useState<TestSuite | null>(null);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const { toast } = useToast();

    const fetchSuites = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('test_suites')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            toast({
                title: 'Erro ao carregar suítes',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            setSuites(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSuites();
    }, [projectId]);

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('test_suites').delete().eq('id', id);
        if (error) {
            toast({
                title: 'Erro ao excluir suíte',
                description: error.message,
                variant: 'destructive',
            });
        } else {
            toast({ title: 'Suíte de teste excluída' });
            fetchSuites();
        }
    };

    const handleEdit = (suite: TestSuite) => {
        setEditingSuite(suite);
        setDialogOpen(true);
    };

    const openNewSuite = () => {
        setEditingSuite(null);
        setDialogOpen(true);
    };

    const handleExecute = (suite: TestSuite) => {
        setSelectedSuiteForRun(suite);
        setRunDialogOpen(true);
    };

    if (loading) {
        return <div className="text-center py-6">Carregando suítes...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
                <div>
                    <h3 className="text-lg font-semibold">Suítes de Teste</h3>
                    <p className="text-sm text-muted-foreground">Gerencie grupos lógicos de casos de teste</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setAiDialogOpen(true)} className="gap-2 border-purple-500/30 text-purple-300 hover:bg-purple-500/10">
                        <Sparkles className="w-4 h-4" />
                        Gerar com IA
                    </Button>
                    <Button onClick={openNewSuite}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Suíte
                    </Button>
                </div>
            </div>

            {suites.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-lg border">
                    <p className="text-muted-foreground text-sm">Nenhuma suíte encontrada no projeto.</p>
                </div>
            ) : (
                <div className="bg-card rounded-lg border overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">ID</TableHead>
                                <TableHead>Nome da Suíte</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="w-[100px]">Data</TableHead>
                                <TableHead className="w-[100px]">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {suites.map((suite) => (
                                <TableRow key={suite.id}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                        S-{suite.suite_number}
                                    </TableCell>
                                    <TableCell className="font-medium">{suite.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{suite.description || '-'}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {new Date(suite.created_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleExecute(suite)}>
                                                    <PlayCircle className="w-4 h-4 mr-2" />
                                                    Executar Suíte
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleEdit(suite)}>
                                                    <Edit2 className="w-4 h-4 mr-2" />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(suite.id)}
                                                    className="text-destructive"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <TestSuiteDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                projectId={projectId}
                testSuite={editingSuite}
                onSuccess={() => {
                    fetchSuites();
                    if (onSuccess) onSuccess();
                }}
            />

            {selectedSuiteForRun && (
                <TestRunDialog
                    open={runDialogOpen}
                    onOpenChange={setRunDialogOpen}
                    projectId={projectId}
                    suiteId={selectedSuiteForRun.id}
                    suiteName={selectedSuiteForRun.name}
                    onSuccess={() => {
                        if (onSuccess) onSuccess();
                    }}
                />
            )}

            <AISuiteGeneratorDialog
                open={aiDialogOpen}
                onOpenChange={setAiDialogOpen}
                projectId={projectId}
                onSuccess={() => {
                    fetchSuites();
                    if (onSuccess) onSuccess();
                }}
            />
        </div>
    );
}

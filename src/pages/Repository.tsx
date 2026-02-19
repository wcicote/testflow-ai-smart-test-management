import { useEffect, useState } from 'react';
import {
    FolderTree,
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Edit2,
    Trash2,
    ChevronRight,
    FolderOpen,
    TestTube2,
    Settings2
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Project, TestSuite, TestCase } from '@/types';
import { cn } from '@/lib/utils';
import { TestCaseDialog } from '@/components/test-cases/TestCaseDialog';


export default function Repository() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [suites, setSuites] = useState<TestSuite[]>([]);
    const [selectedSuite, setSelectedSuite] = useState<string | 'all'>('all');
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog states
    const [suiteDialogOpen, setSuiteDialogOpen] = useState(false);
    const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
    const [suiteName, setSuiteName] = useState('');
    const [suiteDescription, setSuiteDescription] = useState('');

    const [testCaseDialogOpen, setTestCaseDialogOpen] = useState(false);
    const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);


    const { toast } = useToast();

    const fetchData = async () => {
        setLoading(true);
        // Fetch projects
        const { data: projectsData } = await supabase
            .from('projects')
            .select('*')
            .order('name');

        setProjects(projectsData || []);

        if (projectsData && projectsData.length > 0 && !selectedProject) {
            setSelectedProject(projectsData[0].id);
        }

        setLoading(false);
    };

    const fetchSuitesAndTests = async () => {
        if (!selectedProject) return;

        // Fetch suites
        const { data: suitesData } = await supabase
            .from('test_suites')
            .select('*')
            .eq('project_id', selectedProject)
            .order('name');

        setSuites((suitesData as any) || []);

        // Fetch test cases
        let query = supabase
            .from('test_cases')
            .select('*')
            .eq('project_id', selectedProject);

        if (selectedSuite === 'none') {
            query = query.is('suite_id', null);
        } else if (selectedSuite !== 'all') {
            query = query.eq('suite_id', selectedSuite);
        }


        const { data: testsData } = await query.order('created_at', { ascending: false });
        setTestCases((testsData as any) || []);
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (selectedProject) {
            fetchSuitesAndTests();
        }
    }, [selectedProject, selectedSuite]);

    const handleCreateSuite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!suiteName.trim() || !selectedProject) return;

        if (editingSuite) {
            const { error } = await supabase
                .from('test_suites')
                .update({
                    name: suiteName,
                    description: suiteDescription,
                })
                .eq('id', editingSuite.id);

            if (error) {
                toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
            } else {
                toast({ title: 'Suíte atualizada!' });
                setSuiteDialogOpen(false);
                fetchSuitesAndTests();
            }
        } else {
            const { error } = await supabase
                .from('test_suites')
                .insert({
                    name: suiteName,
                    description: suiteDescription,
                    project_id: selectedProject
                });

            if (error) {
                toast({ title: 'Erro ao criar suíte', description: error.message, variant: 'destructive' });
            } else {
                toast({ title: 'Suíte criada com sucesso!' });
                setSuiteDialogOpen(false);
                setSuiteName('');
                setSuiteDescription('');
                fetchSuitesAndTests();
            }
        }
    };

    const handleDeleteSuite = async (id: string) => {
        const { error } = await supabase.from('test_suites').delete().eq('id', id);
        if (error) {
            toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Suíte excluída' });
            if (selectedSuite === id) setSelectedSuite('all');
            fetchSuitesAndTests();
        }
    };

    const openEditSuite = (suite: TestSuite) => {
        setEditingSuite(suite);
        setSuiteName(suite.name);
        setSuiteDescription(suite.description || '');
        setSuiteDialogOpen(true);
    };

    const handleDeleteTestCase = async (id: string) => {
        const { error } = await supabase.from('test_cases').delete().eq('id', id);
        if (error) {
            toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Caso de teste excluído' });
            fetchSuitesAndTests();
        }
    };

    const openEditTestCase = (tc: TestCase) => {
        setEditingTestCase(tc);
        setTestCaseDialogOpen(true);
    };

    const openNewTestCase = () => {
        setEditingTestCase(null);
        setTestCaseDialogOpen(true);
    };


    const filteredTests = testCases.filter(tc =>
        tc.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="flex flex-col h-[calc(100vh-8rem)]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-foreground">Repositório</h1>
                        <div className="w-64">
                            <Select value={selectedProject} onValueChange={setSelectedProject}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um projeto" />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Dialog open={suiteDialogOpen} onOpenChange={(open) => {
                            setSuiteDialogOpen(open);
                            if (!open) setEditingSuite(null);
                        }}>
                            <DialogTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    onClick={(e) => {
                                        if (!selectedProject) {
                                            e.preventDefault();
                                            toast({
                                                title: 'Projeto não selecionado',
                                                description: 'Por favor, selecione um projeto antes de criar uma suíte.',
                                                variant: 'destructive'
                                            });
                                        }
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Nova Suíte
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <form onSubmit={handleCreateSuite}>
                                    <DialogHeader>
                                        <DialogTitle>{editingSuite ? 'Editar Suíte' : 'Nova Suíte de Testes'}</DialogTitle>
                                        <DialogDescription>
                                            {editingSuite ? 'Atualize as informações da suíte' : 'Agrupe seus casos de teste por módulos ou funcionalidades.'}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="suiteName">Nome da Suíte</Label>
                                            <Input
                                                id="suiteName"
                                                value={suiteName}
                                                onChange={(e) => setSuiteName(e.target.value)}
                                                placeholder="Ex: Autenticação, Checkout..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="suiteDesc">Descrição (opcional)</Label>
                                            <Textarea
                                                id="suiteDesc"
                                                value={suiteDescription}
                                                onChange={(e) => setSuiteDescription(e.target.value)}
                                                placeholder="Descreva o propósito desta suíte"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit">{editingSuite ? 'Salvar' : 'Criar Suíte'}</Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                        <Button onClick={openNewTestCase}>
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Teste
                        </Button>
                    </div>

                </div>

                <div className="flex flex-1 gap-6 overflow-hidden">
                    {/* Sidebar - Suites Tree */}
                    <aside className="w-72 border rounded-xl bg-card overflow-y-auto">
                        <div className="p-4 border-b">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Estrutura</span>
                                <Settings2 className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Filtrar suítes..."
                                    className="pl-9 h-9 text-sm"
                                />
                            </div>
                        </div>
                        <div className="p-2 space-y-1">
                            <button
                                onClick={() => setSelectedSuite('all')}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                    selectedSuite === 'all' ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                                )}
                            >
                                <FolderTree className="w-4 h-4" />
                                Todos os Testes
                            </button>
                            <button
                                onClick={() => setSelectedSuite('none')}
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                    selectedSuite === 'none' ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                                )}
                            >
                                <Filter className="w-4 h-4" />
                                Sem Suíte (Raiz)
                            </button>
                            {suites.map((suite) => (
                                <div key={suite.id} className="group flex items-center gap-1">
                                    <button
                                        onClick={() => setSelectedSuite(suite.id)}
                                        className={cn(
                                            "flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                                            selectedSuite === suite.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {selectedSuite === suite.id ? <FolderOpen className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            <span className="truncate">{suite.name}</span>
                                        </div>
                                        <span className="text-[10px] opacity-70 font-mono">TS-{suite.suite_number}</span>
                                    </button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreHorizontal className="w-3 h-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEditSuite(suite)}>
                                                <Edit2 className="w-4 h-4 mr-2" />
                                                Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteSuite(suite.id)}>
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ))}
                            {suites.length === 0 && !loading && (
                                <div className="px-3 py-8 text-center">
                                    <p className="text-xs text-muted-foreground">Nenhuma suíte criada.</p>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Main Content - Test Cases */}
                    <main className="flex-1 flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar casos de teste..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" size="icon">
                                <Filter className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                            {filteredTests.length > 0 ? (
                                filteredTests.map((tc) => (
                                    <Card key={tc.id} className="group hover:border-primary/50 transition-colors">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex gap-3">
                                                    <div className="mt-1">
                                                        <TestTube2 className="w-5 h-5 text-primary/60" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">TC-{tc.case_number}</span>
                                                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                                                {tc.title}
                                                            </h3>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">
                                                                {tc.priority}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">
                                                                {tc.test_type}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                Atualizado em {new Date(tc.updated_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => openEditTestCase(tc)}>
                                                            <Edit2 className="w-4 h-4 mr-2" />
                                                            Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteTestCase(tc.id)}>
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Excluir
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-xl grayscale opacity-50">
                                    <TestTube2 className="w-12 h-12 mb-4" />
                                    <p className="text-sm font-medium">Nenhum caso de teste encontrado</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Crie um novo teste ou mude os filtros.
                                    </p>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>

            <TestCaseDialog
                open={testCaseDialogOpen}
                onOpenChange={setTestCaseDialogOpen}
                projectId={selectedProject}
                testCase={editingTestCase}
                initialSuiteId={selectedSuite !== 'all' && selectedSuite !== 'none' ? selectedSuite : null}
                onSuccess={fetchSuitesAndTests}
            />

        </AppLayout>

    );
}

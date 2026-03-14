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
    Settings2,
    X,
    ChevronDown,
    Check,
    RotateCcw,
    Copy,
    Tag
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
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
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedPriority, setSelectedPriority] = useState<string>('all');
    const [selectedTestType, setSelectedTestType] = useState<string>('all');
    const [selectedAutomation, setSelectedAutomation] = useState<string>('all');

    const ALL_TAGS = ['Regressão', 'Smoke', 'Sanity', 'Frontend', 'Backend', 'API', 'Mobile'];
    
    const testTypeLabels: Record<string, string> = {
        functional: 'Funcional',
        security: 'Segurança',
        performance: 'Performance',
        usability: 'Usabilidade',
    };
    
    const automationLabels: Record<string, string> = {
        manual: 'Manual',
        automated: 'Automatizado',
        hybrid: 'Híbrido'
    };

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
        if (!confirm('Tem certeza que deseja excluir este teste?')) return;
        const { error } = await supabase.from('test_cases').delete().eq('id', id);
        if (error) {
            toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Caso de teste excluído' });
            fetchSuitesAndTests();
        }
    };

    const handleDuplicateTestCase = async (testCase: TestCase) => {
        const newTestCase = {
            project_id: testCase.project_id,
            suite_id: testCase.suite_id,
            title: `${testCase.title} (Cópia)`,
            system_requirement: testCase.system_requirement,
            pre_conditions: testCase.pre_conditions,
            data_setup: testCase.data_setup,
            steps: testCase.steps,
            expected_result: testCase.expected_result,
            tags: testCase.tags,
            priority: testCase.priority,
            test_type: testCase.test_type,
            automation_status: testCase.automation_status,
            automation_script: testCase.automation_script,
            automation_framework: testCase.automation_framework,
            origin: testCase.origin,
            status: 'draft'
        };

        const { error } = await supabase.from('test_cases').insert(newTestCase);
        if (error) {
            toast({ title: 'Erro ao duplicar', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Caso de teste duplicado' });
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


    const clearFilters = () => {
        setSearchTerm('');
        setSelectedTags([]);
        setSelectedPriority('all');
        setSelectedTestType('all');
        setSelectedAutomation('all');
    };

    const hasActiveFilters = searchTerm !== '' || selectedTags.length > 0 || selectedPriority !== 'all' || selectedTestType !== 'all' || selectedAutomation !== 'all';

    const filteredTests = testCases.filter(tc => {
        const matchesSearch = tc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `TC-${tc.case_number}`.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPriority = selectedPriority === 'all' || tc.priority === selectedPriority;
        const matchesTestType = selectedTestType === 'all' || tc.test_type === selectedTestType;
        const matchesAutomation = selectedAutomation === 'all' || tc.automation_status === selectedAutomation;
        const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => tc.tags?.includes(tag));

        return matchesSearch && matchesPriority && matchesTestType && matchesAutomation && matchesTags;
    });

    const toggleTagFilter = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

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
                        {/* Functional Toolbar */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                    <Input
                                        placeholder="Buscar por título ou ID (TC-X)..."
                                        className="pl-10 h-11 bg-slate-950 border-slate-800 transition-all focus:ring-primary/20 focus:border-primary"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Multi-select Tags Filter */}
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "h-11 border-slate-800 bg-slate-950 hover:bg-slate-900 px-4 transition-all",
                                                    selectedTags.length > 0 && "border-primary/50 text-primary"
                                                )}
                                            >
                                                <Tag className="w-4 h-4 mr-2" />
                                                Tags
                                                {selectedTags.length > 0 && (
                                                    <span className="ml-2 bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                                                        {selectedTags.length}
                                                    </span>
                                                )}
                                                <ChevronDown className="ml-2 w-4 h-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-2 bg-slate-900 border-slate-800 shadow-2xl" align="end">
                                            <div className="space-y-1">
                                                {ALL_TAGS.map((tag) => (
                                                    <div
                                                        key={tag}
                                                        className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-800 rounded-md cursor-pointer transition-colors"
                                                        onClick={() => toggleTagFilter(tag)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox
                                                                checked={selectedTags.includes(tag)}
                                                                onCheckedChange={() => toggleTagFilter(tag)}
                                                            />
                                                            <span className="text-sm text-slate-300">{tag}</span>
                                                        </div>
                                                        {selectedTags.includes(tag) && <Check className="w-3 h-3 text-primary" />}
                                                    </div>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>

                                    {/* Priority Filter */}
                                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                                        <SelectTrigger
                                            className={cn(
                                                "w-36 h-11 bg-slate-950 border-slate-800 focus:ring-0 focus:ring-offset-0",
                                                selectedPriority !== 'all' && "border-primary/50 text-primary"
                                            )}
                                        >
                                            <SelectValue placeholder="Prioridade" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800">
                                            <SelectItem value="all">Todas Prioridades</SelectItem>
                                            <SelectItem value="high">Alta</SelectItem>
                                            <SelectItem value="medium">Média</SelectItem>
                                            <SelectItem value="low">Baixa</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={selectedTestType} onValueChange={setSelectedTestType}>
                                        <SelectTrigger
                                            className={cn(
                                                "w-36 h-11 bg-slate-950 border-slate-800 focus:ring-0 focus:ring-offset-0",
                                                selectedTestType !== 'all' && "border-primary/50 text-primary"
                                            )}
                                        >
                                            <SelectValue placeholder="Tipo" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800">
                                            <SelectItem value="all">Todos Tipos</SelectItem>
                                            <SelectItem value="functional">Funcional</SelectItem>
                                            <SelectItem value="security">Segurança</SelectItem>
                                            <SelectItem value="performance">Performance</SelectItem>
                                            <SelectItem value="usability">Usabilidade</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {/* Automation Filter */}
                                    <Select value={selectedAutomation} onValueChange={setSelectedAutomation}>
                                        <SelectTrigger
                                            className={cn(
                                                "w-36 h-11 bg-slate-950 border-slate-800 focus:ring-0 focus:ring-offset-0",
                                                selectedAutomation !== 'all' && "border-primary/50 text-primary"
                                            )}
                                        >
                                            <SelectValue placeholder="Automação" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800">
                                            <SelectItem value="all">Todas</SelectItem>
                                            <SelectItem value="manual">Manual</SelectItem>
                                            <SelectItem value="automated">Automatizado</SelectItem>
                                            <SelectItem value="hybrid">Híbrido</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Active Filters Display */}
                            {hasActiveFilters && (
                                <div className="flex items-center flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mr-1">Filtros:</span>

                                    {searchTerm && (
                                        <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 pl-2 pr-1 h-6 gap-1 group">
                                            Termo: {searchTerm}
                                            <button onClick={() => setSearchTerm('')} className="hover:text-primary transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    )}

                                    {selectedTags.map(tag => (
                                        <Badge
                                            key={tag}
                                            className="bg-primary/10 text-primary border-primary/30 pl-2 pr-1 h-6 gap-1 group shadow-[0_0_8px_rgba(59,130,246,0.1)]"
                                        >
                                            {tag}
                                            <button onClick={() => toggleTagFilter(tag)} className="hover:text-white transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}

                                    {selectedPriority !== 'all' && (
                                        <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700 pl-2 pr-1 h-6 gap-1">
                                            Prioridade: {selectedPriority}
                                            <button onClick={() => setSelectedPriority('all')} className="hover:text-primary transition-colors">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearFilters}
                                        className="h-6 px-2 text-[10px] text-primary hover:text-primary/80 hover:bg-primary/5 rounded-full"
                                    >
                                        <RotateCcw className="w-3 h-3 mr-1" />
                                        Limpar tudo
                                    </Button>
                                </div>
                            )}
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
                                                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                                                                {tc.title}
                                                                {tc.origin === 'ai' && (
                                                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] h-4 px-1">
                                                                        AI
                                                                    </Badge>
                                                                )}
                                                            </h3>
                                                        </div>
                                                        {tc.tags && tc.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                                {tc.tags.slice(0, tc.tags.length > 3 ? 2 : 3).map((tag) => (
                                                                    <span
                                                                        key={tag}
                                                                        className="text-[10px] px-1.5 py-0.5 rounded border border-primary/20 text-primary/80 font-medium"
                                                                    >
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                                {tc.tags.length > 3 && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-muted text-muted-foreground font-medium bg-muted/30">
                                                                        +{tc.tags.length - 2}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">
                                                                {tc.priority}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">
                                                                {testTypeLabels[tc.test_type]}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">
                                                                Auto: {automationLabels[tc.automation_status]}
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
                                                        <DropdownMenuItem onClick={() => handleDuplicateTestCase(tc)}>
                                                            <Copy className="w-4 h-4 mr-2" />
                                                            Duplicar
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

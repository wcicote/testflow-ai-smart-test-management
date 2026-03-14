import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Plus,
  ArrowLeft,
  TestTube2,
  MoreHorizontal,
  Trash2,
  Edit2,
  PlayCircle,
  Eye,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Project, TestCase } from '@/types';
import { TestCaseDialog } from '@/components/test-cases/TestCaseDialog';
import { TestExecutionDialog } from '@/components/test-cases/TestExecutionDialog';
import { TestCaseSheet } from '@/components/test-cases/TestCaseSheet';
import { TestSuitesList } from '@/components/test-suites/TestSuitesList';
import { TestRunsList } from '@/components/test-runs/TestRunsList';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [viewingTestCase, setViewingTestCase] = useState<TestCase | null>(null);
  const [openBugCounts, setOpenBugCounts] = useState<Record<string, number>>({});
  const { toast } = useToast();

  const fetchData = async () => {
    if (!projectId) return;

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError || !projectData) {
      toast({
        title: 'Projeto não encontrado',
        variant: 'destructive',
      });
      return;
    }

    setProject(projectData);

    const { data: testData, error: testError } = await supabase
      .from('test_cases')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (testError) {
      toast({
        title: 'Erro ao carregar testes',
        description: testError.message,
        variant: 'destructive',
      });
    } else {
      const cases = (testData as TestCase[]) || [];
      setTestCases(cases);

      // Fetch open bug counts for failed test cases
      const failedIds = cases.filter(tc => tc.status === 'failed').map(tc => tc.id);
      if (failedIds.length > 0) {
        const { data: bugData } = await supabase
          .from('test_executions')
          .select('test_case_id')
          .eq('status', 'failed')
          .neq('bug_status', 'resolved')
          .in('test_case_id', failedIds);

        const counts: Record<string, number> = {};
        for (const row of bugData || []) {
          counts[row.test_case_id] = (counts[row.test_case_id] || 0) + 1;
        }
        setOpenBugCounts(counts);
      } else {
        setOpenBugCounts({});
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('test_cases').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Caso de teste excluído' });
      fetchData();
    }
  };

  const handleDuplicate = async (testCase: TestCase) => {
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
       toast({
        title: 'Erro ao duplicar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Caso de teste duplicado' });
      fetchData();
    }
  };

  const handleEdit = (testCase: TestCase) => {
    setEditingTestCase(testCase);
    setDialogOpen(true);
  };

  const handleExecute = (testCase: TestCase) => {
    setSelectedTestCase(testCase);
    setExecutionDialogOpen(true);
  };

  const handleView = (testCase: TestCase) => {
    setViewingTestCase(testCase);
    setSheetOpen(true);
  };

  const openNewTestCase = () => {
    setEditingTestCase(null);
    setDialogOpen(true);
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'priority-badge priority-high';
      case 'medium':
        return 'priority-badge priority-medium';
      default:
        return 'priority-badge priority-low';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ready':
        return 'status-badge status-ready';
      case 'running':
        return 'status-badge status-running';
      case 'passed':
        return 'status-badge status-passed';
      case 'failed':
        return 'status-badge status-failed';
      default:
        return 'status-badge status-draft';
    }
  };

  const priorityLabels = { low: 'Baixa', medium: 'Média', high: 'Alta' };
  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    ready: 'Pronto',
    running: 'Em Execução',
    passed: 'Passou',
    failed: 'Falhou',
  };
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

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{project?.name}</h1>
            <p className="text-muted-foreground mt-1">
              {project?.description || 'Sem descrição'}
            </p>
          </div>
          <Button onClick={openNewTestCase}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Teste
          </Button>
        </div>

        <Tabs defaultValue="cases" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cases">Casos de Teste</TabsTrigger>
            <TabsTrigger value="suites">Suítes de Teste</TabsTrigger>
            <TabsTrigger value="executions">Histórico de Execuções</TabsTrigger>
          </TabsList>

          <TabsContent value="cases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Casos de Teste</CardTitle>
              </CardHeader>
              <CardContent>
                {testCases.length === 0 ? (
                  <div className="text-center py-12">
                    <TestTube2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">Nenhum teste ainda</h3>
                    <p className="text-muted-foreground mt-1 mb-4">
                      Crie seu primeiro caso de teste
                    </p>
                    <Button onClick={openNewTestCase}>
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Teste
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">ID</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Automação</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {testCases.map((testCase) => (
                          <TableRow
                            key={testCase.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleView(testCase)}
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              TC-{testCase.case_number}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {testCase.title}
                                {testCase.origin === 'ai' && (
                                  <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] h-4 px-1 flex-shrink-0">
                                    AI
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <span className={getPriorityClass(testCase.priority)}>
                                {priorityLabels[testCase.priority]}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {testTypeLabels[testCase.test_type]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="border-primary/50 text-primary">
                                {automationLabels[testCase.automation_status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <span className={getStatusClass(testCase.status)}>
                                  {statusLabels[testCase.status]}
                                </span>
                                {testCase.status === 'failed' && (openBugCounts[testCase.id] || 0) > 1 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Múltiplos bugs impedindo este teste ({openBugCounts[testCase.id]} abertos)</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(testCase); }}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    Visualizar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleExecute(testCase); }}>
                                    <PlayCircle className="w-4 h-4 mr-2" />
                                    Executar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(testCase); }}>
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(testCase); }}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if(confirm('Tem certeza que deseja excluir este teste?')) handleDelete(testCase.id); 
                                    }}
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suites">
            <TestSuitesList projectId={projectId!} onSuccess={fetchData} />
          </TabsContent>

          <TabsContent value="executions">
            <TestRunsList projectId={projectId!} />
          </TabsContent>
        </Tabs>
      </div>

      <TestCaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId!}
        testCase={editingTestCase}
        onSuccess={fetchData}
      />

      {selectedTestCase && (
        <TestExecutionDialog
          open={executionDialogOpen}
          onOpenChange={setExecutionDialogOpen}
          testCase={selectedTestCase}
          onSuccess={fetchData}
        />
      )}

      <TestCaseSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        testCase={viewingTestCase}
      />
    </AppLayout>
  );
}

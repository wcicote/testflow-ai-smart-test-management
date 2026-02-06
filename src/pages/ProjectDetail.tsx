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
} from 'lucide-react';
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

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [executionDialogOpen, setExecutionDialogOpen] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
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
      setTestCases((testData as TestCase[]) || []);
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

  const handleEdit = (testCase: TestCase) => {
    setEditingTestCase(testCase);
    setDialogOpen(true);
  };

  const handleExecute = (testCase: TestCase) => {
    setSelectedTestCase(testCase);
    setExecutionDialogOpen(true);
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
      default:
        return 'status-badge status-draft';
    }
  };

  const priorityLabels = { low: 'Baixa', medium: 'Média', high: 'Alta' };
  const statusLabels = { draft: 'Rascunho', ready: 'Pronto', running: 'Em Execução' };
  const typeLabels = { manual: 'Manual', automated: 'Automatizado' };

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
                      <TableHead>Título</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testCases.map((testCase) => (
                      <TableRow key={testCase.id}>
                        <TableCell className="font-medium">{testCase.title}</TableCell>
                        <TableCell>
                          <span className={getPriorityClass(testCase.priority)}>
                            {priorityLabels[testCase.priority]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {typeLabels[testCase.test_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={getStatusClass(testCase.status)}>
                            {statusLabels[testCase.status]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleExecute(testCase)}>
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Executar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(testCase)}>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(testCase.id)}
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
    </AppLayout>
  );
}
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug as BugIcon, ExternalLink, AlertCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bug } from '@/types';

export default function Bugs() {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchBugs() {
      try {
        const { data, error } = await supabase
          .from('test_executions')
          .select(`
            id,
            bug_description,
            status,
            created_at,
            test_case_id,
            test_cases!inner (
              id,
              title,
              priority,
              project_id,
              projects!inner (
                id,
                name
              )
            )
          `)
          .eq('status', 'failed')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        const formattedBugs: Bug[] = (data || []).map((item: any) => ({
          id: item.id,
          bug_description: item.bug_description || 'Sem descrição',
          status: item.status,
          created_at: item.created_at,
          test_case_id: item.test_cases.id,
          test_case_title: item.test_cases.title,
          project_id: item.test_cases.projects.id,
          project_name: item.test_cases.projects.name,
          priority: item.test_cases.priority,
        }));

        setBugs(formattedBugs);
      } catch (error: any) {
        toast({
          title: 'Erro ao carregar bugs',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchBugs();
  }, [toast]);

  const getSeverityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return (
          <Badge className="bg-destructive text-destructive-foreground">
            <AlertCircle className="w-3 h-3 mr-1" />
            Alta
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-warning text-warning-foreground">
            Média
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Baixa
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bugs</h1>
          <p className="text-muted-foreground mt-1">
            Todos os bugs registrados nas execuções de teste
          </p>
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
                <p className="text-muted-foreground mt-1">
                  Excelente! Não há bugs registrados no sistema.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Descrição do Bug</TableHead>
                      <TableHead>Caso de Teste</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bugs.map((bug) => (
                      <TableRow key={bug.id}>
                        <TableCell>
                          {getSeverityBadge(bug.priority)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="truncate font-medium" title={bug.bug_description}>
                            {bug.bug_description}
                          </p>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {bug.test_case_title}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{bug.project_name}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(bug.created_at)}
                        </TableCell>
                        <TableCell>
                          <Link to={`/projects/${bug.project_id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Ver Teste
                            </Button>
                          </Link>
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
    </AppLayout>
  );
}

import { useEffect, useState } from 'react';
import { FolderKanban, TestTube2, Bug, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { SuccessRateChart } from '@/components/dashboard/SuccessRateChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DashboardStats } from '@/types';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalTests: 0,
    activeBugs: 0,
    successRate: 0,
  });
  const [executionStats, setExecutionStats] = useState({ passed: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get total projects
        const { count: projectCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true });

        // Get total tests
        const { count: testCount } = await supabase
          .from('test_cases')
          .select('*', { count: 'exact', head: true });

        // Get all executions
        const { data: executions } = await supabase
          .from('test_executions')
          .select('status');

        const passed = executions?.filter(e => e.status === 'passed').length || 0;
        const failed = executions?.filter(e => e.status === 'failed').length || 0;
        const total = passed + failed;
        const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

        setStats({
          totalProjects: projectCount || 0,
          totalTests: testCount || 0,
          activeBugs: failed,
          successRate,
        });

        setExecutionStats({ passed, failed });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do seu ambiente de testes
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Projetos"
            value={stats.totalProjects}
            icon={FolderKanban}
          />
          <StatCard
            title="Testes Criados"
            value={stats.totalTests}
            icon={TestTube2}
          />
          <StatCard
            title="Bugs Ativos"
            value={stats.activeBugs}
            icon={Bug}
            variant="destructive"
          />
          <StatCard
            title="Taxa de Sucesso"
            value={`${stats.successRate}%`}
            icon={TrendingUp}
            variant="success"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Resultado das Execuções</CardTitle>
            </CardHeader>
            <CardContent>
              <SuccessRateChart
                passed={executionStats.passed}
                failed={executionStats.failed}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Início Rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-secondary">
                <h3 className="font-semibold text-foreground">1. Crie um Projeto</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Organize seus testes por projeto de software
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary">
                <h3 className="font-semibold text-foreground">2. Adicione Casos de Teste</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Use a IA para gerar passos automaticamente
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary">
                <h3 className="font-semibold text-foreground">3. Execute e Monitore</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Acompanhe os resultados em tempo real
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
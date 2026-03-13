import { useEffect, useState } from 'react';
import { FolderKanban, TestTube2, Bug, TrendingUp, CheckCircle2, XCircle, Slash, MinusCircle, Bot, Activity } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { SuccessRateChart } from '@/components/dashboard/SuccessRateChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DashboardStats } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalTests: 0,
    activeBugs: 0,
    successRate: 0,
    aiTests: 0,
    totalRuns: 0,
  });
  const [executionStats, setExecutionStats] = useState({ passed: 0, failed: 0 });

  // New widget states
  const [recentBugs, setRecentBugs] = useState<any[]>([]);
  const [recentTestCases, setRecentTestCases] = useState<any[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<any[]>([]);
  const [recentTestRuns, setRecentTestRuns] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Base Stats
        const { count: testCount } = await supabase.from('test_cases').select('*', { count: 'exact', head: true });
        const { count: aiTestsCount } = await supabase.from('test_cases').select('*', { count: 'exact', head: true }).eq('origin', 'ai');
        const { count: bugsCount } = await supabase.from('test_executions').select('*', { count: 'exact', head: true }).eq('status', 'failed').not('bug_description', 'is', null);
        
        const { data: runsData } = await supabase.from('test_runs').select('status');
        
        const completedRuns = runsData?.filter(r => r.status === 'passed' || r.status === 'failed' || r.status === 'completed') || [];
        const passedRuns = completedRuns.filter(r => r.status === 'passed').length;
        const totalCompleted = completedRuns.length;
        const runsSuccessRate = totalCompleted > 0 ? Math.round((passedRuns / totalCompleted) * 100) : 0;

        setStats({
          totalProjects: 0,
          totalTests: testCount || 0,
          activeBugs: bugsCount || 0,
          successRate: runsSuccessRate,
          aiTests: aiTestsCount || 0,
          totalRuns: runsData?.length || 0,
        });

        // Still used for the chart
        const { data: executions } = await supabase.from('test_executions').select('status');
        const passed = executions?.filter(e => e.status === 'passed').length || 0;
        const failed = executions?.filter(e => e.status === 'failed').length || 0;
        setExecutionStats({ passed, failed });

        setExecutionStats({ passed, failed });

        // Widget Data - Últimos Bugs (Failed executions with bugs)
        const { data: bugs } = await supabase
          .from('test_executions')
          .select('id, bug_description, created_at, test_cases(title, case_number)')
          .eq('status', 'failed')
          .not('bug_description', 'is', null)
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentBugs(bugs || []);

        // Widget Data - Últimos Casos Criados (assumed all or AI created contextually)
        const { data: cases } = await supabase
          .from('test_cases')
          .select('id, title, case_number, created_at, test_type')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentTestCases(cases || []);

        // Widget Data - Últimas execuções de casos individuais
        const { data: recentExecs } = await supabase
          .from('test_executions')
          .select('id, status, created_at, test_cases(title, case_number)')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentExecutions(recentExecs || []);

        // Widget Data - Últimas suítes/runs executadas
        const { data: runs } = await supabase
          .from('test_runs')
          .select('id, name, run_number, status, created_at, test_suites(name)')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentTestRuns(runs || []);

      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'blocked': return <Slash className="w-4 h-4 text-amber-500" />;
      default: return <MinusCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8 pb-12">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral do seu ambiente de testes
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Testes"
            value={stats.totalTests}
            icon={TestTube2}
          />
          <StatCard
            title="Testes por IA"
            value={stats.aiTests}
            icon={Bot}
          />
          <StatCard
            title="Execuções de Suítes"
            value={stats.totalRuns}
            icon={Activity}
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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" /> Execuções de Suítes (Test Runs)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[260px] pr-4">
                {recentTestRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma execução recente.</p>
                ) : (
                  <div className="space-y-4">
                    {recentTestRuns.map(run => (
                      <div key={run.id} className="flex justify-between items-center p-3 rounded-lg bg-secondary/50 border border-slate-800/50">
                        <div>
                          <p className="font-medium text-sm">RUN-{run.run_number}: {run.name}</p>
                          <p className="text-xs text-muted-foreground">Suíte: {run.test_suites?.name || '-'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="text-[10px]">{run.status}</Badge>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(run.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Info Widgets Grid */}
        <div className="grid gap-4 lg:grid-cols-3">

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bug className="w-4 h-4 text-red-500" /> Últimos Bugs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] pr-3">
                {recentBugs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">Nenhum bug registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {recentBugs.map(bug => (
                      <div key={bug.id} className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs font-semibold text-red-400">TC-{bug.test_cases?.case_number}</span>
                          <span className="text-[10px] text-slate-500">{format(new Date(bug.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        </div>
                        <p className="text-sm text-slate-300 font-medium truncate mb-1">{bug.test_cases?.title}</p>
                        <p className="text-xs text-slate-400 line-clamp-2">{bug.bug_description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Casos Executados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] pr-3">
                {recentExecutions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">Nenhuma execução de caso.</p>
                ) : (
                  <div className="space-y-3">
                    {recentExecutions.map(exec => (
                      <div key={exec.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg border border-slate-800">
                        {getStatusIcon(exec.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">TC-{exec.test_cases?.case_number} {exec.test_cases?.title}</p>
                          <p className="text-[10px] text-slate-500">{format(new Date(exec.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-500" /> Casos Criados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] pr-3">
                {recentTestCases.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">Nenhum caso criado recentemente.</p>
                ) : (
                  <div className="space-y-3">
                    {recentTestCases.map(tc => (
                      <div key={tc.id} className="p-3 bg-secondary/30 rounded-lg border border-slate-800">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-mono text-slate-500">TC-{tc.case_number}</span>
                          <span className="text-[10px] text-slate-500">{format(new Date(tc.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-200 line-clamp-2">{tc.title}</p>
                        {tc.test_type === 'automated' && (
                          <Badge variant="outline" className="mt-2 text-[9px] border-blue-500/30 text-blue-400">Automatizado</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

        </div>
      </div>
    </AppLayout>
  );
}
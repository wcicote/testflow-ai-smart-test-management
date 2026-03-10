import { useEffect, useState } from 'react';
import { FileText, ListChecks, CheckCircle, Tag, Clock, ImageIcon, VideoIcon, Loader2, Code2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TestCase, BugEvidence } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface TestCaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: TestCase | null;
}

export function TestCaseSheet({ open, onOpenChange, testCase }: TestCaseSheetProps) {
  const [evidences, setEvidences] = useState<BugEvidence[]>([]);
  const [loadingEvidences, setLoadingEvidences] = useState(false);

  useEffect(() => {
    if (open && testCase) {
      fetchEvidences();
    } else {
      setEvidences([]);
    }
  }, [open, testCase?.id]);

  const fetchEvidences = async () => {
    if (!testCase) return;
    setLoadingEvidences(true);

    // Get all executions for this test case, then their evidences
    const { data: executions } = await supabase
      .from('test_executions')
      .select('id')
      .eq('test_case_id', testCase.id);

    if (executions && executions.length > 0) {
      const executionIds = executions.map(e => e.id);
      const { data } = await supabase
        .from('bug_evidences')
        .select('*')
        .in('test_execution_id', executionIds)
        .order('created_at', { ascending: false });

      setEvidences((data || []) as BugEvidence[]);
    }
    setLoadingEvidences(false);
  };

  if (!testCase) return null;

  const priorityLabels = { low: 'Baixa', medium: 'Média', high: 'Alta' };
  const statusLabels = {
    draft: 'Rascunho',
    ready: 'Pronto',
    running: 'Em Execução',
    passed: 'Passou',
    failed: 'Falhou',
  };
  const typeLabels = { manual: 'Manual', automated: 'Automatizado' };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ready': return 'bg-primary text-primary-foreground';
      case 'running': return 'bg-warning text-warning-foreground';
      case 'passed': return 'bg-success text-success-foreground';
      case 'failed': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{testCase.title}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Criado em {formatDate(testCase.created_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Meta Info */}
          <div className="flex flex-wrap gap-2">
            <Badge className={getPriorityClass(testCase.priority)}>
              <Tag className="w-3 h-3 mr-1" />
              {priorityLabels[testCase.priority]}
            </Badge>
            <Badge variant="outline">
              {typeLabels[testCase.test_type]}
            </Badge>
            <Badge className={getStatusClass(testCase.status)}>
              {statusLabels[testCase.status]}
            </Badge>
          </div>

          {/* Tags Section */}
          {testCase.tags && testCase.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {testCase.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-[10px] px-2 py-0"
                >
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          {/* Requisito do Sistema */}
          {testCase.system_requirement && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="w-4 h-4 text-primary" />
                Requisito do Sistema
              </div>
              <div className="p-4 rounded-lg bg-secondary">
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {testCase.system_requirement}
                </p>
              </div>
            </div>
          )}

          {/* Passos do Teste */}
          {testCase.steps && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListChecks className="w-4 h-4 text-primary" />
                Passos do Teste
              </div>
              <div className="p-4 rounded-lg bg-secondary">
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {testCase.steps}
                </p>
              </div>
            </div>
          )}

          {/* Resultado Esperado */}
          {testCase.expected_result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle className="w-4 h-4 text-success" />
                Resultado Esperado
              </div>
              <div className="p-4 rounded-lg bg-secondary">
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {testCase.expected_result}
                </p>
              </div>
            </div>
          )}

          {/* Script de Automação */}
          {testCase.automation_script && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Code2 className="w-4 h-4 text-primary" />
                  Script de Automação ({testCase.automation_framework === 'cypress' ? 'Cypress' : 'Playwright'})
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(testCase.automation_script || '');
                    // Feedback visual opcional pode ser adicionado aqui com um toast
                  }}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  Copiar Código
                </button>
              </div>
              <div className="relative group overflow-hidden rounded-lg border border-slate-800 bg-[#1e1e1e]">
                <div className="p-4 text-[12px] font-mono leading-relaxed overflow-x-auto max-h-[300px] scrollbar-thin scrollbar-thumb-slate-700">
                  <pre className="text-slate-300">
                    <code className="block whitespace-pre">
                      {testCase.automation_script}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Evidências */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ImageIcon className="w-4 h-4 text-primary" />
              Evidências
            </div>
            {loadingEvidences ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : evidences.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhuma evidência anexada a este teste.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {evidences.map((ev) => (
                  <div key={ev.id} className="border rounded-lg overflow-hidden">
                    {ev.file_type === 'image' ? (
                      <img src={ev.file_url} alt={ev.file_name} className="w-full h-32 object-cover" />
                    ) : (
                      <div className="relative">
                        <video src={ev.file_url} controls className="w-full h-32 object-cover" />
                        <VideoIcon className="absolute top-1 left-1 w-4 h-4 text-white drop-shadow" />
                      </div>
                    )}
                    <p className="text-[10px] px-1 py-0.5 truncate text-muted-foreground">{ev.file_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Empty state */}
          {!testCase.steps && !testCase.expected_result && !testCase.system_requirement && evidences.length === 0 && (
            <div className="text-center py-8">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Este caso de teste ainda não possui detalhes configurados.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

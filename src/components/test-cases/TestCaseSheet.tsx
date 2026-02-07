import { FileText, ListChecks, CheckCircle, Tag, Clock } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TestCase } from '@/types';

interface TestCaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: TestCase | null;
}

export function TestCaseSheet({ open, onOpenChange, testCase }: TestCaseSheetProps) {
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
      case 'high':
        return 'bg-destructive text-destructive-foreground';
      case 'medium':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-primary text-primary-foreground';
      case 'running':
        return 'bg-warning text-warning-foreground';
      case 'passed':
        return 'bg-success text-success-foreground';
      case 'failed':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
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

          {/* Empty state for missing details */}
          {!testCase.steps && !testCase.expected_result && !testCase.system_requirement && (
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

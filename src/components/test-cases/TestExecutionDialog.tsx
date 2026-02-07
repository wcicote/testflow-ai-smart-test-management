import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestCase } from '@/types';

interface TestExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: TestCase;
  onSuccess: () => void;
}

type Severity = 'critical' | 'high' | 'medium' | 'low';

const severityConfig: Record<Severity, { label: string; className: string }> = {
  critical: { label: 'Crítica', className: 'bg-destructive text-destructive-foreground' },
  high: { label: 'Alta', className: 'bg-priority-high text-white' },
  medium: { label: 'Média', className: 'bg-priority-medium text-white' },
  low: { label: 'Baixa', className: 'bg-priority-low text-white' },
};

export function TestExecutionDialog({
  open,
  onOpenChange,
  testCase,
  onSuccess,
}: TestExecutionDialogProps) {
  const [status, setStatus] = useState<'passed' | 'failed' | null>(null);
  const [notes, setNotes] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedSeverity, setSuggestedSeverity] = useState<Severity | null>(null);
  const [severityReason, setSeverityReason] = useState('');
  const [analyzingSeverity, setAnalyzingSeverity] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setStatus(null);
      setNotes('');
      setBugDescription('');
      setSuggestedSeverity(null);
      setSeverityReason('');
    }
  }, [open]);

  // Debounced severity analysis
  const analyzeSeverity = useCallback(async (description: string) => {
    if (description.trim().length < 20) {
      setSuggestedSeverity(null);
      setSeverityReason('');
      return;
    }

    setAnalyzingSeverity(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-test-steps', {
        body: { 
          action: 'suggest-severity',
          bugDescription: description 
        },
      });

      if (error) throw error;

      if (data.severity) {
        setSuggestedSeverity(data.severity as Severity);
        setSeverityReason(data.reason || '');
      }
    } catch (error: any) {
      console.error('Severity analysis error:', error);
      // Silent fail - don't show toast for background analysis
    } finally {
      setAnalyzingSeverity(false);
    }
  }, []);

  // Debounce effect for bug description changes
  useEffect(() => {
    if (status !== 'failed' || !bugDescription.trim()) {
      setSuggestedSeverity(null);
      setSeverityReason('');
      return;
    }

    const timeoutId = setTimeout(() => {
      analyzeSeverity(bugDescription);
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [bugDescription, status, analyzeSeverity]);

  const handleSubmit = async () => {
    if (!status) {
      toast({
        title: 'Selecione o resultado',
        description: 'Marque se o teste passou ou falhou',
        variant: 'destructive',
      });
      return;
    }

    if (status === 'failed' && !bugDescription.trim()) {
      toast({
        title: 'Descrição do bug obrigatória',
        description: 'Descreva o bug encontrado',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Format bug description with severity if available
    let finalBugDescription = bugDescription;
    if (status === 'failed' && suggestedSeverity) {
      finalBugDescription = `[Severidade: ${severityConfig[suggestedSeverity].label}] ${bugDescription}`;
    }

    // Insert the execution record
    const { error: executionError } = await supabase.from('test_executions').insert({
      test_case_id: testCase.id,
      status,
      notes: notes || null,
      bug_description: status === 'failed' ? finalBugDescription : null,
      executed_by: user.id,
    });

    if (executionError) {
      toast({
        title: 'Erro ao registrar execução',
        description: executionError.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Auto-update test case status based on execution result
    const { error: updateError } = await supabase
      .from('test_cases')
      .update({ status: status })
      .eq('id', testCase.id);

    if (updateError) {
      console.error('Error updating test case status:', updateError);
      // Don't fail the entire operation, just log the error
    }

    toast({
      title: status === 'passed' ? 'Teste passou! ✓' : 'Bug registrado',
      variant: status === 'passed' ? 'default' : 'destructive',
    });
    onSuccess();
    onOpenChange(false);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Executar Teste</DialogTitle>
          <DialogDescription>{testCase.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {testCase.steps && (
            <div className="p-4 rounded-lg bg-secondary">
              <Label className="text-sm font-medium">Passos do Teste:</Label>
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                {testCase.steps}
              </p>
            </div>
          )}

          {testCase.expected_result && (
            <div className="p-4 rounded-lg bg-secondary">
              <Label className="text-sm font-medium">Resultado Esperado:</Label>
              <p className="mt-2 text-sm text-muted-foreground">
                {testCase.expected_result}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Resultado da Execução</Label>
            <div className="grid grid-cols-2 gap-4">
              <Button
                type="button"
                variant={status === 'passed' ? 'default' : 'outline'}
                className={
                  status === 'passed'
                    ? 'bg-success hover:bg-success/90 text-success-foreground'
                    : ''
                }
                onClick={() => setStatus('passed')}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Passou
              </Button>
              <Button
                type="button"
                variant={status === 'failed' ? 'default' : 'outline'}
                className={
                  status === 'failed'
                    ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                    : ''
                }
                onClick={() => setStatus('failed')}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Falhou
              </Button>
            </div>
          </div>

          {status === 'failed' && (
            <div className="space-y-3 animate-fade-in">
              <div className="space-y-2">
                <Label htmlFor="bug">Descrição do Bug *</Label>
                <Textarea
                  id="bug"
                  placeholder="Descreva o bug encontrado em detalhes..."
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  rows={4}
                />
              </div>

              {/* AI Severity Suggestion */}
              {(analyzingSeverity || suggestedSeverity) && (
                <div className="p-3 rounded-lg border border-border bg-muted/50 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    {analyzingSeverity ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm font-medium">Analisando severidade...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Severidade sugerida pela IA:</span>
                      </>
                    )}
                  </div>
                  
                  {suggestedSeverity && !analyzingSeverity && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <Badge className={severityConfig[suggestedSeverity].className}>
                          {severityConfig[suggestedSeverity].label}
                        </Badge>
                      </div>
                      {severityReason && (
                        <p className="text-xs text-muted-foreground">{severityReason}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Notas adicionais sobre a execução..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !status}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar Execução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

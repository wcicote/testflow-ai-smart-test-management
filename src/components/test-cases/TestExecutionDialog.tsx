import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestCase } from '@/types';

interface TestExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: TestCase;
  onSuccess: () => void;
}

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
  const { toast } = useToast();

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

    const { error } = await supabase.from('test_executions').insert({
      test_case_id: testCase.id,
      status,
      notes: notes || null,
      bug_description: status === 'failed' ? bugDescription : null,
      executed_by: user.id,
    });

    if (error) {
      toast({
        title: 'Erro ao registrar execução',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: status === 'passed' ? 'Teste passou! ✓' : 'Bug registrado',
        variant: status === 'passed' ? 'default' : 'destructive',
      });
      onSuccess();
      onOpenChange(false);
      setStatus(null);
      setNotes('');
      setBugDescription('');
    }

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
            <div className="space-y-2 animate-fade-in">
              <Label htmlFor="bug">Descrição do Bug *</Label>
              <Textarea
                id="bug"
                placeholder="Descreva o bug encontrado em detalhes..."
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                rows={4}
              />
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
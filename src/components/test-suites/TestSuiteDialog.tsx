import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TestSuite } from '@/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface TestSuiteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    testSuite: TestSuite | null;
    onSuccess: () => void;
}

export function TestSuiteDialog({
    open,
    onOpenChange,
    projectId,
    testSuite,
    onSuccess,
}: TestSuiteDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (testSuite) {
            setName(testSuite.name);
            setDescription(testSuite.description || '');
        } else {
            setName('');
            setDescription('');
        }
    }, [testSuite, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast({ title: 'Nome obrigatório', variant: 'destructive' });
            return;
        }

        setLoading(true);

        const payload = {
            name,
            description: description || null,
            project_id: projectId,
        };

        const { error } = testSuite
            ? await supabase.from('test_suites').update(payload).eq('id', testSuite.id)
            : await supabase.from('test_suites').insert(payload);

        if (error) {
            toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: testSuite ? 'Suíte atualizada' : 'Suíte criada' });
            onSuccess();
            onOpenChange(false);
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{testSuite ? 'Editar Suíte de Teste' : 'Nova Suíte de Teste'}</DialogTitle>
                        <DialogDescription>
                            Agrupe vários casos de teste em uma suíte para facilitar a execução.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome da Suíte *</Label>
                            <Input
                                id="name"
                                placeholder="Ex: Funcionalidades de Login"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Descrição (opcional)</Label>
                            <Textarea
                                id="description"
                                placeholder="Breve descrição dos testes que compõem esta suíte..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

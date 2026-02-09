import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BugEvidence } from '@/types';
import { Upload, Trash2, ImageIcon, VideoIcon, Loader2 } from 'lucide-react';

interface BugEvidenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  executionId: string;
  bugDescription: string;
}

export function BugEvidenceModal({ open, onOpenChange, executionId, bugDescription }: BugEvidenceModalProps) {
  const [evidences, setEvidences] = useState<BugEvidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const fetchEvidences = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bug_evidences')
      .select('*')
      .eq('test_execution_id', executionId)
      .order('created_at', { ascending: false });

    if (!error) {
      setEvidences((data || []) as BugEvidence[]);
    }
    setLoading(false);
  };

  const handleOpenChange = (value: boolean) => {
    if (value) fetchEvidences();
    onOpenChange(value);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      toast({ title: 'Tipo inválido', description: 'Envie apenas imagens ou vídeos.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const filePath = `${executionId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('bug-evidences')
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: 'Erro ao enviar', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('bug-evidences').getPublicUrl(filePath);

    const { error: insertError } = await supabase.from('bug_evidences').insert({
      test_execution_id: executionId,
      file_url: urlData.publicUrl,
      file_type: isImage ? 'image' : 'video',
      file_name: file.name,
    });

    if (insertError) {
      toast({ title: 'Erro ao salvar', description: insertError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Evidência adicionada!' });
      fetchEvidences();
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleDelete = async (evidence: BugEvidence) => {
    const path = evidence.file_url.split('/bug-evidences/')[1];
    if (path) {
      await supabase.storage.from('bug-evidences').remove([decodeURIComponent(path)]);
    }
    await supabase.from('bug_evidences').delete().eq('id', evidence.id);
    fetchEvidences();
    toast({ title: 'Evidência removida' });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evidências do Bug</DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{bugDescription}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <Input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span>
                  {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                  Enviar Evidência
                </span>
              </Button>
            </label>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : evidences.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Nenhuma evidência anexada</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {evidences.map((ev) => (
                <div key={ev.id} className="relative group border rounded-lg overflow-hidden">
                  {ev.file_type === 'image' ? (
                    <img src={ev.file_url} alt={ev.file_name} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="relative">
                      <video src={ev.file_url} controls className="w-full h-40 object-cover" />
                      <VideoIcon className="absolute top-2 left-2 w-5 h-5 text-white drop-shadow" />
                    </div>
                  )}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => handleDelete(ev)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-xs p-1 truncate text-muted-foreground">{ev.file_name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

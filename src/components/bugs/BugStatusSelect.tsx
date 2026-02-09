import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface BugStatusSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: 'Aberto', className: 'bg-destructive text-destructive-foreground' },
  in_progress: { label: 'Em Progresso', className: 'bg-warning text-warning-foreground' },
  resolved: { label: 'Resolvido', className: 'bg-green-600 text-white' },
};

export function BugStatusSelect({ value, onValueChange, disabled }: BugStatusSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-[140px] h-8">
        <SelectValue>
          <Badge className={statusConfig[value]?.className || ''}>
            {statusConfig[value]?.label || value}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(statusConfig).map(([key, config]) => (
          <SelectItem key={key} value={key}>
            <Badge className={config.className}>{config.label}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

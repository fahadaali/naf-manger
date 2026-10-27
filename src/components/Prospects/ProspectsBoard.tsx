import { useState } from 'react';
import { CalendarClock, ExternalLink, GripVertical, Phone } from 'lucide-react';
import { Prospect } from '../../types';
import { formatDate, formatNumber, formatPhone } from '@/registry/naf/lib/format';
import { clientTypeLabel } from '../../lib/labels';
import { prospectStatusBadge } from '../../lib/status-badges';
import { Badge } from '@/registry/naf/ui/badge';
import { Card } from '@/registry/naf/ui/card';

/* ═══ لوحةُ الحالات ═══
 *
 * عمودٌ لكلّ حالةٍ في «تكوين النظام»، بالترتيب نفسِه الذي في لوحة بيسكامب.
 * والسحبُ بين عمودين تعديلُ حالةٍ واحد: يُعرض فوراً، ثم يُحفظ، ويُرجَع إن
 * سقط الحفظ — فلا تبقى بطاقةٌ في عمودٍ لم تُحفظ فيه.
 *
 * والسحبُ HTML5 الأصليّ بلا مكتبة. ومن لا يسحب — لوحةُ مفاتيح أو لمس —
 * يغيّر الحالة من نموذج التعديل كما كان.
 */

interface ProspectsBoardProps {
  prospects: Prospect[];
  statuses: string[];
  canMove: boolean;
  onOpen: (prospect: Prospect) => void;
  onMove: (prospect: Prospect, status: string) => Promise<void>;
}

export default function ProspectsBoard({ prospects, statuses, canMove, onOpen, onMove }: ProspectsBoardProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const drop = async (status: string) => {
    const prospect = prospects.find((p) => p.id === dragging);
    setDragging(null);
    setOver(null);
    if (!prospect || prospect.prospectStatus === status) return;
    await onMove(prospect, status);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {statuses.map((status) => {
        const column = prospects.filter((p) => p.prospectStatus === status);
        const { variant, Icon } = prospectStatusBadge(status);
        const isOver = over === status && dragging !== null;

        return (
          <section
            key={status}
            aria-label={status}
            className={`flex-none w-72 rounded-xl border p-3 space-y-3 transition-colors ${
              isOver ? 'border-primary bg-primary-soft' : 'border-border bg-muted/40'
            }`}
            onDragOver={(event) => {
              if (!canMove || !dragging) return;
              event.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver((current) => (current === status ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              drop(status);
            }}
          >
            <header className="flex items-center justify-between gap-2">
              <Badge variant={variant}>
                <Icon aria-hidden="true" />
                {status}
              </Badge>
              <span className="text-xs text-muted-foreground"><bdi>{formatNumber(column.length)}</bdi></span>
            </header>

            <div className="space-y-2 min-h-16">
              {column.map((prospect) => (
                <Card
                  key={prospect.id}
                  draggable={canMove}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', prospect.id);
                    setDragging(prospect.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  className={`p-3 space-y-1.5 ${canMove ? 'cursor-grab active:cursor-grabbing' : ''} ${
                    dragging === prospect.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {canMove && <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground flex-none" aria-hidden="true" />}
                    <button
                      type="button"
                      onClick={() => onOpen(prospect)}
                      className="text-start text-sm font-medium text-foreground hover:text-primary hover:underline flex-1"
                    >
                      {prospect.fullName}
                    </button>
                    {prospect.basecampUrl && (
                      <a
                        href={prospect.basecampUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="البطاقة في بيسكامب"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{clientTypeLabel(prospect.clientType)}</p>
                  {prospect.phone && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      <bdi>{formatPhone(prospect.phone)}</bdi>
                    </p>
                  )}
                  {prospect.followUpDate && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      <bdi>{formatDate(prospect.followUpDate)}</bdi>
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

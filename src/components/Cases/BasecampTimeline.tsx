import { useEffect, useState } from 'react';
import {
  CircleCheck, ExternalLink, FileText, History, ListTodo, Megaphone, MessageSquare, Paperclip, type LucideIcon,
} from 'lucide-react';
import { db } from '../../data/database';
import { CaseTimeline } from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { formatDate, formatTime } from '@/registry/naf/lib/format';

const ERRORS: Record<string, string> = {
  not_configured: 'ربطُ بيسكامب غير مُعدّ',
  not_connected: 'بيسكامب غير مربوط',
  key_changed: 'يلزم ربطُ بيسكامب من جديد',
  rate_limited: 'تجاوزنا حدَّ النداءات — أعد الفتح بعد قليل',
};

type TimelineEvent = CaseTimeline['events'][number];

/* أيقونةٌ ولونٌ لكلّ نوع — من توكنات ناف، لا ألوانٌ خام. */
const KIND: Record<string, { icon: LucideIcon; tone: string }> = {
  Todo: { icon: ListTodo, tone: 'bg-info/10 text-info' },
  Comment: { icon: MessageSquare, tone: 'bg-primary/10 text-primary' },
  Message: { icon: Megaphone, tone: 'bg-warning/10 text-warning' },
  Upload: { icon: Paperclip, tone: 'bg-muted text-muted-foreground' },
  Document: { icon: FileText, tone: 'bg-muted text-muted-foreground' },
};
const DONE = { icon: CircleCheck, tone: 'bg-success/10 text-success' };

const FIRST = 5;

/* «اليوم» و«أمس» ثم التاريخ — بتقويم الجهاز لا بتوقيت الخادم. */
const dayKey = (at: Date) => `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
function dayLabel(at: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(at) === dayKey(today)) return 'اليوم';
  if (dayKey(at) === dayKey(yesterday)) return 'أمس';
  return formatDate(at);
}

/* وقتٌ نسبيّ لما قرُب، والساعةُ لما بعُد في اليوم نفسِه. */
const relative = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
function sinceLabel(at: Date): string {
  const minutes = Math.round((Date.now() - at.getTime()) / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return relative.format(-minutes, 'minute');
  if (minutes < 24 * 60) return relative.format(-Math.round(minutes / 60), 'hour');
  return formatTime(at);
}

function EventCard({ event }: { event: TimelineEvent }) {
  const at = new Date(event.at);
  const { icon: Icon, tone } = event.completed ? DONE : KIND[event.kind] ?? KIND.Document;
  const body = (
    <div className="flex items-start gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-medium">{event.label}</span>
          {event.title && <span> — {event.title}</span>}
        </p>
        {event.parentTitle && event.parentTitle !== event.title && (
          <p className="text-xs text-muted-foreground">في: {event.parentTitle}</p>
        )}
        {event.excerpt && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{event.excerpt}</p>}
        <p className="mt-1 text-xs text-muted-foreground">
          {event.author && <>{event.author} · </>}
          <bdi>{sinceLabel(at)}</bdi>
        </p>
      </div>
      {event.url && <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </div>
  );

  /* البطاقةُ كلُّها رابط: نقرةٌ تفتح الحدثَ نفسَه في بيسكامب. */
  return event.url ? (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={`${event.label}${event.title ? ` — ${event.title}` : ''} — افتح في بيسكامب`}
    >
      {body}
    </a>
  ) : (
    <div className="rounded-lg border border-border bg-card p-3">{body}</div>
  );
}

/**
 * ═══ آخرُ ما حدث في بيسكامب ═══
 *
 * مهامُّ ومهامُّ أُنجزت وتعليقاتٌ ورسائلُ وملفّات من مشروع القضية — قراءةً،
 * ويُخبَّأ عشرَ دقائق في الخادم. بطاقاتٌ بأيقونة نوعها، مجمَّعةٌ باليوم، كلٌّ
 * منها رابطٌ إلى الحدث في بيسكامب. وقضيةٌ بلا مشروعٍ مربوط لا يُعرض لها شيء.
 */
export default function BasecampTimeline({ caseId }: { caseId: string }) {
  const [timeline, setTimeline] = useState<CaseTimeline | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    db.getCaseTimeline(caseId).then((data) => { if (alive) setTimeline(data); });
    return () => { alive = false; };
  }, [caseId]);

  const events = timeline?.events ?? [];
  const shown = expanded ? events : events.slice(0, FIRST);
  const groups: { label: string; events: TimelineEvent[] }[] = [];
  for (const event of shown) {
    const label = dayLabel(new Date(event.at));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }

  if (!timeline?.linked) return null;

  return (
    <div className="bg-muted rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <History className="h-5 w-5" aria-hidden="true" />
          آخر ما حدث في بيسكامب
        </h3>
        {timeline.projectUrl && (
          <a href={timeline.projectUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1">
            فتح المشروع
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>

      {timeline.error ? (
        <p className="text-sm text-muted-foreground">{ERRORS[timeline.error] ?? 'تعذّرت القراءة من بيسكامب'}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا شيءَ في المشروع بعد.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.label} className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">{group.label}</h4>
              <ul className="space-y-2">
                {group.events.map((event) => (
                  <li key={`${event.kind}-${event.id}`}><EventCard event={event} /></li>
                ))}
              </ul>
            </section>
          ))}
          {events.length > FIRST && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'عرض أقلّ' : `عرض المزيد (${events.length - FIRST})`}
            </Button>
          )}
          {timeline.partial && <p className="text-xs text-muted-foreground">بعضُ الأنواع تعذّرت قراءتُه.</p>}
        </div>
      )}
    </div>
  );
}

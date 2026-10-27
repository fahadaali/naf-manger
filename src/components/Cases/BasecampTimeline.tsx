import { useEffect, useState } from 'react';
import { ExternalLink, History } from 'lucide-react';
import { db } from '../../data/database';
import { CaseTimeline } from '../../types';
import { formatDateTime } from '@/registry/naf/lib/format';

const ERRORS: Record<string, string> = {
  not_configured: 'ربطُ بيسكامب غير مُعدّ',
  not_connected: 'بيسكامب غير مربوط',
  key_changed: 'يلزم ربطُ بيسكامب من جديد',
  rate_limited: 'تجاوزنا حدَّ النداءات — أعد الفتح بعد قليل',
};

/**
 * ═══ آخرُ ما حدث في بيسكامب ═══
 *
 * مهامُّ ومهامُّ أُنجزت وتعليقاتٌ ورسائلُ وملفّات من مشروع القضية — قراءةً،
 * ويُخبَّأ عشرَ دقائق في الخادم. وقضيةٌ بلا مشروعٍ مربوط لا يُعرض لها شيء.
 */
export default function BasecampTimeline({ caseId }: { caseId: string }) {
  const [timeline, setTimeline] = useState<CaseTimeline | null>(null);

  useEffect(() => {
    let alive = true;
    db.getCaseTimeline(caseId).then((data) => { if (alive) setTimeline(data); });
    return () => { alive = false; };
  }, [caseId]);

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
      ) : timeline.events.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا شيءَ في المشروع بعد.</p>
      ) : (
        <ul className="space-y-2">
          {timeline.events.map((event) => (
            <li key={`${event.kind}-${event.id}`} className="text-sm">
              <span className="font-medium text-foreground">{event.label}</span>
              {event.title && <span className="text-foreground"> — {event.title}</span>}
              {event.excerpt && <p className="text-xs text-muted-foreground line-clamp-2">{event.excerpt}</p>}
              <p className="text-xs text-muted-foreground">
                {event.author && <>{event.author} · </>}
                <bdi>{formatDateTime(new Date(event.at))}</bdi>
                {event.url && (
                  <> · <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-primary">فتح</a></>
                )}
              </p>
            </li>
          ))}
          {timeline.partial && <li className="text-xs text-muted-foreground">بعضُ الأنواع تعذّرت قراءتُه.</li>}
        </ul>
      )}
    </div>
  );
}

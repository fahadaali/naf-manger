import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { db } from '../../data/database';
import { InAppNotification } from '../../types';
import { formatDateTime, formatNumber } from '@/registry/naf/lib/format';

/* يُقرأ كلَّ دقيقة — ويُقرأ عند الفتح، فلا ينتظر من يفتحه الدقيقةَ التالية. */
const POLL_MS = 60_000;

/**
 * ═══ جرسُ الإشعارات ═══
 *
 * كان هنا جرسٌ بلا مُعالِج فأُزيل، لأنّ الإشعاراتِ لم تكن مبنيّة. وصارت تُكتب
 * صفوفاً لكلّ مستلم (`worker/lib/notify.js`) ربط البريدُ أم لم يُربط — فعاد
 * الجرسُ يقول ما وقع. والبندُ يفتح شاشتَه ويُعلَّم مقروءاً.
 */
export default function NotificationBell({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const load = async () => {
    const data = await db.getNotifications();
    setItems(data.items);
    setUnread(data.unread);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  /* نقرةٌ خارج القائمة تغلقها، و`Escape` كذلك. */
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const toggle = () => {
    setOpen((current) => !current);
    if (!open) load();
  };

  const choose = async (item: InAppNotification) => {
    setOpen(false);
    if (!item.read) {
      await db.markNotificationsRead([item.id]);
      load();
    }
    if (item.link) onNavigate(item.link);
  };

  const readAll = async () => {
    await db.markNotificationsRead();
    load();
  };

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `الإشعارات — ${unread} غير مقروء` : 'الإشعارات'}
        aria-expanded={open}
        className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
            <bdi>{unread > 99 ? '99+' : formatNumber(unread)}</bdi>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-foreground">الإشعارات</p>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="text-xs text-primary hover:text-primary-strong">
                تعليم الكل مقروءاً
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">لا إشعاراتٌ بعد.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-border">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => choose(item)}
                    className={`w-full text-start px-4 py-3 hover:bg-muted ${item.read ? '' : 'bg-primary-soft'}`}
                  >
                    <p className={`text-sm ${item.read ? 'text-foreground' : 'font-semibold text-foreground'}`}>{item.title}</p>
                    {item.body && <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1"><bdi>{formatDateTime(new Date(item.createdAt))}</bdi></p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

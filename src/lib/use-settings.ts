/* ============================================================
   قوائم «تكوين النظام» — تُقرأ مرّةً وتُشارَك.

   ═══ لماذا وُجد هذا الملفّ ═══

   شاشة «تكوين النظام» تحرّر إحدى عشرة قائمة وتحفظها في `system_settings`،
   ولم يكن يقرؤها أحد: كل منسدلةٍ في القضايا والعملاء والمحتملين
   والمسوّقين كانت تحمل خياراتها مكتوبةً في التصيير، أو من
   `mockSystemSettings` — ملفّ عيّنات.

   فمسؤولُ المنصة يضيف نوعَ قضيةٍ جديداً، ويُحفظ بنجاح، ولا يظهر في أي
   قائمة أبداً. الشاشة تعمل والميزة لا.

   والقراءة تمرّ بـ`db.getSettings()` وهي تُشارك وعدَها، فعشرُ منسدلاتٍ
   تنادي هذا الخُطّاف نداءً واحداً على الشبكة لا عشرة.
   ============================================================ */

import { useEffect, useState } from 'react';

import { db } from '../data/database';
import { SystemSettings } from '../types';

/** أسماءُ القوائم التي تُغذّي المنسدلات. */
export type SettingList =
  | 'clientTypes'
  | 'clientStatuses'
  | 'prospectStatuses'
  | 'prospectSources'
  | 'caseTypes'
  | 'caseStatuses'
  | 'marketerStatuses'
  | 'relationshipTypes'
  | 'commissionTypes'
  | 'collectionStatuses'
  | 'feeTypes';

/**
 * الإعدادات كاملةً — `null` حتى تصل.
 *
 * ولا حالةَ تحميلٍ منفصلة: المنسدلة تُعرض فارغةً لحظةً ثم تمتلئ، وهو
 * أهدأ من إخفائها ثم إظهارها.
 */
export function useSettings(): SystemSettings | null {
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    let alive = true;

    db.getSettings()
      .then((value) => { if (alive) setSettings(value); })
      .catch((error) => {
        // قائمةٌ تسقط لا تُسقط النموذج: تُعرض فارغةً وتبقى القيمة المحفوظة.
        console.error('تعذّر جلب الإعدادات:', error);
      });

    return () => { alive = false; };
  }, []);

  return settings;
}

/**
 * قائمةٌ بعينها — مصفوفةٌ فارغة حتى تصل.
 *
 * و`current` تُضاف إن لم تكن في القائمة: صفٌّ محفوظٌ بقيمةٍ حُذفت من
 * التكوين لاحقاً يجب أن يبقى ظاهراً في منسدلته — وإلّا عرض النموذج
 * قيمةً غير قيمته وحفظ غيرَ ما كان.
 */
export function useSettingList(name: SettingList, current?: string): string[] {
  const settings = useSettings();
  const list = settings?.[name] ?? [];
  if (current && !list.includes(current)) return [current, ...list];
  return list;
}

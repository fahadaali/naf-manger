/* ═══ مراحلُ العميل المحتمل ═══
 *
 * الحالاتُ قائمةٌ يحرّرها المسؤول، فلا يُقارَن باسمٍ مكتوبٍ في الشيفرة: كانت
 * «بانتظار توقيع» و«غير مناسب» و«تم الرفض» نصوصاً حرفية في البطاقة والتحليلات،
 * فتبديلُ صياغةِ حالةٍ يُطفئ زرَّ التحويل ويُفسد عدَّ «قيد المتابعة» بلا تنبيه.
 *
 * فالمعنى من موضع الحالة: ما في `prospectClosedStatuses` إغلاق، وما سواه
 * مفتوح بترتيبه، وآخرُ المفتوح «جاهزٌ للتحويل».
 */
import { useSettingList } from './use-settings';

export interface ProspectStages {
  open: string[];
  closed: Set<string>;
  ready: string | null;
  isClosed: (status?: string) => boolean;
}

export function prospectStages(statuses: string[], closedStatuses: string[]): ProspectStages {
  const closed = new Set(closedStatuses);
  const open = statuses.filter((status) => !closed.has(status));
  return {
    open,
    closed,
    ready: open.length ? open[open.length - 1] : null,
    isClosed: (status) => Boolean(status && closed.has(status)),
  };
}

export function useProspectStages(): ProspectStages {
  return prospectStages(useSettingList('prospectStatuses'), useSettingList('prospectClosedStatuses'));
}

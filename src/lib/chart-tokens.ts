/* ============================================================
   ألوان الرسوم البيانية — تُقرأ من الرموز ولا تُكتب.

   Chart.js يرسم على canvas فلا يقرأ ‎var(--…)‎، وكانت كل شاشة تكتب
   رموزاً سداسية بيدها: ‎#3b82f6‎ في سبعة مواضع و‎#10b981‎ في خمسة،
   ثم ‎rgba(59,130,246,0.1)‎ للتعبئة تحت الخط.

   وهذا ليس من الاستثناءات الأربعة. الاستثناء سياقٌ **لا يستطيع** قراءة
   الرمز — بريدٌ في صندوق، أو مستندٌ يُطبع، أو وسمٌ لا يقبل ‎var()‎.
   وcanvas يستطيع: الرمز يُقرأ من الصفحة نفسها وقت التشغيل ويُمرَّر قيمةً.
   والفرق أن اللوحة تتبع الثيم — تنقلب مع الوضع الداكن ولا تُترك خلفه.

   والدرجات الخمس ‎--chart-1..5‎ زخرفة لا حالة: §٦ تقول «رموز دلالية
   للواجهة ودرجات اللوحة للزخرفة»، وشريحةُ رسمٍ تميّز فئةً عن أختها ولا
   تُبلّغ نجاحاً ولا خطأً. والحالة يقولها النصّ والأيقونة في الشارة.
   ============================================================ */

import { useEffect, useState } from 'react';

/** الدرجات الخمس بترتيبها في السجلّ — متباعدة المدارج ومقيسة للتمييز. */
export const CHART_TOKENS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
] as const;

/** يقرأ قيمة رمزٍ من عنصر الجذر. السلسلة الفارغة إن لم يوجد. */
export function readToken(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * لوحة الرسوم بالترتيب، مقصوصة على العدد المطلوب.
 * تدور إن طُلب أكثر من خمسة — والدوران أصدق من اختراع درجة سادسة.
 */
/* النوع مصرَّحٌ `number`: `CHART_TOKENS` مجمَّدة بـ`as const`، فطولُها يُستنبط
   القيمةَ `5` لا النوعَ `number`، فيُرفض كلُّ عددٍ سواها — وهي دالّةٌ تدور
   على الخمس بأي عدد كان. */
export function chartPalette(count: number = CHART_TOKENS.length): string[] {
  return Array.from({ length: count }, (_, i) =>
    readToken(CHART_TOKENS[i % CHART_TOKENS.length])
  );
}

/**
 * لوحة الرسوم مع إعادة القراءة عند تبديل المظهر.
 *
 * مُبدِّل المظهر يضع صنف ‎.dark‎ على الجذر ويزيله، والدرجات الخمس تفتح
 * في الداكن — فبلا مراقبةٍ يبقى الرسم بألوان الوضع السابق حتى إعادة
 * التحميل. والمراقب على ‎class‎ وحده فلا يستيقظ لغيرها.
 */
export function useChartPalette(count: number = CHART_TOKENS.length): string[] {
  const [palette, setPalette] = useState<string[]>(() => chartPalette(count));

  useEffect(() => {
    const refresh = () => setPalette(chartPalette(count));
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [count]);

  return palette;
}

/**
 * تعبئةٌ شفّافة من الدرجة نفسها — للمساحة تحت خطّ الرسم.
 *
 * ‎color-mix‎ لا rgba مكتوبة بيدها: النسبة تُطبَّق على الدرجة أياً كانت،
 * فتتبع الوضعين ولا تنحرف عن الخطّ الذي تحته إن تغيّرت اللوحة.
 */
export function softFill(color: string, percent = 12): string {
  return `color-mix(in oklab, ${color} ${percent}%, transparent)`;
}

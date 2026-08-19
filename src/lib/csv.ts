/* ============================================================
   CSV — قراءةً وكتابة.

   ولا حزمة: التنسيق كلُّه في `RFC 4180` صفحتان، وقواعدُه أربع — فاصلةٌ
   بين الحقول، وسطرٌ بين الصفوف، واقتباسٌ يحمي الاثنين، واقتباسان داخل
   المقتبس يعنيان اقتباساً واحداً. وحزمةٌ لهذا تُضاف إلى الحزمة المُرسَلة
   وتُصان، والمكتوب هنا يُقرأ في دقيقة.

   و«Excel» في نصوص الشاشات يعني هذا: الملفّ CSV، ويفتحه Excel جدولاً.
   ============================================================ */

/** علامةُ ترتيب البايتات — بدونها يقرأ Excel العربية محارفَ مبعثرة. */
const BOM = '﻿';

/* ═══ الصيغةُ لا تُنفَّذ ═══
 *
 * Excel يقرأ خليّةً تبدأ بـ`=` أو `+` أو `-` أو `@` صيغةً لا نصّاً، فيُنفّذ
 * ما فيها عند الفتح. وأسماءُ الموكّلين تأتي من الاستيراد ومن بيسكامب لا من
 * المكتب وحده — فاسمٌ يبدأ بإحداها يصير أمراً يُنفَّذ على جهاز من فتح
 * الملفّ. والفاصلةُ العليا قبله تجعله نصّاً عند Excel وتختفي من العرض،
 * وهي الحيلةُ المعتمدة لهذا.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** يحمي الحقل: يُقتبس إن حمل فاصلةً أو اقتباساً أو سطراً. */
function escapeField(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const text = FORMULA_LEAD.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** صفوفٌ إلى نصّ CSV، بترتيب الترويسة المُعطاة. */
export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(escapeField).join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeField(row[header])).join(','));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

/**
 * نصُّ CSV إلى صفوف مفهرسة بترويسته.
 *
 * القراءة محرفاً محرفاً لا `split(',')`: الفاصلةُ داخل الاقتباس جزءٌ من
 * القيمة لا فاصل — واسمُ شركةٍ فيه فاصلة يُمزّق الصفَّ كلَّه بالقسمة
 * الساذجة، فتنزلق الأعمدة ويُحفظ الهاتفُ في خانة البريد.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const source = text.startsWith(BOM) ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (source[i + 1] === '"') {
        field += '"';
        i++; // اقتباسان داخل المقتبس = اقتباسٌ واحد
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      // `\r\n` سطرٌ واحد لا سطران.
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // آخرُ صفٍّ بلا سطرٍ بعده لا يُهمل.
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  // الصفوف الفارغة تماماً تُسقط — Excel يُلحق سطراً في آخر الملفّ.
  const filled = rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
  if (filled.length < 2) return [];

  const headers = filled[0].map((header) => header.trim());
  return filled.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });
}

/** ينزّل نصّاً ملفّاً. والعنوان يُحرَّر بعد النقر وإلّا بقي في الذاكرة. */
export function downloadText(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

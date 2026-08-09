/* ============================================================
   مولّد `.xlsx` — ملفٌّ يفتحه Excel جدولاً، بأوراقٍ متعدّدة.

   ═══ لماذا كُتب ولم تُضَف حزمة ═══

   كانت الشاشة تَعِد بـ«Excel» وتُسلّم CSV بامتداد `.csv`، وتَعِد بـ«PDF»
   وتُسلّم نصّاً عادياً غُيّر امتدادُه. والوعدُ صيغةٌ والمُسلَّم أخرى.

   وملفّ `.xlsx` أرشيفُ ZIP فيه ملفّاتُ XML، ولا يلزم لكتابته ضغط: صيغة
   ZIP تقبل التخزين بلا ضغط (`method = 0`)، فيكفي جدولُ محتوياتٍ صحيح
   و`CRC-32` لكل عنصر. وهذا ما هنا: مئتا سطرٍ تُقرأ وتُختبر، مقابل حزمةٍ
   تُشحن إلى كل متصفّح وتُصان.

   والعربية تمرّ سليمةً: النصّ UTF-8 داخل XML، ولا شأن للاتجاه بالتخزين.
   ============================================================ */

/* ═══ CRC-32 ═══
   الجدول يُبنى مرّةً عند أول نداء: بناؤه في كل ملفّ يكرّر ٢٥٦ دورة بلا سبب. */
let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  CRC_TABLE = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ═══ ZIP بالتخزين لا بالضغط ═══ */

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

/** يكتب أرشيف ZIP: ترويسةٌ محلّية لكل عنصر، ثم دليلٌ مركزي، ثم خاتمته. */
function zip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const size = entry.bytes.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // توقيع الترويسة المحلّية
    lv.setUint16(4, 20, true); // أدنى نسخة لازمة
    lv.setUint16(6, 0x0800, true); // العَلَم: الأسماء UTF-8
    lv.setUint16(8, 0, true); // الطريقة: تخزينٌ بلا ضغط
    lv.setUint16(10, 0, true); // وقتُ التعديل — ثابتٌ فيخرج الملفّ نفسه لنفس المدخل
    lv.setUint16(12, 0x21, true); // تاريخُه: 1980-01-01
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // الحجم مضغوطاً = الحجم أصلاً
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true); // لا حقلَ إضافي
    local.set(name, 30);

    locals.push(local, entry.bytes);

    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true); // توقيع الدليل المركزي
    dv.setUint16(4, 20, true); // النسخة الكاتبة
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0x21, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, size, true);
    dv.setUint32(24, size, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true); // إزاحةُ ترويسته المحلّية
    dir.set(name, 46);
    central.push(dir);

    offset += local.length + size;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // توقيع خاتمة الدليل
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true); // بداية الدليل المركزي
  ev.setUint16(20, 0, true); // لا تعليق

  return new Blob([...locals, ...central, end], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/* ═══ XML ═══ */

/** يحمي النصّ داخل XML. والمحارف التي لا يقبلها XML 1.0 تُسقط. */
function xmlText(value: unknown): string {
  /* المحارف التحكّمية التي لا يقبلها XML 1.0 تُسقط — والمسموح منها الجدولة
     والسطر والإرجاع وحدها. وحرفٌ منها في خليّةٍ يُفسد الملفَّ كلَّه فلا يُفتح.
     ومكتوبةٌ بترميز `\u` لا بأنفسها: محرفٌ تحكّميّ حرفيّ في المصدر لا يُرى
     في المراجعة ويُنسخ بلا قصد. */
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * اسمُ ورقةٍ صالح.
 *
 * Excel يرفض `: \ / ? * [ ]` ويقصُر الاسم على ٣١ محرفاً — وورقةٌ باسمٍ
 * مخالف تُفسد الملفّ كلَّه، فلا يُفتح ولا يُقال السبب.
 */
function safeSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
  return cleaned || `ورقة${index + 1}`;
}

/** مرجعُ الخلية: (0,0) -> A1، و(0,26) -> AA1. */
function cellRef(row: number, col: number): string {
  let letters = '';
  for (let n = col + 1; n > 0; ) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${row + 1}`;
}

export interface Sheet {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

function sheetXml(sheet: Sheet): string {
  const lines: string[] = [];

  const headerCells = sheet.headers
    .map((header, col) => `<c r="${cellRef(0, col)}" t="inlineStr" s="1"><is><t>${xmlText(header)}</t></is></c>`)
    .join('');
  lines.push(`<row r="1">${headerCells}</row>`);

  sheet.rows.forEach((row, rowIndex) => {
    const cells = sheet.headers
      .map((header, col) => {
        const value = row[header];
        const ref = cellRef(rowIndex + 1, col);
        if (value === null || value === undefined || value === '') return '';
        /* الأرقام تُكتب أرقاماً لا نصّاً: عمودٌ نصّيٌّ لا يُجمع في Excel
           ولا يُرتَّب عددياً — وهو أكثر ما يُراد من جدول. */
        if (typeof value === 'number' && Number.isFinite(value)) {
          return `<c r="${ref}"><v>${value}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
      })
      .filter(Boolean)
      .join('');
    lines.push(`<row r="${rowIndex + 2}">${cells}</row>`);
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>
<sheetData>${lines.join('')}</sheetData>
</worksheet>`;
}

/**
 * دفترٌ من أوراق.
 *
 * `rightToLeft` على كل ورقة: الجدول عربيّ، فأوّلُ عمودٍ يمينُ الشاشة.
 * وهي خاصّيةُ عرضٍ في الملفّ لا تحويلٌ للنصّ.
 */
export function buildXlsx(sheets: Sheet[]): Blob {
  const encoder = new TextEncoder();
  const named = sheets.map((sheet, index) => ({ ...sheet, name: safeSheetName(sheet.name, index) }));

  const sheetEntries = named.map((sheet, index) => ({
    name: `xl/worksheets/sheet${index + 1}.xml`,
    bytes: encoder.encode(sheetXml(sheet)),
  }));

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${named
    .map((sheet, index) => `<sheet name="${xmlText(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')}</sheets>
</workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${named
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join('')}
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${named
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('')}
</Types>`;

  /* نمطان لا أكثر: العاديّ، والترويسةُ عريضة. و`s="1"` في صفّ الترويسة
     يشير إلى الثاني — والترقيم هنا هو ترتيب `cellXfs` نفسه. */
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>`;

  return zip([
    { name: '[Content_Types].xml', bytes: encoder.encode(contentTypes) },
    { name: '_rels/.rels', bytes: encoder.encode(rootRels) },
    { name: 'xl/workbook.xml', bytes: encoder.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', bytes: encoder.encode(workbookRels) },
    { name: 'xl/styles.xml', bytes: encoder.encode(styles) },
    ...sheetEntries,
  ]);
}

/** يبني الدفتر وينزّله. */
export function downloadXlsx(sheets: Sheet[], filename: string): void {
  const url = URL.createObjectURL(buildXlsx(sheets));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

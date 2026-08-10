/* بيئةُ Worker مُحاكاة: D1 على SQLite فعلية، وKV وR2 في الذاكرة.
 *
 * والمخطَّط يُحمَّل من ملفّات الهجرة نفسِها لا من نسخةٍ مكتوبةٍ هنا —
 * فعمودٌ يُضاف أو قيدٌ يتبدّل يظهر أثرُه في الاختبار قبل الإنتاج.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

/** يُحمِّل كلَّ الهجرات بترتيبها. */
export function freshDatabase() {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../../migrations/', import.meta.url);

  for (const file of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(file, dir), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    db.exec(sql);
  }
  return db;
}

/**
 * واجهةُ D1 فوق SQLite.
 *
 * و`all` و`first` و`run` **وعودٌ** لا قيمٌ مباشرة — كما هي في D1 فعلاً.
 * وهذا ليس تجميلاً: `display.js` تكتب آخر ظهورٍ بلا انتظار ثم
 * `‎.catch(…)‎` على الوعد، وبديلٌ يردّ كائناً متزامناً يسقط عندها بخطأ لا
 * علاقة له بالمنتج. فالبديل يحاكي D1 لا يبسّطها.
 */
export function d1(db) {
  /* أهذا استعلامُ قراءة؟ يُقرَّر من نصّه: `node:sqlite` يفرّق بين `all`
     و`run`، وD1 لا تفرّق — بيانُها الواحد يردّ الصفوفَ والإحصاء معاً. */
  const reads = (sql) => /^\s*(select|with|pragma)\b/i.test(sql);

  return {
    prepare(sql) {
      let bound = [];
      const statement = {
        sql,
        bind(...params) { bound = params; return statement; },
        async all() {
          return { results: db.prepare(sql).all(...bound), success: true };
        },
        async first(column) {
          const row = db.prepare(sql).get(...bound) ?? null;
          return column && row ? row[column] : row;
        },
        async run() {
          const result = db.prepare(sql).run(...bound);
          return {
            success: true,
            meta: {
              changes: Number(result.changes),
              last_row_id: Number(result.lastInsertRowid ?? 0),
            },
          };
        },
      };
      return statement;
    },

    /* ═══ الدفعةُ تردّ `meta` كما تردّها D1 ═══
       كانت تنادي `all()` على كل بيان — فحذفٌ في دفعةٍ يعود بلا `changes`،
       وكلُّ من يقرأ عددَ ما أصابه يقرأ صفراً. والبديلُ يحاكي D1 لا يبسّطها:
       بيانُ القراءة يردّ صفوفَه، وبيانُ الكتابة يردّ إحصاءه. */
    async batch(statements) {
      const out = [];
      for (const statement of statements) {
        out.push(reads(statement.sql) ? await statement.all() : await statement.run());
      }
      return out;
    },

    async exec(sql) { db.exec(sql); return { count: 1 }; },
  };
}

/** KV في الذاكرة — يفهم `'json'` ويتجاهل `expirationTtl` (لا زمنَ في الاختبار). */
export function kv() {
  const store = new Map();
  return {
    async get(key, type) {
      const value = store.get(key);
      if (value === undefined) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) { store.set(key, String(value)); },
    async delete(key) { store.delete(key); },
    async list({ prefix = '' } = {}) {
      return { keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) };
    },
    _store: store,
  };
}

/** R2 في الذاكرة. */
export function r2() {
  const store = new Map();
  return {
    async put(key, value, options) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value)
        : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
          : new TextEncoder().encode(String(value));
      store.set(key, { bytes, httpMetadata: options?.httpMetadata ?? {} });
      return { key, size: bytes.length };
    },
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        key,
        size: entry.bytes.length,
        httpMetadata: entry.httpMetadata,
        body: entry.bytes,
        async arrayBuffer() { return entry.bytes.buffer; },
        async text() { return new TextDecoder().decode(entry.bytes); },
        writeHttpMetadata(headers) {
          if (entry.httpMetadata.contentType) headers.set('content-type', entry.httpMetadata.contentType);
        },
      };
    },
    async head(key) {
      const entry = store.get(key);
      return entry ? { key, size: entry.bytes.length, httpMetadata: entry.httpMetadata } : null;
    },
    async delete(key) { store.delete(key); },
    async list({ prefix = '' } = {}) {
      return {
        objects: [...store.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, entry]) => ({ key, size: entry.bytes.length, uploaded: new Date(0) })),
        truncated: false,
      };
    },
    _store: store,
  };
}

/** الأصول الساكنة — يكفي أن تُميَّز عن ردّ JSON. */
export const assets = {
  async fetch() {
    return new Response('<!doctype html><title>naf</title>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  },
};

/** بيئةٌ كاملة. `extra` يضيف أو يطمس — كارتباط AI أو أسرار بيسكامب. */
export function makeEnv(db, extra = {}) {
  return {
    DB: d1(db),
    AUTH_KV: kv(),
    FILES: r2(),
    ASSETS: assets,
    PLATFORM_ID: 'naf-manger',
    AUTH_ISSUER: 'https://id.example',
    AUTH_CLIENT_SECRET: 'secret',
    DEFAULT_ROLE: 'staff',
    BOOTSTRAP_ADMIN_EMAIL: '',
    ...extra,
  };
}

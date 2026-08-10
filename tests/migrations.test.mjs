/* ═══ الهجرات تُجرَّب على قاعدةٍ فيها بيانات ═══
 *
 * كانت كلُّ الاختبارات تبني قاعدةً فارغة ثم تطبّق الهجرات كلَّها — فأيُّ
 * هجرةٍ تُتلف الصفوف تمرّ خضراء، إذ لا صفَّ فيها لِتُتلفه.
 *
 * وهذا ما وقع فعلاً: الهجرة العاشرة تعيد بناء جدول العملاء، و`DROP TABLE`
 * — والقيودُ مفعَّلة كما هي في D1 — يُجري حذفاً ضمنياً يُشعل
 * `ON DELETE CASCADE` على `cases.client_id`، ثم على
 * `commission_payments.case_id`. أي أنّ ترقيةً لإضافة عمودٍ **تمحو
 * القضايا والعمولات كلَّها**، وكلُّ الاختبارات خضراء.
 *
 * فهنا: تُطبَّق الهجرات إلى ما قبل كلِّ هجرة، وتُزرع صفوفٌ في الجداول
 * المترابطة، ثم تُطبَّق الهجرةُ ويُتحقَّق أنّ شيئاً لم يسقط. والقيود
 * مفعَّلة — بلا ذلك لا يُقاس شيء.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DIR = path.join(import.meta.dirname, '..', 'migrations');
const FILES = fs.readdirSync(DIR).filter((name) => name.endsWith('.sql')).sort();

/** قاعدةٌ مطبَّقٌ عليها ما قبل `stopAt`، والقيود مفعَّلة. */
function upTo(stopAt) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const name of FILES) {
    if (name === stopAt) break;
    db.exec(fs.readFileSync(path.join(DIR, name), 'utf8'));
  }
  return db;
}

/** صفوفٌ مترابطة: عميل ← قضيته ← عمولتها، ومشروعُ بيسكامب يشير إليهما. */
function seed(db) {
  const has = (table) =>
    db.prepare(`SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name=?`).get(table).n > 0;

  db.exec(`INSERT INTO clients (id, full_name, id_number, phone, created_at, updated_at)
           VALUES ('c-1', 'شركة الأفق', '1000000001', '0501234567', 1, 1)`);
  db.exec(`INSERT INTO prospects (id, full_name, id_number, created_at, updated_at)
           VALUES ('p-1', 'محتملٌ قديم', '1000000002', 1, 1)`);
  db.exec(`INSERT INTO cases (id, case_number, case_type, client_id, client_name, created_at, updated_at)
           VALUES ('k-1', 'ق-2020-1', 'قضية تجارية', 'c-1', 'شركة الأفق', 1, 1)`);
  db.exec(`INSERT INTO marketers (id, full_name, id_number, created_at, updated_at)
           VALUES ('m-1', 'مسوّق', '1000000003', 1, 1)`);
  db.exec(`INSERT INTO commission_payments (id, marketer_id, case_id, amount, payment_date, created_by, created_at)
           VALUES ('g-1', 'm-1', 'k-1', 5000, '2020-01-01', 'u-1', 1)`);

  if (has('basecamp_projects')) {
    db.exec(`INSERT INTO basecamp_projects
               (project_id, name, app_url, kind, client_id, case_id, created_at, updated_at)
             VALUES ('101', 'مشروع', 'https://x', 'client', 'c-1', 'k-1', 1, 1)`);
  }
}

const count = (db, table) => db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;

test('كلُّ هجرةٍ تُبقي ما قبلها من صفوف', () => {
  /* الهجرتان الأوليان تُنشئان الجداول، فلا صفَّ يُزرع قبلهما. */
  const rebuilds = FILES.filter((name) => !name.startsWith('0001') && !name.startsWith('0002'));

  for (const name of rebuilds) {
    const db = upTo(name);
    seed(db);

    const before = {
      clients: count(db, 'clients'),
      prospects: count(db, 'prospects'),
      cases: count(db, 'cases'),
      commissions: count(db, 'commission_payments'),
    };

    db.exec(fs.readFileSync(path.join(DIR, name), 'utf8'));

    for (const [table, column] of [
      ['clients', 'clients'],
      ['prospects', 'prospects'],
      ['cases', 'cases'],
      ['commission_payments', 'commissions'],
    ]) {
      assert.equal(
        count(db, table),
        before[column],
        `الهجرة ${name} أسقطت صفوفاً من ${table}: ${count(db, table)} بعد ${before[column]}`,
      );
    }

    db.close();
  }
});

test('والهجرة العاشرة تُبقي ربطَ القضية بعميلها وبمشروعها', () => {
  const db = upTo('0010_contacts_and_identity.sql');
  seed(db);
  db.exec(fs.readFileSync(path.join(DIR, '0010_contacts_and_identity.sql'), 'utf8'));

  const row = db.prepare(`SELECT client_id, case_number FROM cases WHERE id = 'k-1'`).get();
  assert.equal(row?.client_id, 'c-1', 'القضية فقدت عميلها');
  assert.equal(row?.case_number, 'ق-2020-1');

  const link = db.prepare(`SELECT client_id, case_id FROM basecamp_projects WHERE project_id = '101'`).get();
  assert.equal(link?.client_id, 'c-1', 'مشروعُ بيسكامب فقد عميله');
  assert.equal(link?.case_id, 'k-1', 'مشروعُ بيسكامب فقد قضيته');

  const commission = db.prepare(`SELECT case_id, amount FROM commission_payments WHERE id = 'g-1'`).get();
  assert.equal(commission?.case_id, 'k-1', 'العمولة فقدت قضيتها');
  assert.equal(commission?.amount, 5000);

  db.close();
});

test('ورقمُ الهوية المولَّد يُمحى ولا يبقى هويةً', () => {
  const db = upTo('0010_contacts_and_identity.sql');
  db.exec(`INSERT INTO clients (id, full_name, id_number, created_at, updated_at)
           VALUES ('c-9', 'موكّلٌ استُورد', 'BC-777', 1, 1)`);
  db.exec(fs.readFileSync(path.join(DIR, '0010_contacts_and_identity.sql'), 'utf8'));

  const row = db.prepare(`SELECT id_number FROM clients WHERE id = 'c-9'`).get();
  assert.equal(row?.id_number, null);

  /* وأكثرُ من واحدٍ بلا هوية يجتمعان: `UNIQUE` يقبل الغيابَ مكرّراً. */
  db.exec(`INSERT INTO clients (id, full_name, created_at, updated_at) VALUES ('c-10', 'بلا هوية', 1, 1)`);
  db.exec(`INSERT INTO clients (id, full_name, created_at, updated_at) VALUES ('c-11', 'بلا هوية كذلك', 1, 1)`);
  assert.equal(count(db, 'clients'), 3);

  db.close();
});

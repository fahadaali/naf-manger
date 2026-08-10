// المزامنة المجدولة — كلَّ ساعة، وبشرطين لا واحد.
//
// ═══ لماذا لا تعمل بمجرّد وجود ارتباط ═══
//
// هذه كتابةٌ في قاعدة موكّلين، تقع بلا أحدٍ يشاهدها. فلا تبدأ حتى:
//
//   ١) يُفتح `sync_enabled` صراحةً من الشاشة، و
//   ٢) تكون مزامنةٌ يدويةٌ ناجحة قد سبقتها — أي أنّ صاحب المكتب رأى
//      معاينةً وأكّدها، فعرف ما الذي سيُكتب قبل أن يُكتب بلا مشاهد.
//
// والشرطان يُفحصان في `setAutoSync` عند الفتح، وهنا عند كل تشغيل: إعدادٌ
// فُتح ثم فُكّ الارتباط لا ينبغي أن يبقى نافذاً.

import { activeConnection } from './oauth.js';
import { scanProjects } from './discover.js';
import { runSync } from './sync.js';

/**
 * دورةٌ واحدة: تمسح المشاريع ثم تزامن.
 *
 * والمسحُ يسبق المزامنة لأنّ مشروعاً جديداً في بيسكامب لا يُعرف إلا به —
 * وهو ما طُلب: «المشروع الجديد يظهر قضيةً في المنصة تلقائياً».
 *
 * ولا ترمي: `scheduled` لا مستمعَ لخطئه، ورميةٌ هنا تُسجَّل في Cloudflare
 * ولا تصل صاحبَ المكتب. فيُحفظ السبب في `last_sync_error` وتقرؤه الشاشة.
 */
export async function scheduledSync(env) {
  let connection;
  try {
    connection = await activeConnection(env);
  } catch (error) {
    console.error('Basecamp/cron: تعذّرت قراءة الاتّصال —', error?.message ?? error);
    return;
  }

  if (connection.error) {
    /* غيابُ الربط ليس عطلاً يُسجَّل كل ساعة: المنصة قد لا تستعمل بيسكامب
       أصلاً، وتلويثُ السجلّ يخفي ما يستحقّ القراءة. */
    if (connection.error !== 'not_configured' && connection.error !== 'not_connected') {
      console.error('Basecamp/cron:', connection.error);
      await env.DB.prepare(`UPDATE basecamp_connection SET last_sync_error = ? WHERE id = 1`)
        .bind(connection.error)
        .run()
        .catch(() => {});
    }
    return;
  }

  if (!connection.syncEnabled) return;

  const row = await env.DB.prepare(
    `SELECT last_sync_at FROM basecamp_connection WHERE id = 1`,
  ).first();

  /* شرطُ المزامنة اليدوية السابقة يُعاد فحصُه هنا: قاعدةٌ عُدِّلت بيدٍ
     خارج الشاشة قد تفتح العلم بلا أن يرى أحدٌ معاينةً. */
  if (!row?.last_sync_at) {
    console.warn('Basecamp/cron: الآلية مفتوحة بلا مزامنةٍ يدوية سابقة — تُترك');
    return;
  }

  try {
    await scanProjects(env, connection);
    const applied = await runSync(env, connection, {
      actorId: 'cron',
      actorName: 'المزامنة الآلية',
      source: 'آلي',
    });
    console.log(
      'Basecamp/cron:',
      `${applied.clientsCreated} عميلاً و${applied.casesCreated} قضيةً جديدة،`,
      `${applied.casesUpdated} محدَّثة، ${applied.conflicts} اختلافاً`,
    );
  } catch (error) {
    const reason = error?.code ?? error?.message ?? String(error);
    console.error('Basecamp/cron: تعذّرت المزامنة —', reason);
    await env.DB.prepare(
      `UPDATE basecamp_connection SET last_sync_error = ?, last_sync_at = last_sync_at WHERE id = 1`,
    )
      .bind(String(reason).slice(0, 300))
      .run()
      .catch(() => {});
  }

  /* ولا شيء يُكتب هنا عند النجاح: `runSync` تكتب `last_sync_at` بنفسها،
     وكتابتُه مرّتين تُغري بأن يُقرأ من موضعين فيفترقا. */
}

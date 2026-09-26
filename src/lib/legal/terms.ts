import { LEGAL_EMAIL, LEGAL_OPERATOR, type LegalDocs } from './types';

/**
 * Terms of Use — one entry per locale, identical section ids in the same
 * order (tests/legal-docs.test.ts enforces it). English is the binding text,
 * and section "law" says so.
 */
export const termsDocs: LegalDocs = {
  en: {
    title: 'Terms of Use',
    intro:
      'These are the rules for using Fursatly. They are short because the service is simple: we collect public announcements about opportunities, summarise them, and show them to you. By using the site you agree to what follows.',
    sections: [
      {
        id: 'who',
        heading: '1. Who we are and what you agree to',
        body: [
          `Fursatly (fursatly.uz) is operated by ${LEGAL_OPERATOR}, an individual based in Uzbekistan ("we", "us"). By visiting the site or creating an account you accept these Terms and our Privacy Policy. If you do not agree, please do not use the site.`,
        ],
      },
      {
        id: 'service',
        heading: '2. What Fursatly is',
        body: [
          'Fursatly is a free directory of scholarships, competitions, internships, summer programs and similar opportunities for students. Each listing is a summary of an announcement that was already public — typically posted on a Telegram channel or a website — rewritten and translated into English, Uzbek and Russian with the help of AI, and given an automatically generated page with eligibility notes, tips and links.',
          'We do not run any of the opportunities, do not take applications, and do not decide who gets selected.',
        ],
      },
      {
        id: 'accuracy',
        heading: '3. No guarantee of accuracy — always check the source',
        body: [
          'We try to keep listings correct, but deadlines change, programs get cancelled, and our summaries can contain mistakes. Before you apply, spend money, travel or rely on anything you read here, confirm it on the organiser\'s official page. Fursatly is a starting point, not the authority.',
          'We are not affiliated with, endorsed by, or acting on behalf of any organiser, university, company or government body whose opportunity appears on the site, unless a page says so explicitly.',
        ],
      },
      {
        id: 'ai',
        heading: '4. AI-generated content',
        body: [
          'Opportunity summaries, eligibility notes, tips, translations and the "mentor" chat are produced by AI language models. They can be wrong, outdated or incomplete, and they are not advice from a person. Treat them as a helpful draft to verify, never as the final word.',
        ],
      },
      {
        id: 'links',
        heading: '5. Links to other sites',
        body: [
          'Listings link to organisers\' websites, Telegram channels, forms and videos that we do not control. We are not responsible for their content, their privacy practices, or what happens when you use them.',
        ],
      },
      {
        id: 'accounts',
        heading: '6. Accounts',
        body: [
          '• You must be at least 13 years old to create an account. If you are under 18, get permission from a parent or guardian first.',
          '• Keep your sign-in details to yourself. You are responsible for what happens under your account.',
          '• Give us accurate information, and keep it accurate.',
          '• You can delete your account at any time from your account page.',
          '• We may suspend or delete an account that breaks these Terms.',
        ],
      },
      {
        id: 'use',
        heading: '7. What you may not do',
        body: [
          '• Scrape, crawl or bulk-download the site or its data without our written permission.',
          '• Try to break, overload or gain unauthorised access to the site, its accounts or its infrastructure.',
          '• Use the mentor chat or any other feature to generate or spread abusive, illegal or misleading content.',
          '• Pretend to be someone else, or misrepresent your connection to us or to any organiser.',
          '• Use the site for anything unlawful.',
        ],
      },
      {
        id: 'ip',
        heading: '8. Intellectual property',
        body: [
          'The Fursatly name, logo, design and code belong to us. The underlying opportunity information belongs to the organisers who published it; our summaries and translations of it are provided for personal, non-commercial use. You may share links to any page freely.',
        ],
      },
      {
        id: 'removal',
        heading: '9. Content removal requests',
        body: [
          `If you are an organiser, a channel owner or a rights holder and you want a listing corrected or removed — or if you believe a page infringes your rights — email ${LEGAL_EMAIL} with the page link and a short explanation. We act on such requests within 7 days, and we do not need a legal letter to do so.`,
        ],
      },
      {
        id: 'liability',
        heading: '10. Limitation of liability',
        body: [
          'Fursatly is provided free of charge, "as is" and "as available", without warranties of any kind. To the fullest extent permitted by law, we are not liable for any loss or damage arising from your use of the site, from errors or omissions in listings or AI-generated content, from decisions you make based on them, from third-party sites, or from the site being unavailable. Nothing in these Terms excludes liability that cannot be excluded by law.',
        ],
      },
      {
        id: 'changes',
        heading: '11. Changes to these Terms',
        body: [
          'We may update these Terms. When we do, we change the date at the top of the page. Continuing to use Fursatly after a change means you accept the new version.',
        ],
      },
      {
        id: 'law',
        heading: '12. Governing law and language',
        body: [
          'These Terms are governed by the laws of the Republic of Uzbekistan, and disputes are resolved in its courts. The Terms are published in English, Uzbek and Russian; if the versions differ, the English text prevails.',
        ],
      },
      {
        id: 'contact',
        heading: '13. Contact',
        body: [`${LEGAL_OPERATOR} — ${LEGAL_EMAIL}`],
      },
    ],
  },

  uz: {
    title: 'Foydalanish shartlari',
    intro:
      'Bu — Fursatly’dan foydalanish qoidalari. Ular qisqa, chunki xizmatning o‘zi oddiy: biz imkoniyatlar haqidagi ochiq e’lonlarni yig‘amiz, qisqacha bayon qilamiz va sizga ko‘rsatamiz. Saytdan foydalanish orqali quyidagilarga rozilik bildirasiz.',
    sections: [
      {
        id: 'who',
        heading: '1. Biz kimmiz va nimaga rozilik bildirasiz',
        body: [
          `Fursatly (fursatly.uz) saytini O‘zbekistonda yashovchi jismoniy shaxs ${LEGAL_OPERATOR} yuritadi («biz»). Saytga kirish yoki hisob ochish orqali siz ushbu Shartlar va Maxfiylik siyosatimizni qabul qilasiz. Rozi bo‘lmasangiz, iltimos, saytdan foydalanmang.`,
        ],
      },
      {
        id: 'service',
        heading: '2. Fursatly nima',
        body: [
          'Fursatly — talabalar uchun grantlar, tanlovlar, stajirovkalar, yozgi dasturlar va shunga o‘xshash imkoniyatlarning bepul katalogi. Har bir e’lon allaqachon ochiq bo‘lgan xabarning — odatda Telegram kanali yoki veb-saytda joylashtirilgan — qisqacha bayoni bo‘lib, AI yordamida ingliz, o‘zbek va rus tillariga qayta yozilgan va tarjima qilingan hamda unga avtomatik tarzda talablar, maslahatlar va havolalar bilan sahifa yaratilgan.',
          'Biz imkoniyatlarning birortasini o‘tkazmaymiz, arizalarni qabul qilmaymiz va kim tanlanishini hal qilmaymiz.',
        ],
      },
      {
        id: 'accuracy',
        heading: '3. Aniqlik kafolati yo‘q — doim manbani tekshiring',
        body: [
          'E’lonlarni to‘g‘ri saqlashga harakat qilamiz, lekin muddatlar o‘zgaradi, dasturlar bekor qilinadi va bayonlarimizda xatolar bo‘lishi mumkin. Ariza topshirish, pul sarflash, yo‘lga chiqish yoki bu yerda o‘qigan biror narsaga tayanishdan oldin uni tashkilotchining rasmiy sahifasida tasdiqlang. Fursatly — boshlang‘ich nuqta, yakuniy manba emas.',
          'Sahifada aniq ko‘rsatilmagan bo‘lsa, biz saytda imkoniyati chiqqan birorta tashkilotchi, universitet, kompaniya yoki davlat organi bilan bog‘liq emasmiz, ular tomonidan tasdiqlanmaganmiz va ular nomidan harakat qilmaymiz.',
        ],
      },
      {
        id: 'ai',
        heading: '4. AI yaratgan kontent',
        body: [
          'Imkoniyat bayonlari, talablar, maslahatlar, tarjimalar va «mentor» suhbati AI til modellari tomonidan yaratiladi. Ular noto‘g‘ri, eskirgan yoki to‘liqsiz bo‘lishi mumkin va ular inson maslahati emas. Ularni tekshirish kerak bo‘lgan foydali qoralama deb qabul qiling, hech qachon yakuniy so‘z deb emas.',
        ],
      },
      {
        id: 'links',
        heading: '5. Boshqa saytlarga havolalar',
        body: [
          'E’lonlar biz nazorat qilmaydigan tashkilotchilar saytlari, Telegram kanallari, formalar va videolarga havola beradi. Ularning mazmuni, maxfiylik amaliyoti yoki ulardan foydalanganingizda nima bo‘lishi uchun biz javobgar emasmiz.',
        ],
      },
      {
        id: 'accounts',
        heading: '6. Hisoblar',
        body: [
          '• Hisob ochish uchun kamida 13 yoshda bo‘lishingiz kerak. 18 yoshga to‘lmagan bo‘lsangiz, avval ota-onangiz yoki vasiyingizdan ruxsat oling.',
          '• Kirish ma’lumotlaringizni hech kimga bermang. Hisobingiz ostida sodir bo‘ladigan hamma narsa uchun siz javobgarsiz.',
          '• Bizga to‘g‘ri ma’lumot bering va uni dolzarb saqlang.',
          '• Hisobingizni istalgan vaqtda hisob sahifasidan o‘chirishingiz mumkin.',
          '• Ushbu Shartlarni buzgan hisobni to‘xtatib qo‘yishimiz yoki o‘chirishimiz mumkin.',
        ],
      },
      {
        id: 'use',
        heading: '7. Nima qilish mumkin emas',
        body: [
          '• Bizning yozma ruxsatimizsiz saytni yoki uning ma’lumotlarini skreyp qilish, kroul qilish yoki ommaviy yuklab olish.',
          '• Saytni, hisoblarni yoki infratuzilmani buzishga, ortiqcha yuklashga yoki ruxsatsiz kirishga urinish.',
          '• Mentor suhbati yoki boshqa funksiyadan haqoratli, noqonuniy yoki chalg‘ituvchi kontent yaratish yoki tarqatish uchun foydalanish.',
          '• O‘zini boshqa shaxs sifatida ko‘rsatish yoki biz bilan yoki biror tashkilotchi bilan aloqangizni noto‘g‘ri ko‘rsatish.',
          '• Saytdan noqonuniy maqsadlarda foydalanish.',
        ],
      },
      {
        id: 'ip',
        heading: '8. Intellektual mulk',
        body: [
          'Fursatly nomi, logotipi, dizayni va kodi bizga tegishli. Imkoniyat haqidagi asl ma’lumot uni e’lon qilgan tashkilotchilarga tegishli; bizning bayon va tarjimalarimiz shaxsiy, notijorat foydalanish uchun taqdim etiladi. Istalgan sahifa havolasini erkin ulashishingiz mumkin.',
        ],
      },
      {
        id: 'removal',
        heading: '9. Kontentni olib tashlash so‘rovlari',
        body: [
          `Agar siz tashkilotchi, kanal egasi yoki huquq egasi bo‘lsangiz va e’lonni tuzatish yoki olib tashlashni istasangiz — yoki biror sahifa huquqlaringizni buzadi deb hisoblasangiz — sahifa havolasi va qisqacha izoh bilan ${LEGAL_EMAIL} manziliga yozing. Bunday so‘rovlar bo‘yicha 7 kun ichida chora ko‘ramiz va buning uchun yuridik xat talab qilmaymiz.`,
        ],
      },
      {
        id: 'liability',
        heading: '10. Javobgarlikni cheklash',
        body: [
          'Fursatly bepul, «qanday bo‘lsa shunday» va «mavjud bo‘lganda» tamoyilida, hech qanday kafolatsiz taqdim etiladi. Qonun ruxsat bergan eng to‘liq darajada biz saytdan foydalanishingiz, e’lonlar yoki AI yaratgan kontentdagi xato va kamchiliklar, ular asosida qabul qilgan qarorlaringiz, uchinchi tomon saytlari yoki saytning ishlamay qolishi natijasida yuzaga kelgan har qanday zarar uchun javobgar emasmiz. Ushbu Shartlardagi hech narsa qonun bo‘yicha istisno qilib bo‘lmaydigan javobgarlikni istisno qilmaydi.',
        ],
      },
      {
        id: 'changes',
        heading: '11. Shartlardagi o‘zgarishlar',
        body: [
          'Ushbu Shartlarni yangilashimiz mumkin. Yangilaganimizda sahifa tepasidagi sanani o‘zgartiramiz. O‘zgarishdan keyin Fursatly’dan foydalanishni davom ettirish yangi versiyani qabul qilganingizni bildiradi.',
        ],
      },
      {
        id: 'law',
        heading: '12. Qo‘llaniladigan qonun va til',
        body: [
          'Ushbu Shartlar O‘zbekiston Respublikasi qonunlari bilan tartibga solinadi va nizolar uning sudlarida hal qilinadi. Shartlar ingliz, o‘zbek va rus tillarida e’lon qilingan; versiyalar farq qilsa, inglizcha matn ustunlik qiladi.',
        ],
      },
      {
        id: 'contact',
        heading: '13. Aloqa',
        body: [`${LEGAL_OPERATOR} — ${LEGAL_EMAIL}`],
      },
    ],
  },

  ru: {
    title: 'Условия использования',
    intro:
      'Это правила использования Fursatly. Они короткие, потому что сервис прост: мы собираем открытые объявления о возможностях, кратко пересказываем их и показываем вам. Используя сайт, вы соглашаетесь с тем, что написано ниже.',
    sections: [
      {
        id: 'who',
        heading: '1. Кто мы и с чем вы соглашаетесь',
        body: [
          `Сайт Fursatly (fursatly.uz) ведёт ${LEGAL_OPERATOR}, физическое лицо, проживающее в Узбекистане («мы»). Посещая сайт или создавая аккаунт, вы принимаете настоящие Условия и нашу Политику конфиденциальности. Если вы не согласны, пожалуйста, не пользуйтесь сайтом.`,
        ],
      },
      {
        id: 'service',
        heading: '2. Что такое Fursatly',
        body: [
          'Fursatly — бесплатный каталог стипендий, конкурсов, стажировок, летних программ и похожих возможностей для студентов. Каждая запись — это краткий пересказ уже публичного объявления, обычно размещённого в Telegram-канале или на сайте, переписанный и переведённый на английский, узбекский и русский с помощью ИИ, с автоматически созданной страницей, где указаны требования, советы и ссылки.',
          'Мы не проводим ни одну из возможностей, не принимаем заявки и не решаем, кого выберут.',
        ],
      },
      {
        id: 'accuracy',
        heading: '3. Точность не гарантируется — всегда проверяйте источник',
        body: [
          'Мы стараемся поддерживать записи в актуальном виде, но дедлайны меняются, программы отменяются, а в наших пересказах бывают ошибки. Прежде чем подавать заявку, тратить деньги, ехать куда-либо или полагаться на что-то прочитанное здесь, проверьте это на официальной странице организатора. Fursatly — отправная точка, а не первоисточник.',
          'Мы не связаны ни с одним организатором, университетом, компанией или государственным органом, чья возможность есть на сайте, не одобрены ими и не действуем от их имени, если на странице прямо не сказано иное.',
        ],
      },
      {
        id: 'ai',
        heading: '4. Контент, созданный ИИ',
        body: [
          'Описания возможностей, требования, советы, переводы и чат «наставника» создаются языковыми моделями ИИ. Они могут быть ошибочными, устаревшими или неполными и не являются советом человека. Относитесь к ним как к полезному черновику, который нужно проверить, а не как к окончательному ответу.',
        ],
      },
      {
        id: 'links',
        heading: '5. Ссылки на другие сайты',
        body: [
          'Записи ведут на сайты организаторов, Telegram-каналы, формы и видео, которые мы не контролируем. Мы не отвечаем за их содержание, их практику конфиденциальности и за то, что происходит при их использовании.',
        ],
      },
      {
        id: 'accounts',
        heading: '6. Аккаунты',
        body: [
          '• Для создания аккаунта вам должно быть не меньше 13 лет. Если вам нет 18, сначала получите разрешение родителя или опекуна.',
          '• Никому не передавайте данные для входа. Вы отвечаете за всё, что происходит под вашим аккаунтом.',
          '• Указывайте достоверные сведения и поддерживайте их актуальность.',
          '• Вы можете удалить аккаунт в любой момент на странице аккаунта.',
          '• Мы можем приостановить или удалить аккаунт, нарушающий настоящие Условия.',
        ],
      },
      {
        id: 'use',
        heading: '7. Что делать нельзя',
        body: [
          '• Собирать, сканировать или массово скачивать сайт или его данные без нашего письменного разрешения.',
          '• Пытаться сломать, перегрузить сайт или получить несанкционированный доступ к нему, аккаунтам или инфраструктуре.',
          '• Использовать чат наставника или другие функции для создания или распространения оскорбительного, незаконного или вводящего в заблуждение контента.',
          '• Выдавать себя за другого или искажать свою связь с нами или с каким-либо организатором.',
          '• Использовать сайт в незаконных целях.',
        ],
      },
      {
        id: 'ip',
        heading: '8. Интеллектуальная собственность',
        body: [
          'Название, логотип, дизайн и код Fursatly принадлежат нам. Исходная информация о возможностях принадлежит опубликовавшим её организаторам; наши пересказы и переводы предоставляются для личного, некоммерческого использования. Ссылками на любые страницы можно свободно делиться.',
        ],
      },
      {
        id: 'removal',
        heading: '9. Запросы на удаление контента',
        body: [
          `Если вы организатор, владелец канала или правообладатель и хотите исправить или удалить запись — или считаете, что страница нарушает ваши права, — напишите на ${LEGAL_EMAIL}, указав ссылку на страницу и краткое пояснение. Мы реагируем на такие запросы в течение 7 дней, и юридическое письмо для этого не требуется.`,
        ],
      },
      {
        id: 'liability',
        heading: '10. Ограничение ответственности',
        body: [
          'Fursatly предоставляется бесплатно, «как есть» и «по мере доступности», без каких-либо гарантий. В максимальной степени, разрешённой законом, мы не несём ответственности за любой ущерб, возникший из-за использования сайта, ошибок или пропусков в записях и контенте ИИ, принятых на их основе решений, сторонних сайтов или недоступности сайта. Ничто в настоящих Условиях не исключает ответственность, которую нельзя исключить по закону.',
        ],
      },
      {
        id: 'changes',
        heading: '11. Изменения Условий',
        body: [
          'Мы можем обновлять настоящие Условия. При обновлении мы меняем дату вверху страницы. Продолжение использования Fursatly после изменения означает, что вы принимаете новую версию.',
        ],
      },
      {
        id: 'law',
        heading: '12. Применимое право и язык',
        body: [
          'Настоящие Условия регулируются законодательством Республики Узбекистан, споры разрешаются в её судах. Условия опубликованы на английском, узбекском и русском языках; при расхождении версий преимущество имеет английский текст.',
        ],
      },
      {
        id: 'contact',
        heading: '13. Контакты',
        body: [`${LEGAL_OPERATOR} — ${LEGAL_EMAIL}`],
      },
    ],
  },
};

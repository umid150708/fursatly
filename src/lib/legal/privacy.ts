import { LEGAL_EMAIL, LEGAL_OPERATOR, type LegalDocs } from './types';

/**
 * Privacy Policy — one entry per locale, identical section ids in the same
 * order (tests/legal-docs.test.ts enforces it). English is the binding text.
 *
 * Keep this honest: it describes what the code actually does. If a feature
 * starts collecting something new, add it here in the same change.
 */
export const privacyDocs: LegalDocs = {
  en: {
    title: 'Privacy Policy',
    intro:
      'Fursatly is a free site that lists scholarships, competitions and programs for students. This page explains what information the site keeps about you, why, who else handles it, and what you can do about it. It is written in plain language on purpose.',
    sections: [
      {
        id: 'who',
        heading: '1. Who runs Fursatly',
        body: [
          `Fursatly (fursatly.uz) is operated by ${LEGAL_OPERATOR}, an individual based in Uzbekistan. For anything to do with your data, write to ${LEGAL_EMAIL}.`,
        ],
      },
      {
        id: 'collect',
        heading: '2. What we collect and why',
        body: [
          'You can read every opportunity without an account. If you never sign in, the only things below that apply to you are "Preferences" and "Analytics".',
          '• Account. When you create an account we store the email address you sign up with. If you sign in with Google, Google also sends us your name and profile picture. If you sign in with or connect Telegram, Telegram sends us your Telegram ID, username and the name and photo on your Telegram profile. We use these to sign you in and to show your name on your account page.',
          '• Profile (optional). You may add your age, country and interests. They are used only to give the AI mentor context about you. You can leave them blank or remove them at any time.',
          '• Saved opportunities. The list of opportunities you bookmark, so you can find them again.',
          '• Deadline reminders. If you connect Telegram, we keep your Telegram chat ID and send you a message 3 days and 1 day before a saved opportunity closes. You can switch reminders off on your account page at any time.',
          '• AI mentor. When you chat with the mentor on an opportunity page, your messages, that opportunity\'s details and your profile fields (name, age, country, interests) are sent to an AI provider — Groq or Google — to generate the reply. We do not store your conversation. We keep only a daily count of how many messages you sent, to limit abuse.',
          '• Preferences. Your language and light/dark choice are saved in your browser\'s local storage, not on our servers.',
          '• Analytics. We use Vercel Web Analytics, which counts page views without cookies and without building a profile of you. Our hosting provider also keeps ordinary server logs (such as IP addresses) for a short time, as every website host does.',
          'We do not sell your data, do not show advertising, and do not share your data with the organisations behind the opportunities.',
        ],
      },
      {
        id: 'cookies',
        heading: '3. Cookies',
        body: [
          'Fursatly sets one cookie, and only when you sign in: the session cookie from our authentication provider (Supabase) that keeps you logged in. It is strictly necessary for the account to work, which is why there is no cookie banner. We use no advertising, tracking or social-media cookies. Signing out or clearing your browser data removes the cookie.',
        ],
      },
      {
        id: 'processors',
        heading: '4. Who else handles your data',
        body: [
          'We run Fursatly on services provided by other companies. Each one only sees what it needs to do its job:',
          '• Supabase, Inc. — database and sign-in (stores your account, profile and saved list).',
          '• Vercel, Inc. — hosting and cookieless analytics.',
          '• Groq, Inc. and Google LLC — AI models that generate the opportunity summaries, translations and mentor replies. Google also provides "Sign in with Google".',
          '• Telegram — sign-in, account linking and reminder messages.',
          'Their servers are located outside Uzbekistan, including in the United States and the European Union. By using the account features you agree to your data being stored and processed there.',
        ],
      },
      {
        id: 'retention',
        heading: '5. How long we keep it',
        body: [
          'Your account, profile and saved list stay until you delete your account. Opportunities are removed automatically once their deadline passes, and any saved entries pointing at them go with them. The daily mentor message counts are kept per day and become meaningless after that. Server logs are kept by the hosting provider for its standard short period.',
        ],
      },
      {
        id: 'rights',
        heading: '6. Your rights',
        body: [
          '• See and correct your data — everything we hold is on your account page, where you can edit it.',
          '• Delete your account — use the "Delete account" button on your account page. It permanently removes your profile, saved list, reminder settings and Telegram link. Or email us and we will do it for you.',
          '• Stop reminders — turn them off on your account page or disconnect Telegram.',
          '• Ask questions or complain — write to ' + LEGAL_EMAIL + '. We reply within 30 days. You may also complain to the personal-data authority in your country.',
        ],
      },
      {
        id: 'children',
        heading: '7. Children',
        body: [
          'You must be at least 13 to create an account. If you are under 18, please ask a parent or guardian before signing up. If we learn that a child under 13 has created an account, we will delete it.',
        ],
      },
      {
        id: 'changes',
        heading: '8. Changes and contact',
        body: [
          `If this policy changes we update the date at the top of the page. Questions about privacy go to ${LEGAL_OPERATOR} at ${LEGAL_EMAIL}.`,
        ],
      },
    ],
  },

  uz: {
    title: 'Maxfiylik siyosati',
    intro:
      'Fursatly — talabalar uchun grantlar, tanlovlar va dasturlarni jamlaydigan bepul sayt. Bu sahifa sayt siz haqingizda qanday ma’lumot saqlashini, nima uchun, kim bilan ishlashini va siz nima qila olishingizni tushuntiradi. Ataylab oddiy tilda yozilgan.',
    sections: [
      {
        id: 'who',
        heading: '1. Fursatly’ni kim yuritadi',
        body: [
          `Fursatly (fursatly.uz) saytini O‘zbekistonda yashovchi jismoniy shaxs ${LEGAL_OPERATOR} yuritadi. Ma’lumotlaringizga oid har qanday savol bo‘yicha ${LEGAL_EMAIL} manziliga yozing.`,
        ],
      },
      {
        id: 'collect',
        heading: '2. Nimani va nima uchun yig‘amiz',
        body: [
          'Barcha imkoniyatlarni hisobsiz ham o‘qishingiz mumkin. Agar hech qachon tizimga kirmasangiz, quyidagilardan faqat «Sozlamalar» va «Analitika» sizga tegishli.',
          '• Hisob. Hisob ochganingizda ro‘yxatdan o‘tgan elektron pochta manzilingizni saqlaymiz. Google orqali kirsangiz, Google bizga ismingiz va profil rasmingizni ham yuboradi. Telegram orqali kirsangiz yoki ulasangiz, Telegram bizga Telegram ID, foydalanuvchi nomi hamda profilingizdagi ism va rasmni yuboradi. Bulardan sizni tizimga kiritish va hisob sahifasida ismingizni ko‘rsatish uchun foydalanamiz.',
          '• Profil (ixtiyoriy). Yoshingiz, mamlakatingiz va qiziqishlaringizni qo‘shishingiz mumkin. Ular faqat AI-mentorga siz haqingizda kontekst berish uchun ishlatiladi. Ularni bo‘sh qoldirishingiz yoki istalgan vaqtda o‘chirishingiz mumkin.',
          '• Saqlangan imkoniyatlar. Keyin qayta topishingiz uchun belgilab qo‘ygan imkoniyatlar ro‘yxati.',
          '• Muddat eslatmalari. Telegramni ulasangiz, Telegram chat ID’ingizni saqlaymiz va saqlangan imkoniyat yopilishidan 3 kun va 1 kun oldin xabar yuboramiz. Eslatmalarni hisob sahifasida istalgan vaqt o‘chirib qo‘yishingiz mumkin.',
          '• AI-mentor. Imkoniyat sahifasida mentor bilan suhbatlashganingizda xabarlaringiz, o‘sha imkoniyat tafsilotlari va profil maydonlaringiz (ism, yosh, mamlakat, qiziqishlar) javob yaratish uchun AI provayderiga — Groq yoki Google’ga — yuboriladi. Suhbatingizni saqlamaymiz. Suiiste’molni cheklash uchun faqat kuniga nechta xabar yuborganingiz sonini saqlaymiz.',
          '• Sozlamalar. Til va yorug‘/qorong‘i rejim tanlovingiz serverimizda emas, brauzeringizning lokal xotirasida saqlanadi.',
          '• Analitika. Vercel Web Analytics’dan foydalanamiz — u sahifa ko‘rishlarini cookie’siz va siz haqingizda profil tuzmasdan hisoblaydi. Hosting provayderimiz ham, har qanday sayt hostingi kabi, oddiy server jurnallarini (masalan, IP-manzillarni) qisqa muddat saqlaydi.',
          'Ma’lumotlaringizni sotmaymiz, reklama ko‘rsatmaymiz va imkoniyatlar ortidagi tashkilotlarga ma’lumotlaringizni bermaymiz.',
        ],
      },
      {
        id: 'cookies',
        heading: '3. Cookie-fayllar',
        body: [
          'Fursatly faqat bitta cookie o‘rnatadi, u ham tizimga kirganingizdagina: autentifikatsiya provayderimiz (Supabase) sessiya cookie’si, u sizni tizimda ushlab turadi. Hisob ishlashi uchun u zarur, shuning uchun cookie-banner yo‘q. Reklama, kuzatuv yoki ijtimoiy tarmoq cookie’laridan foydalanmaymiz. Tizimdan chiqish yoki brauzer ma’lumotlarini tozalash cookie’ni o‘chiradi.',
        ],
      },
      {
        id: 'processors',
        heading: '4. Ma’lumotlaringiz bilan yana kim ishlaydi',
        body: [
          'Fursatly boshqa kompaniyalar xizmatlarida ishlaydi. Har biri faqat o‘z vazifasi uchun kerak bo‘lgan narsani ko‘radi:',
          '• Supabase, Inc. — ma’lumotlar bazasi va tizimga kirish (hisob, profil va saqlangan ro‘yxatni saqlaydi).',
          '• Vercel, Inc. — hosting va cookie’siz analitika.',
          '• Groq, Inc. va Google LLC — imkoniyat tavsiflari, tarjimalar va mentor javoblarini yaratadigan AI modellari. Google shuningdek «Google orqali kirish»ni ta’minlaydi.',
          '• Telegram — tizimga kirish, hisobni ulash va eslatma xabarlari.',
          'Ularning serverlari O‘zbekistondan tashqarida, jumladan AQSH va Yevropa Ittifoqida joylashgan. Hisob funksiyalaridan foydalanish orqali ma’lumotlaringiz o‘sha yerda saqlanishi va qayta ishlanishiga rozilik bildirasiz.',
        ],
      },
      {
        id: 'retention',
        heading: '5. Qancha vaqt saqlaymiz',
        body: [
          'Hisobingiz, profilingiz va saqlangan ro‘yxat hisobni o‘chirmaguningizcha saqlanadi. Imkoniyatlar muddati o‘tgach avtomatik o‘chiriladi va ularga ishora qiluvchi saqlangan yozuvlar ham birga ketadi. Mentor xabarlari soni kunlik saqlanadi va shundan keyin ma’nosini yo‘qotadi. Server jurnallarini hosting provayderi o‘zining odatiy qisqa muddatida saqlaydi.',
        ],
      },
      {
        id: 'rights',
        heading: '6. Huquqlaringiz',
        body: [
          '• Ma’lumotlaringizni ko‘rish va tuzatish — biz saqlayotgan hamma narsa hisob sahifangizda, u yerda tahrirlashingiz mumkin.',
          '• Hisobni o‘chirish — hisob sahifasidagi «Hisobni o‘chirish» tugmasidan foydalaning. U profil, saqlangan ro‘yxat, eslatma sozlamalari va Telegram ulanishini butunlay o‘chiradi. Yoki bizga yozing, biz o‘zimiz o‘chiramiz.',
          '• Eslatmalarni to‘xtatish — hisob sahifasida o‘chirib qo‘ying yoki Telegramni uzing.',
          '• Savol berish yoki shikoyat qilish — ' + LEGAL_EMAIL + ' manziliga yozing. 30 kun ichida javob beramiz. Shuningdek, mamlakatingizdagi shaxsiy ma’lumotlar bo‘yicha vakolatli organga murojaat qilishingiz mumkin.',
        ],
      },
      {
        id: 'children',
        heading: '7. Bolalar',
        body: [
          'Hisob ochish uchun kamida 13 yoshda bo‘lishingiz kerak. 18 yoshga to‘lmagan bo‘lsangiz, ro‘yxatdan o‘tishdan oldin ota-onangiz yoki vasiyingizdan so‘rang. 13 yoshga to‘lmagan bola hisob ochganini bilsak, uni o‘chiramiz.',
        ],
      },
      {
        id: 'changes',
        heading: '8. O‘zgarishlar va aloqa',
        body: [
          `Bu siyosat o‘zgarsa, sahifa tepasidagi sanani yangilaymiz. Maxfiylik bo‘yicha savollar ${LEGAL_OPERATOR}ga ${LEGAL_EMAIL} manzili orqali yuboriladi.`,
        ],
      },
    ],
  },

  ru: {
    title: 'Политика конфиденциальности',
    intro:
      'Fursatly — бесплатный сайт, который собирает стипендии, конкурсы и программы для студентов. На этой странице объясняется, какие сведения о вас сайт хранит, зачем, кто ещё с ними работает и что вы можете с этим сделать. Она намеренно написана простым языком.',
    sections: [
      {
        id: 'who',
        heading: '1. Кто управляет Fursatly',
        body: [
          `Сайт Fursatly (fursatly.uz) ведёт ${LEGAL_OPERATOR}, физическое лицо, проживающее в Узбекистане. По любым вопросам о ваших данных пишите на ${LEGAL_EMAIL}.`,
        ],
      },
      {
        id: 'collect',
        heading: '2. Что мы собираем и зачем',
        body: [
          'Все возможности можно читать без аккаунта. Если вы никогда не входите в систему, из перечисленного ниже к вам относятся только «Настройки» и «Аналитика».',
          '• Аккаунт. При создании аккаунта мы сохраняем адрес электронной почты, с которым вы зарегистрировались. Если вы входите через Google, Google также передаёт нам ваше имя и фото профиля. Если вы входите через Telegram или подключаете его, Telegram передаёт нам ваш Telegram ID, имя пользователя, а также имя и фото из вашего профиля. Мы используем это, чтобы выполнить вход и показать ваше имя на странице аккаунта.',
          '• Профиль (необязательно). Вы можете указать возраст, страну и интересы. Они используются только для того, чтобы дать ИИ-наставнику контекст о вас. Их можно не заполнять или удалить в любой момент.',
          '• Сохранённые возможности. Список возможностей, которые вы добавили в закладки, чтобы вернуться к ним позже.',
          '• Напоминания о дедлайнах. Если вы подключите Telegram, мы сохраним ваш chat ID и отправим сообщение за 3 дня и за 1 день до закрытия сохранённой возможности. Напоминания можно отключить на странице аккаунта в любой момент.',
          '• ИИ-наставник. Когда вы общаетесь с наставником на странице возможности, ваши сообщения, сведения об этой возможности и поля вашего профиля (имя, возраст, страна, интересы) отправляются провайдеру ИИ — Groq или Google — для генерации ответа. Переписку мы не храним. Мы сохраняем только дневной счётчик отправленных сообщений, чтобы ограничить злоупотребления.',
          '• Настройки. Выбранный язык и светлая/тёмная тема сохраняются в локальном хранилище вашего браузера, а не на наших серверах.',
          '• Аналитика. Мы используем Vercel Web Analytics — сервис считает просмотры страниц без cookie и не составляет ваш профиль. Хостинг-провайдер также недолго хранит обычные серверные логи (например, IP-адреса), как любой хостинг.',
          'Мы не продаём ваши данные, не показываем рекламу и не передаём ваши данные организациям, стоящим за возможностями.',
        ],
      },
      {
        id: 'cookies',
        heading: '3. Cookie',
        body: [
          'Fursatly ставит один cookie, и только при входе в систему: сессионный cookie нашего провайдера аутентификации (Supabase), который держит вас в системе. Он строго необходим для работы аккаунта, поэтому баннера о cookie нет. Мы не используем рекламные, отслеживающие или социальные cookie. Выход из аккаунта или очистка данных браузера удаляет этот cookie.',
        ],
      },
      {
        id: 'processors',
        heading: '4. Кто ещё работает с вашими данными',
        body: [
          'Fursatly работает на сервисах других компаний. Каждая видит только то, что нужно для её задачи:',
          '• Supabase, Inc. — база данных и вход в систему (хранит аккаунт, профиль и список сохранённого).',
          '• Vercel, Inc. — хостинг и аналитика без cookie.',
          '• Groq, Inc. и Google LLC — модели ИИ, которые создают описания возможностей, переводы и ответы наставника. Google также обеспечивает «Вход через Google».',
          '• Telegram — вход, привязка аккаунта и сообщения-напоминания.',
          'Их серверы находятся за пределами Узбекистана, в том числе в США и Европейском союзе. Используя функции аккаунта, вы соглашаетесь с тем, что ваши данные хранятся и обрабатываются там.',
        ],
      },
      {
        id: 'retention',
        heading: '5. Как долго мы храним данные',
        body: [
          'Аккаунт, профиль и список сохранённого хранятся, пока вы не удалите аккаунт. Возможности удаляются автоматически после истечения дедлайна, вместе с ними исчезают и ссылающиеся на них сохранённые записи. Дневные счётчики сообщений наставнику хранятся по дням и после этого теряют смысл. Серверные логи хостинг-провайдер хранит свой стандартный короткий срок.',
        ],
      },
      {
        id: 'rights',
        heading: '6. Ваши права',
        body: [
          '• Посмотреть и исправить данные — всё, что мы храним, находится на странице аккаунта, где это можно отредактировать.',
          '• Удалить аккаунт — используйте кнопку «Удалить аккаунт» на странице аккаунта. Она навсегда удаляет профиль, список сохранённого, настройки напоминаний и привязку Telegram. Либо напишите нам, и мы сделаем это за вас.',
          '• Остановить напоминания — отключите их на странице аккаунта или отвяжите Telegram.',
          '• Задать вопрос или пожаловаться — напишите на ' + LEGAL_EMAIL + '. Мы отвечаем в течение 30 дней. Вы также можете обратиться в орган по защите персональных данных вашей страны.',
        ],
      },
      {
        id: 'children',
        heading: '7. Дети',
        body: [
          'Для создания аккаунта вам должно быть не меньше 13 лет. Если вам нет 18, спросите разрешения у родителя или опекуна перед регистрацией. Если мы узнаем, что аккаунт создал ребёнок младше 13 лет, мы удалим его.',
        ],
      },
      {
        id: 'changes',
        heading: '8. Изменения и контакты',
        body: [
          `Если политика меняется, мы обновляем дату вверху страницы. Вопросы о конфиденциальности направляйте ${LEGAL_OPERATOR} на ${LEGAL_EMAIL}.`,
        ],
      },
    ],
  },
};

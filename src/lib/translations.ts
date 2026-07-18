export type Locale = 'uz' | 'en' | 'ru';

import { canonicalSource, type CanonicalSource } from './canonicalCategory';

export const translations = {
  en: {
    // Hero
    heroTitle: 'Unlock Your Future',
    heroSubtitle: 'Discover the best scholarships, competitions and programs tailored for your success.',
    activeEvents: 'Active Opportunities',

    // Search & Filters
    searchPlaceholder: 'Search opportunities...',
    filterTitle: 'Filter',
    all: 'All',
    location: 'Location',
    language: 'Language',
    age: 'Age Range',
    minAge: 'min',
    maxAge: 'max',
    fundingCoverage: 'Funding Coverage',
    fundingAny: 'Any',
    fundingFull: 'Full',
    fundingPartial: 'Partial',
    deadline: 'Deadline',
    deadlineAny: 'Any time',
    deadlineWeek: 'This week',
    deadlineMonth: 'This month',
    deadline3Months: '3 months',
    resetAll: 'Reset All',
    locUzbekistan: 'Uzbekistan',
    locOnline: 'Online',
    locAbroad: 'Abroad',
    resultsLabel: 'results',
    showResults: 'Show results',

    // Cards
    moreInfo: 'More info',
    fullyFunded: 'Fully Funded',
    partial: 'Partial',

    // Category view
    viewAll: 'View All',
    closeCategory: 'Close Category',

    // Loading / empty
    loading: 'Finding opportunities...',
    noEvents: 'No opportunities found',
    clearFilters: 'Clear all filters',

    // Categories
    catAll: 'All',
    catScholarships: 'Scholarships',
    catCompetitions: 'Competitions',
    catSummerPrograms: 'Summer Programs',
    catResearch: 'Research',
    catVolunteer: 'Volunteer',
    catSTEM: 'STEM',
    catInternships: 'Internships',
    catWorkshops: 'Workshops',

    // Footer
    footerDesc: 'Connecting young people across Central Asia with scholarships, competitions, and opportunities.',
    footerPlatform: 'Platform',
    footerBrowse: 'Browse Opportunities',
    footerLegal: 'Legal',
    footerPrivacy: 'Privacy Policy',
    footerTerms: 'Terms of Use',
    footerCookies: 'Cookie Policy',
    footerAbout: 'About Us',
    footerRights: 'All rights reserved.',
    footerTagline: 'Built for the youth of Central Asia',

    // Event detail page
    backToOpportunities: 'Back to Opportunities',
    organisedBy: 'Organised by',
    daysLeft: 'days left',
    deadlineToday: 'Closes today',
    deadline1Day: '1 day left',
    overview: 'Overview',
    keyDetails: 'Key Details',
    keyBenefits: 'Application Tips',
    eligibility: 'Eligibility & Requirements',
    prepResources: 'Preparation Resources',
    extraInfo: 'Extra Info & Related Resources',
    officialWebsite: 'Official Website',
    applyHere: 'Apply Here',
    locationLabel: 'Location',
    deadlineLabel: 'Deadline',
    ageGroup: 'Age Group',
    languageLabel: 'Language',
    years: 'years',
    researchPending: 'AI research is being generated for this opportunity...',
    eventNotFound: 'Event Not Found',
    goHome: 'Go Back Home',
    rolling: 'Rolling',
    quickDetails: 'Quick Details',

    // Language values (from DB)
    langEnglish: 'English',
    langUzbek: 'Uzbek',
    langRussian: 'Russian',
    langMultiple: 'Multiple',

    // Category labels (from DB source field)
    srcScholarships:   'Scholarships',
    srcCompetitions:   'Competitions',
    srcSummerPrograms: 'Summer Programs',
    srcResearch:       'Research',
    srcVolunteer:      'Volunteer',
    srcSTEM:           'STEM',
    srcInternships:    'Internships',
    srcWorkshops:      'Workshops',
    srcOther:          'Other',

    // Stats bar
    statOpportunities: 'Opportunities',
    statCountries: 'Countries',
    statStudents: 'Students Helped',
    statLanguages: 'Languages',

    // Closing soon
    closingSoon: 'Closing Soon',
    dLeft: 'd',

    // Homepage sections
    heroKicker: 'For the students of Central Asia',
    scroll: 'Scroll',
    missionLead: 'Our mission',
    missionTitle: "Opportunity shouldn't depend on where you were born.",
    missionBody: 'Every year thousands of scholarships and programs go unclaimed — not for lack of talent, but because no one knew they existed. Fursatly finds them, researches them, and puts them in your language.',
    valuesLead: 'Why Fursatly',
    exploreLead: 'Live opportunities',
    exploreTitle: 'Find your next opportunity',
    backToTop: 'Back to top',

    // Why Fursatly
    whyFursatly: 'Why Fursatly?',
    pipelineStart: 'Thousands of raw listings',
    pipelineEnd: 'Ready for you',
    pipelineVia: 'AI reads & filters',
    feat1Title: 'Verified Listings',
    feat1Desc: 'Every opportunity is hand-picked and verified before going live.',
    feat2Title: 'Smart Filters',
    feat2Desc: 'Filter by age, language, location, deadline and funding type.',
    feat3Title: 'AI-Enriched',
    feat3Desc: 'Deep AI research on every listing — eligibility, tips and resources.',
    feat4Title: '3 Languages',
    feat4Desc: 'All content in English, Uzbek and Russian — fully translated.',
    feat1Keys: ['Hand-checked', 'Trusted sources', 'No spam'],
    feat2Keys: ['Age', 'Language', 'Country', 'Deadline', 'Funding'],
    feat3Keys: ['Eligibility', 'Tips', 'Resources', 'Videos'],
    feat4Keys: ['English', 'Uzbek', 'Russian'],

    // Telegram CTA
    ctaTitle: 'Never Miss a Deadline',
    ctaDesc: 'Join our Telegram community and get instant alerts when new opportunities drop.',
    ctaButton: 'Join @fursatly on Telegram',

    // Misc
    unknown: 'Unknown',
    online: 'Online',

    // Auth
    authTitleIn: 'Welcome back',
    authTitleUp: 'Create your account',
    authSubtitle: 'Save opportunities and get deadline reminders.',
    authEmail: 'Email',
    authPassword: 'Password',
    authSignIn: 'Sign in',
    authSignUp: 'Sign up',
    authNoAccount: "Don't have an account? Sign up",
    authHaveAccount: 'Already have an account? Sign in',
    authOr: 'or continue with',
    authMagic: 'Email me a magic link',
    authMagicSent: 'Check your inbox — your sign-in link is on its way.',
    authConfirmSent: 'Almost there! Confirm your email via the link we just sent.',
    authGoogle: 'Continue with Google',
    authEmailFirst: 'Enter your email above first.',
    authErrorGeneric: 'Something went wrong',
    authErrorCreds: 'Wrong email or password.',
    authErrorRate: 'Too many attempts — please wait a minute and try again.',
    authErrorWeakPassword: 'Password must be at least 6 characters.',

    // Account
    accountTitle: 'My account',
    profileSection: 'Profile',
    displayName: 'Name',
    ageLabel: 'Age',
    countryLabel: 'Country',
    interestsLabel: 'Interests',
    interestsHint: 'e.g. STEM, design, volunteering',
    remindersToggle: 'Deadline reminders',
    remindersHint: 'We DM you on Telegram 3 days and 1 day before a saved deadline.',
    saveProfile: 'Save profile',
    profileSaved: 'Profile saved',
    telegramSection: 'Telegram',
    telegramConnected: 'Connected',
    telegramConnectHint: 'Connect Telegram to receive deadline reminders as direct messages.',
    telegramConnectedToast: 'Telegram connected',
    telegramAlreadyLinked: 'This Telegram account is already linked to another Fursatly account.',
    savedSection: 'Saved opportunities',
    noSaved: "You haven't saved any opportunities yet.",
    browseCta: 'Browse opportunities',
    signOut: 'Sign out',

    // Save button
    saveOpp: 'Save',
    unsaveOpp: 'Saved',
    signInToSave: 'Sign in to save opportunities',

    // Mentor chatbot
    mentorTitle: 'Ask the Mentor',
    mentorSubtitle: 'Personalised guidance on this opportunity and studying abroad',
    mentorPlaceholder: 'Ask anything about this opportunity or studying abroad…',
    mentorSend: 'Send',
    mentorGreeting: 'Hi! I can help you understand this opportunity, check how it fits you, and plan your next steps. What would you like to know?',
    mentorSignIn: 'Sign in to chat with the mentor',
    mentorTyping: 'Mentor is typing…',
    mentorErrorBusy: 'The mentor is busy right now. Please try again in a moment.',
    mentorErrorRate: "You've reached today's message limit. Come back tomorrow!",
    mentorErrorGeneric: 'Something went wrong. Please try again.',
  },

  uz: {
    // Hero
    heroTitle: 'Kelajagingizni Oching',
    heroSubtitle: 'Muvaffaqiyatingiz uchun eng yaxshi grantlar, musobaqalar va dasturlarni toping.',
    activeEvents: 'Faol imkoniyatlar',

    // Search & Filters
    searchPlaceholder: 'Imkoniyatlarni qidirish...',
    filterTitle: 'Filter',
    all: 'Barchasi',
    location: 'Joylashuv',
    language: 'Til',
    age: 'Yosh oralig\'i',
    minAge: 'min',
    maxAge: 'max',
    fundingCoverage: 'Moliyalashtirish',
    fundingAny: 'Istalgan',
    fundingFull: 'To\'liq',
    fundingPartial: 'Qisman',
    deadline: 'Muddat',
    deadlineAny: 'Istalgan vaqt',
    deadlineWeek: 'Bu hafta',
    deadlineMonth: 'Bu oy',
    deadline3Months: '3 oy',
    resetAll: 'Tozalash',
    locUzbekistan: 'O\'zbekiston',
    locOnline: 'Onlayn',
    locAbroad: 'Chet el',
    resultsLabel: 'natija',
    showResults: 'Natijalarni ko\'rish',

    // Cards
    moreInfo: 'Batafsil',
    fullyFunded: 'To\'liq moliyalashtirilgan',
    partial: 'Qisman',

    // Category view
    viewAll: 'Barchasini ko\'rish',
    closeCategory: 'Yopish',

    // Loading / empty
    loading: 'Imkoniyatlar qidirilmoqda...',
    noEvents: 'Imkoniyatlar topilmadi',
    clearFilters: 'Barcha filtrlarni tozalash',

    // Categories
    catAll: 'Barchasi',
    catScholarships: 'Grantlar',
    catCompetitions: 'Musobaqalar',
    catSummerPrograms: 'Yozgi dasturlar',
    catResearch: 'Tadqiqot',
    catVolunteer: 'Volontyorlik',
    catSTEM: 'STEM',
    catInternships: 'Stajirovka',
    catWorkshops: 'Seminarlar',

    // Footer
    footerDesc: 'O\'zbekiston va Markaziy Osiyo yoshlari uchun eng yaxshi imkoniyatlarni to\'playmiz.',
    footerPlatform: 'Platforma',
    footerBrowse: 'Imkoniyatlarni ko\'rish',
    footerLegal: 'Huquqiy',
    footerPrivacy: 'Maxfiylik siyosati',
    footerTerms: 'Foydalanish shartlari',
    footerCookies: 'Cookie siyosati',
    footerAbout: 'Biz haqimizda',
    footerRights: 'Barcha huquqlar himoyalangan.',
    footerTagline: 'O\'zbekiston yoshlari uchun tayyorlandi',

    // Event detail page
    backToOpportunities: 'Imkoniyatlarga qaytish',
    organisedBy: 'Tashkilotchi:',
    daysLeft: 'kun qoldi',
    deadlineToday: 'Bugun yopiladi',
    deadline1Day: '1 kun qoldi',
    overview: 'Umumiy ma\'lumot',
    keyDetails: 'Asosiy tafsilotlar',
    keyBenefits: 'Ariza maslahatlari',
    eligibility: 'Talablar va shartlar',
    prepResources: 'Tayyorlanish resurslari',
    extraInfo: 'Qo\'shimcha ma\'lumot',
    officialWebsite: 'Rasmiy vebsayt',
    applyHere: 'Ariza topshirish',
    locationLabel: 'Joylashuv',
    deadlineLabel: 'Muddat',
    ageGroup: 'Yosh guruhi',
    languageLabel: 'Til',
    years: 'yosh',
    researchPending: 'Imkoniyat uchun AI tadqiqot tayyorlanmoqda...',
    eventNotFound: 'Imkoniyat topilmadi',
    goHome: 'Bosh sahifaga qaytish',
    rolling: 'Doimiy',
    quickDetails: 'Tezkor ma\'lumotlar',

    // Language values (from DB)
    langEnglish: 'Inglizcha',
    langUzbek: 'O\'zbek',
    langRussian: 'Ruscha',
    langMultiple: 'Bir nechta',

    // Category labels (from DB source field)
    srcScholarships:   'Grantlar',
    srcCompetitions:   'Musobaqalar',
    srcSummerPrograms: 'Yozgi dasturlar',
    srcResearch:       'Tadqiqot',
    srcVolunteer:      'Volontyorlik',
    srcSTEM:           'STEM',
    srcInternships:    'Stajirovka',
    srcWorkshops:      'Seminarlar',
    srcOther:          'Boshqa',

    // Stats bar
    statOpportunities: 'Imkoniyatlar',
    statCountries: 'Davlatlar',
    statStudents: 'Talabalar',
    statLanguages: 'Tillar',

    // Closing soon
    closingSoon: 'Muddat tugayapti',
    dLeft: 'kun',

    // Homepage sections
    heroKicker: 'Markaziy Osiyo talabalari uchun',
    scroll: 'Pastga',
    missionLead: 'Bizning maqsad',
    missionTitle: 'Imkoniyat siz qayerda tug\'ilganingizga bog\'liq bo\'lmasligi kerak.',
    missionBody: 'Har yili minglab grantlar va dasturlar egasiz qoladi — iste\'dod yetishmagani uchun emas, balki ular haqida hech kim bilmagani uchun. Fursatly ularni topadi, o\'rganadi va sizning tilingizga o\'giradi.',
    valuesLead: 'Nega Fursatly',
    exploreLead: 'Faol imkoniyatlar',
    exploreTitle: 'Keyingi imkoniyatingizni toping',
    backToTop: 'Yuqoriga',

    // Why Fursatly
    whyFursatly: 'Nima uchun Fursatly?',
    pipelineStart: 'Minglab xom e\'lonlar',
    pipelineEnd: 'Siz uchun tayyor',
    pipelineVia: 'AI o\'qiydi va saralaydi',
    feat1Title: 'Tekshirilgan',
    feat1Desc: 'Har bir imkoniyat e\'lon qilinishdan oldin qo\'lda tekshiriladi.',
    feat2Title: 'Aqlli filtrlar',
    feat2Desc: 'Yosh, til, mamlakat, muddat va moliyalashtirish bo\'yicha filtrlash.',
    feat3Title: 'AI tadqiqot',
    feat3Desc: 'Har bir e\'lon uchun chuqur AI tadqiqoti — talablar, maslahatlar, resurslar.',
    feat4Title: '3 ta til',
    feat4Desc: 'Barcha kontent ingliz, o\'zbek va rus tillarida to\'liq tarjima qilingan.',
    feat1Keys: ['Qo\'lda tekshirilgan', 'Ishonchli manba', 'Spamsiz'],
    feat2Keys: ['Yosh', 'Til', 'Mamlakat', 'Muddat', 'Moliya'],
    feat3Keys: ['Talablar', 'Maslahatlar', 'Resurslar', 'Videolar'],
    feat4Keys: ['Ingliz', 'O\'zbek', 'Rus'],

    // Telegram CTA
    ctaTitle: 'Muddatni o\'tkazib yubormang',
    ctaDesc: 'Telegram kanalimizga qo\'shiling va yangi imkoniyatlar haqida darhol xabar oling.',
    ctaButton: 'Telegram\'da qo\'shilish',

    // Misc
    unknown: 'Noma\'lum',
    online: 'Onlayn',

    // Auth
    authTitleIn: 'Xush kelibsiz',
    authTitleUp: 'Hisob yarating',
    authSubtitle: 'Imkoniyatlarni saqlang va muddat eslatmalarini oling.',
    authEmail: 'Email',
    authPassword: 'Parol',
    authSignIn: 'Kirish',
    authSignUp: 'Ro\'yxatdan o\'tish',
    authNoAccount: 'Hisobingiz yo\'qmi? Ro\'yxatdan o\'ting',
    authHaveAccount: 'Hisobingiz bormi? Kirish',
    authOr: 'yoki davom eting',
    authMagic: 'Magic havolani emailga yuborish',
    authMagicSent: 'Pochtangizni tekshiring — kirish havolasi yo\'lda.',
    authConfirmSent: 'Oz qoldi! Yuborilgan havola orqali emailingizni tasdiqlang.',
    authGoogle: 'Google bilan davom etish',
    authEmailFirst: 'Avval yuqoriga emailingizni kiriting.',
    authErrorGeneric: 'Xatolik yuz berdi',
    authErrorCreds: 'Email yoki parol noto\'g\'ri.',
    authErrorRate: 'Juda ko\'p urinish — bir daqiqa kutib, qayta urinib ko\'ring.',
    authErrorWeakPassword: 'Parol kamida 6 belgidan iborat bo\'lishi kerak.',

    // Account
    accountTitle: 'Mening hisobim',
    profileSection: 'Profil',
    displayName: 'Ism',
    ageLabel: 'Yosh',
    countryLabel: 'Mamlakat',
    interestsLabel: 'Qiziqishlar',
    interestsHint: 'masalan: STEM, dizayn, volontyorlik',
    remindersToggle: 'Muddat eslatmalari',
    remindersHint: 'Saqlangan imkoniyat muddatidan 3 kun va 1 kun oldin Telegramda xabar yuboramiz.',
    saveProfile: 'Profilni saqlash',
    profileSaved: 'Profil saqlandi',
    telegramSection: 'Telegram',
    telegramConnected: 'Ulangan',
    telegramConnectHint: 'Muddat eslatmalarini olish uchun Telegramni ulang.',
    telegramConnectedToast: 'Telegram ulandi',
    telegramAlreadyLinked: 'Bu Telegram hisobi boshqa Fursatly hisobiga ulangan.',
    savedSection: 'Saqlangan imkoniyatlar',
    noSaved: 'Hali hech qanday imkoniyat saqlamagansiz.',
    browseCta: 'Imkoniyatlarni ko\'rish',
    signOut: 'Chiqish',

    // Save button
    saveOpp: 'Saqlash',
    unsaveOpp: 'Saqlangan',
    signInToSave: 'Imkoniyatlarni saqlash uchun tizimga kiring',

    // Mentor chatbot
    mentorTitle: 'Mentordan so‘rang',
    mentorSubtitle: 'Ushbu imkoniyat va chet elda o‘qish bo‘yicha shaxsiy maslahat',
    mentorPlaceholder: 'Ushbu imkoniyat yoki chet elda o‘qish haqida so‘rang…',
    mentorSend: 'Yuborish',
    mentorGreeting: 'Salom! Men bu imkoniyatni tushunishga, sizga mosligini baholashga va keyingi qadamlarni rejalashtirishga yordam beraman. Nimani bilmoqchisiz?',
    mentorSignIn: 'Mentor bilan suhbatlashish uchun kiring',
    mentorTyping: 'Mentor yozmoqda…',
    mentorErrorBusy: 'Mentor hozir band. Iltimos, birozdan so‘ng qayta urinib ko‘ring.',
    mentorErrorRate: 'Bugungi xabarlar chegarasiga yetdingiz. Ertaga qaytib keling!',
    mentorErrorGeneric: 'Xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.',
  },

  ru: {
    // Hero
    heroTitle: 'Откройте своё будущее',
    heroSubtitle: 'Найдите лучшие стипендии, конкурсы и программы для вашего успеха.',
    activeEvents: 'Актуальные возможности',

    // Search & Filters
    searchPlaceholder: 'Поиск возможностей...',
    filterTitle: 'Фильтр',
    all: 'Все',
    location: 'Местоположение',
    language: 'Язык',
    age: 'Возраст',
    minAge: 'мин',
    maxAge: 'макс',
    fundingCoverage: 'Финансирование',
    fundingAny: 'Любое',
    fundingFull: 'Полное',
    fundingPartial: 'Частичное',
    deadline: 'Срок подачи',
    deadlineAny: 'Любое время',
    deadlineWeek: 'Эта неделя',
    deadlineMonth: 'Этот месяц',
    deadline3Months: '3 месяца',
    resetAll: 'Сбросить всё',
    locUzbekistan: 'Узбекистан',
    locOnline: 'Онлайн',
    locAbroad: 'За рубежом',
    resultsLabel: 'результатов',
    showResults: 'Показать',

    // Cards
    moreInfo: 'Подробнее',
    fullyFunded: 'Полное финансирование',
    partial: 'Частичное',

    // Category view
    viewAll: 'Смотреть все',
    closeCategory: 'Закрыть',

    // Loading / empty
    loading: 'Поиск возможностей...',
    noEvents: 'Возможности не найдены',
    clearFilters: 'Сбросить фильтры',

    // Categories
    catAll: 'Все',
    catScholarships: 'Стипендии',
    catCompetitions: 'Конкурсы',
    catSummerPrograms: 'Летние программы',
    catResearch: 'Исследования',
    catVolunteer: 'Волонтёрство',
    catSTEM: 'STEM',
    catInternships: 'Стажировки',
    catWorkshops: 'Семинары',

    // Footer
    footerDesc: 'Соединяем молодёжь Центральной Азии со стипендиями, конкурсами и возможностями.',
    footerPlatform: 'Платформа',
    footerBrowse: 'Все возможности',
    footerLegal: 'Правовая информация',
    footerPrivacy: 'Политика конфиденциальности',
    footerTerms: 'Условия использования',
    footerCookies: 'Политика Cookie',
    footerAbout: 'О нас',
    footerRights: 'Все права защищены.',
    footerTagline: 'Создано для молодёжи Центральной Азии',

    // Event detail page
    backToOpportunities: 'Назад к возможностям',
    organisedBy: 'Организатор:',
    daysLeft: 'дней осталось',
    deadlineToday: 'Закрывается сегодня',
    deadline1Day: 'остался 1 день',
    overview: 'Обзор',
    keyDetails: 'Ключевые детали',
    keyBenefits: 'Советы по заявке',
    eligibility: 'Требования и условия',
    prepResources: 'Ресурсы для подготовки',
    extraInfo: 'Дополнительная информация',
    officialWebsite: 'Официальный сайт',
    applyHere: 'Подать заявку',
    locationLabel: 'Местоположение',
    deadlineLabel: 'Срок подачи',
    ageGroup: 'Возрастная группа',
    languageLabel: 'Язык',
    years: 'лет',
    researchPending: 'AI-исследование для этой возможности генерируется...',
    eventNotFound: 'Возможность не найдена',
    goHome: 'На главную',
    rolling: 'Постоянный приём',
    quickDetails: 'Краткая информация',

    // Language values (from DB)
    langEnglish: 'Английский',
    langUzbek: 'Узбекский',
    langRussian: 'Русский',
    langMultiple: 'Несколько',

    // Category labels (from DB source field)
    srcScholarships:   'Стипендии',
    srcCompetitions:   'Конкурсы',
    srcSummerPrograms: 'Летние программы',
    srcResearch:       'Исследования',
    srcVolunteer:      'Волонтёрство',
    srcSTEM:           'STEM',
    srcInternships:    'Стажировки',
    srcWorkshops:      'Семинары',
    srcOther:          'Другое',

    // Stats bar
    statOpportunities: 'Возможности',
    statCountries: 'Страны',
    statStudents: 'Студентов',
    statLanguages: 'Языка',

    // Closing soon
    closingSoon: 'Скоро закрытие',
    dLeft: 'дн.',

    // Homepage sections
    heroKicker: 'Для студентов Центральной Азии',
    scroll: 'Листайте',
    missionLead: 'Наша миссия',
    missionTitle: 'Возможности не должны зависеть от того, где ты родился.',
    missionBody: 'Каждый год тысячи стипендий и программ остаются невостребованными — не из-за нехватки талантов, а потому что о них никто не узнал. Fursatly находит их, изучает и переводит на твой язык.',
    valuesLead: 'Почему Fursatly',
    exploreLead: 'Актуальные возможности',
    exploreTitle: 'Найди свою возможность',
    backToTop: 'Наверх',

    // Why Fursatly
    whyFursatly: 'Почему Fursatly?',
    pipelineStart: 'Тысячи сырых объявлений',
    pipelineEnd: 'Готово для вас',
    pipelineVia: 'ИИ читает и отбирает',
    feat1Title: 'Проверенные',
    feat1Desc: 'Каждая возможность проверяется вручную перед публикацией.',
    feat2Title: 'Умные фильтры',
    feat2Desc: 'Фильтрация по возрасту, языку, стране, дедлайну и финансированию.',
    feat3Title: 'AI-анализ',
    feat3Desc: 'Глубокий AI-анализ каждого объявления — требования, советы, ресурсы.',
    feat4Title: '3 языка',
    feat4Desc: 'Весь контент на английском, узбекском и русском языках.',
    feat1Keys: ['Проверено вручную', 'Надёжные источники', 'Без спама'],
    feat2Keys: ['Возраст', 'Язык', 'Страна', 'Срок', 'Финансы'],
    feat3Keys: ['Требования', 'Советы', 'Ресурсы', 'Видео'],
    feat4Keys: ['Английский', 'Узбекский', 'Русский'],

    // Telegram CTA
    ctaTitle: 'Не пропустите дедлайн',
    ctaDesc: 'Присоединяйтесь к нашему Telegram и получайте мгновенные уведомления.',
    ctaButton: 'Присоединиться в Telegram',

    // Misc
    unknown: 'Неизвестно',
    online: 'Онлайн',

    // Auth
    authTitleIn: 'С возвращением',
    authTitleUp: 'Создайте аккаунт',
    authSubtitle: 'Сохраняйте возможности и получайте напоминания о дедлайнах.',
    authEmail: 'Email',
    authPassword: 'Пароль',
    authSignIn: 'Войти',
    authSignUp: 'Зарегистрироваться',
    authNoAccount: 'Нет аккаунта? Зарегистрируйтесь',
    authHaveAccount: 'Уже есть аккаунт? Войти',
    authOr: 'или продолжить с',
    authMagic: 'Отправить magic-ссылку на email',
    authMagicSent: 'Проверьте почту — ссылка для входа уже в пути.',
    authConfirmSent: 'Почти готово! Подтвердите email по отправленной ссылке.',
    authGoogle: 'Продолжить с Google',
    authEmailFirst: 'Сначала введите email выше.',
    authErrorGeneric: 'Что-то пошло не так',
    authErrorCreds: 'Неверный email или пароль.',
    authErrorRate: 'Слишком много попыток — подождите минуту и попробуйте снова.',
    authErrorWeakPassword: 'Пароль должен содержать минимум 6 символов.',

    // Account
    accountTitle: 'Мой аккаунт',
    profileSection: 'Профиль',
    displayName: 'Имя',
    ageLabel: 'Возраст',
    countryLabel: 'Страна',
    interestsLabel: 'Интересы',
    interestsHint: 'например: STEM, дизайн, волонтёрство',
    remindersToggle: 'Напоминания о дедлайнах',
    remindersHint: 'Мы напишем вам в Telegram за 3 дня и за 1 день до дедлайна.',
    saveProfile: 'Сохранить профиль',
    profileSaved: 'Профиль сохранён',
    telegramSection: 'Telegram',
    telegramConnected: 'Подключён',
    telegramConnectHint: 'Подключите Telegram, чтобы получать напоминания о дедлайнах.',
    telegramConnectedToast: 'Telegram подключён',
    telegramAlreadyLinked: 'Этот Telegram уже привязан к другому аккаунту Fursatly.',
    savedSection: 'Сохранённые возможности',
    noSaved: 'Вы ещё ничего не сохранили.',
    browseCta: 'Смотреть возможности',
    signOut: 'Выйти',

    // Save button
    saveOpp: 'Сохранить',
    unsaveOpp: 'Сохранено',
    signInToSave: 'Войдите, чтобы сохранять возможности',

    // Mentor chatbot
    mentorTitle: 'Спросить ментора',
    mentorSubtitle: 'Персональные советы по этой возможности и учёбе за рубежом',
    mentorPlaceholder: 'Спросите об этой возможности или учёбе за рубежом…',
    mentorSend: 'Отправить',
    mentorGreeting: 'Привет! Я помогу разобраться в этой возможности, оценить, подходит ли она вам, и спланировать следующие шаги. Что вы хотите узнать?',
    mentorSignIn: 'Войдите, чтобы общаться с ментором',
    mentorTyping: 'Ментор печатает…',
    mentorErrorBusy: 'Ментор сейчас занят. Пожалуйста, попробуйте ещё раз чуть позже.',
    mentorErrorRate: 'Вы достигли дневного лимита сообщений. Возвращайтесь завтра!',
    mentorErrorGeneric: 'Что-то пошло не так. Пожалуйста, попробуйте ещё раз.',
  },
};

/** The full translation dictionary for one locale. */
export type Dict = typeof translations.en;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Translate a DB source/category value to the current locale. Raw values are
 * resolved through the canonical taxonomy first, so aliases ("Grants",
 * "Fellowships"…) and unknown junk never leak untranslated into the UI.
 */
export function translateSource(source: string, t: typeof translations.en): string {
  const map: Record<CanonicalSource, keyof typeof translations.en> = {
    'Scholarships':   'srcScholarships',
    'Competitions':   'srcCompetitions',
    'Summer Programs':'srcSummerPrograms',
    'Research':       'srcResearch',
    'Volunteer':      'srcVolunteer',
    'STEM':           'srcSTEM',
    'Internships':    'srcInternships',
    'Workshops':      'srcWorkshops',
    'Other':          'srcOther',
  };
  return t[map[canonicalSource(source)]] as string;
}

/** Translate a DB language value to the current locale */
export function translateLanguage(lang: string, t: typeof translations.en): string {
  const map: Record<string, keyof typeof translations.en> = {
    'English':  'langEnglish',
    'Uzbek':    'langUzbek',
    'Russian':  'langRussian',
    'Multiple': 'langMultiple',
  };
  const key = map[lang];
  return key ? (t[key] as string) : lang;
}

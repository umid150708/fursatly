/**
 * Animated flag for where an opportunity is, shown next to the location in the
 * channel posts: "📍 South Korea 🇰🇷". Online opportunities get 🌐, global ones 🌍.
 *
 * Locations arrive as free text in English or Uzbek ("AQSh (Online)", "Jeneva,
 * Shveysariya", "Geneva, Switzerland and various UNHCR offices worldwide"), so
 * this finds every country or well-known city in the string. A recognised
 * country always wins over the online/global words, and a string it can't read
 * gets no badge rather than a guess.
 *
 * Self-contained on purpose (no imports): scripts that re-badge old posts load
 * it straight with Node.
 */

export type Badge = { emoji: string; id: string };

/**
 * ISO 3166 alpha-2 → custom-emoji id of the animated flag in "Animated Emoji"
 * (t.me/addemoji/RestrictedEmoji), the pack channel-post.ts already takes its
 * 🇺🇿 and 🇬🇧 from.
 */
export const FLAG_EMOJI: Record<string, string> = {
  AD: '5229127072336589200', AE: '5449495646656537594', AF: '5341723801824541640', AG: '5233687283927892876',
  AI: '5454237677098384174', AL: '5442808872202942144', AM: '5411455658186778270', AO: '5221978936791017415',
  AQ: '5222477234601732139', AR: '5262873863036872166', AS: '5233381108594260837', AT: '5409096965227031137',
  AU: '5382062173323276195', AW: '5231044964212817289', AX: '5467839726855666731', AZ: '5224254431939275524',
  BA: '5382033281078275575', BB: '5222119223307807441', BD: '5222131025877936317', BE: '5411564862025244994',
  BF: '5474323070183285988', BG: '5408875181705799521', BH: '5229186179676517309', BI: '5357542359649237058',
  BJ: '5429270924832548299', BL: '5233616700435348314', BM: '5454179609140544421', BN: '5467415349727083629',
  BO: '5357272214796255046', BQ: '5233482856369504645', BR: '5202074005346983800', BS: '5429268893313017179',
  BT: '5420163176098446088', BW: '5422594827667653377', BY: '5382219601054544127', BZ: '5231366665853224722',
  CA: '5382084502858249131', CC: '5467863456549978285', CD: '5269407491841603689', CF: '5422628135139031178',
  CG: '5422479718249151727', CH: '5442703336266543270', CI: '5411283953984218884', CK: '5454192094610473874',
  CL: '5222427035023977899', CM: '5474681124426884947', CN: '5431782733376399004', CO: '5341564321098907092',
  CR: '5269494559418629149', CU: '5357035553508308603', CV: '5233184244473283152', CW: '5233622988267472134',
  CX: '5467797026290809748', CY: '5228997115216149309', CZ: '5429496861587156146', DE: '5409360418520967565',
  DJ: '5458586718032634511', DK: '5381854399985366436', DM: '5231486851923069595', DO: '5427236235615683748',
  DZ: '5269400778807720624', EC: '5359624993586034294', EE: '5411174505332615466', EG: '5226476858471626962',
  EH: '5431541386279135269', ER: '5420548035232937623', ES: '5201957744877248121', ET: '5269679685393989166',
  EU: '5228784522924930237', FI: '5382151560182642075', FJ: '5454336104863908516', FK: '5454214681843481342',
  FM: '5231007765501067757', FO: '5228851794997688064', FR: '5202132623060640759', GA: '5408983586680350780',
  GB: '5202196682497859879', GD: '5467787680441976258', GE: '5440371950708864925', GF: '5233523014313720667',
  GG: '5229073617173624053', GH: '5188676065320511388', GI: '5226496954623603888', GL: '5221969376193816323',
  GM: '5420472705801536529', GN: '5408977500711691863', GP: '5467664243081886165', GQ: '5447111931217324976',
  GR: '5381889099026149370', GS: '5454396500694024535', GT: '5357434603214748263', GU: '5233385291892407085',
  GW: '5429574437286454077', GY: '5420413662886117194', HK: '5222395857856374392', HN: '5224205572391315540',
  HR: '5262677003210860950', HT: '5357490485034236365', HU: '5409065547541260699', IC: '5233582259092601024',
  ID: '5291937150814661333', IE: '5411194670204069594', IL: '5332299462461107995', IM: '5226538255029121667',
  IN: '5447419223242449630', IO: '5454408067040952538', IQ: '5229059314932528805', IR: '5271878966347601947',
  IS: '5226903563472483349', IT: '5449723275628259037', JE: '5229188988585130961', JM: '5420144630429667484',
  JO: '5460834231468959552', JP: '5456261908069885892', KE: '5269725950781699509', KG: '5427268877367130483',
  KH: '5357374413543062283', KI: '5231365287168721267', KM: '5422342777511886475', KN: '5231087492978982103',
  KP: '5341271404329317987', KR: '5456531898304047227', KW: '5429154466794317724', KY: '5454177075109839093',
  KZ: '5228718354658769982', LA: '5426971433702012873', LB: '5427118703835625983', LC: '5222280134257551597',
  LI: '5226703795953612903', LK: '5341732791191091574', LR: '5422520224085720580', LS: '5422515422312281871',
  LT: '5411197345968695511', LU: '5411158944666101440', LV: '5269650286342846979', LY: '5222284437814783192',
  MA: '5260720207520867861', MC: '5289959262540277451', MD: '5442607966517736672', ME: '5440827745523216914',
  MG: '5429165814097913547', MH: '5469803287119150148', MK: '5442634591020003500', ML: '5411259459785730007',
  MM: '5188162778073935826', MN: '5420481703758019034', MO: '5420505321783179067', MP: '5230969196694748793',
  MQ: '5470045239806802915', MR: '5422465115360345921', MS: '5454038304716504375', MT: '5226954282741283529',
  MU: '5269757084999628216', MV: '5233344051616430964', MW: '5341341330691863561', MX: '5382126374494417411',
  MY: '5339498171246588311', MZ: '5429106139822303027', NA: '5420229786746239476', NC: '5233223766762338378',
  NE: '5339240099546673885', NF: '5233192645429312298', NG: '5411568100430587798', NI: '5426842228200847679',
  NL: '5411124743841524806', NO: '5382300771641470186', NP: '5413521039239955481', NR: '5233464284930915439',
  NU: '5454251094576218954', NZ: '5269712902671055050', OM: '5269663308683688305', PA: '5269271835299560112',
  PE: '5409100220812239915', PF: '5467450310760874001', PG: '5426911591922678926', PH: '5460873607729129032',
  PK: '5269660289321679111', PL: '5291847690940852675', PM: '5231258308123313128', PN: '5454181382962036548',
  PR: '5269767070798592290', PS: '5449405314904369668', PT: '5382075788369605892', PW: '5222244507503833341',
  PY: '5426992955783134297', QA: '5228799250367788944', RE: '5420322107068267129', RO: '5411159898148840778',
  RS: '5384313376136507326', RU: '5449408995691341691', RW: '5359528550095402400', SA: '5202079966761590204',
  SB: '5233325407163398971', SC: '5231446105568329752', SD: '5431435781623260953', SE: '5384542551296455687',
  SG: '5292144120993686909', SH: '5454076894997659542', SI: '5440874620796284751', SK: '5381967160056755878',
  SL: '5411093944631044380', SM: '5228954998766843234', SN: '5474274146210817219', SO: '5474375863921288686',
  SR: '5467524222853071645', SS: '5458535642281552190', ST: '5429484951642842713', SV: '5427301849831061043',
  SX: '5461113820955027461', SY: '5308002793812955097', SZ: '5422587427438998925', TC: '5454045923988488117',
  TD: '5411229867461060921', TF: '5233379493686558144', TG: '5426845148778609404', TH: '5341471408071390957',
  TJ: '5427304285077516492', TK: '5231066898610798438', TL: '5422602597263489621', TM: '5422512652058379683',
  TN: '5357130455105679545', TO: '5467490150877508877', TR: '5226948110873278599', TT: '5420380776321533161',
  TV: '5454304115947487098', TW: '5222365101595568847', TZ: '5269360178481872158', UA: '5447309366568953338',
  UG: '5267090670518025063', UN: '5228760535532582734', US: '5202021044105257611', UY: '5269256068474616775',
  UZ: '5449829434334912605', VA: '5443067545198277083', VC: '5467396563540131322', VE: '5228751795274136090',
  VG: '5453884806880315764', VI: '5231484597065237155', VN: '5474542319673812606', VU: '5469952197930267656',
  WF: '5231000034559934302', WS: '5233271161726450295', XK: '5442767700646442025', YE: '5408878892557542535',
  YT: '5467780911573514412', ZA: '5341547124049852736', ZM: '5339279432857171449', ZW: '5357255314099943456',
};

/** Online / virtual — "News Emoji" (t.me/addemoji/NewsEmoji). */
const ONLINE: Badge = { emoji: '🌐', id: '5447410659077661506' };
/** International / global — "Animated Emoji". */
const WORLD: Badge = { emoji: '🌍', id: '5399898266265475100' };

/** Country → names as they appear in locations: lowercase, no apostrophes (see `norm`). */
const COUNTRIES: Record<string, string[]> = {
  US: ['united states of america', 'united states', 'america', 'amerika', 'aqsh', 'san diego', 'new york', 'boston', 'california', 'washington dc', 'cambridge ma', 'stanford'],
  GB: ['united kingdom', 'great britain', 'britain', 'buyuk britaniya', 'britaniya', 'england', 'scotland', 'wales', 'angliya', 'london', 'oxford', 'cambridge uk', 'edinburgh'],
  UZ: ['uzbekistan', 'ozbekiston', 'tashkent', 'toshkent', 'samarkand', 'samarqand', 'fergana', 'ferghana', 'namangan', 'andijan', 'andijon', 'bukhara', 'buxoro', 'nukus', 'karakalpakstan', 'qoraqalpogiston', 'xorazm', 'khorezm', 'qashqadaryo', 'surxondaryo', 'jizzakh', 'jizzax', 'navoiy', 'sirdaryo', 'termiz'],
  CH: ['switzerland', 'shveysariya', 'shveytsariya', 'geneva', 'jeneva', 'zurich', 'lausanne', 'basel', 'bern'],
  NL: ['netherlands', 'holland', 'niderlandiya', 'gollandiya', 'amsterdam', 'rotterdam', 'the hague', 'delft', 'leiden', 'utrecht', 'eindhoven', 'twente'],
  DE: ['germany', 'germaniya', 'berlin', 'munich', 'heidelberg', 'hamburg', 'frankfurt', 'bonn', 'leipzig'],
  CN: ['china', 'xitoy', 'pekin', 'beijing', 'shanghai', 'shanxay', 'shenzhen', 'guangzhou', 'tsinghua'],
  JP: ['japan', 'yaponiya', 'tokyo', 'osaka', 'kyoto', 'nara', 'hiroshima', 'nagoya'],
  KR: ['south korea', 'janubiy koreya', 'korea', 'koreya', 'seoul', 'seul', 'busan', 'kaist'],
  TR: ['turkey', 'turkiye', 'turkiya', 'istanbul', 'ankara', 'izmir'],
  SK: ['slovakia', 'slovakiya', 'bratislava'],
  AE: ['united arab emirates', 'uae', 'birlashgan arab amirliklari', 'emirates', 'abu dhabi', 'dubai', 'sharjah'],
  AZ: ['azerbaijan', 'ozarbayjon', 'baku', 'boku'],
  ZA: ['south africa', 'janubiy afrika', 'cape town', 'johannesburg', 'pretoria'],
  SA: ['saudi arabia', 'saudiya arabistoni', 'saudiya', 'riyadh', 'thuwal', 'jeddah', 'kaust'],
  RU: ['russia', 'rossiya', 'moscow', 'moskva', 'saint petersburg'],
  AT: ['austria', 'avstriya', 'vienna', 'vena', 'salzburg', 'graz'],
  KG: ['kyrgyzstan', 'qirgiziston', 'qirgizistan', 'bishkek', 'osh'],
  MY: ['malaysia', 'malayziya', 'kuala lumpur', 'penang'],
  SG: ['singapore', 'singapur'],
  SI: ['slovenia', 'sloveniya', 'ljubljana'],
  CA: ['canada', 'kanada', 'toronto', 'montreal', 'vancouver', 'ottawa', 'mcgill'],
  SE: ['sweden', 'shvetsiya', 'stockholm', 'uppsala', 'lund'],
  AU: ['australia', 'avstraliya', 'sydney', 'melbourne', 'canberra', 'brisbane'],
  HU: ['hungary', 'vengriya', 'budapest'],
  NO: ['norway', 'norvegiya', 'trondheim', 'oslo', 'bergen'],
  PT: ['portugal', 'portugaliya', 'lissabon', 'lisbon', 'porto'],
  IT: ['italy', 'italiya', 'rome', 'roma', 'milan', 'milano', 'florence', 'turin', 'bologna'],
  ID: ['indonesia', 'indoneziya', 'jakarta', 'bali'],
  ES: ['spain', 'ispaniya', 'madrid', 'barcelona', 'valencia'],
  FR: ['france', 'fransiya', 'fransuz', 'paris', 'lyon', 'strasbourg'],
  PL: ['poland', 'polsha', 'warsaw', 'krakow'],
  CZ: ['czech republic', 'czechia', 'chexiya', 'prague', 'praga', 'brno'],
  FI: ['finland', 'finlyandiya', 'helsinki'],
  DK: ['denmark', 'daniya', 'copenhagen'],
  BE: ['belgium', 'belgiya', 'brussels', 'bryussel', 'leuven'],
  IE: ['ireland', 'irlandiya', 'dublin'],
  IN: ['india', 'hindiston', 'delhi', 'mumbai', 'bangalore'],
  KZ: ['kazakhstan', 'qozogiston', 'astana', 'almaty'],
  TJ: ['tajikistan', 'tojikiston', 'dushanbe'],
  TM: ['turkmenistan', 'turkmaniston', 'ashgabat'],
  AM: ['armenia', 'armaniston', 'yerevan'],
  GE: ['georgia country', 'gruziya', 'tbilisi'],
  UA: ['ukraine', 'ukraina', 'kyiv', 'kiev'],
  BY: ['belarus', 'minsk'],
  IL: ['israel', 'isroil', 'jerusalem', 'tel aviv'],
  EG: ['egypt', 'misr', 'cairo', 'qohira'],
  QA: ['qatar', 'doha'],
  KW: ['kuwait'],
  OM: ['oman', 'muscat'],
  BH: ['bahrain'],
  JO: ['jordan', 'iordaniya', 'amman'],
  IR: ['iran', 'eron', 'tehran'],
  MA: ['morocco', 'marokash'],
  NG: ['nigeria', 'nigeriya'],
  KE: ['kenya', 'keniya', 'nairobi'],
  BR: ['brazil', 'braziliya'],
  MX: ['mexico', 'meksika'],
  AR: ['argentina', 'argentina'],
  CL: ['chile'],
  NZ: ['new zealand', 'yangi zelandiya', 'auckland'],
  TH: ['thailand', 'tailand', 'bangkok'],
  VN: ['vietnam', 'vyetnam', 'hanoi'],
  PH: ['philippines', 'filippin', 'manila'],
  PK: ['pakistan', 'pokiston', 'islamabad'],
  BD: ['bangladesh', 'dhaka'],
  LK: ['sri lanka', 'colombo'],
  NP: ['nepal', 'kathmandu'],
  MN: ['mongolia', 'mongoliya', 'ulaanbaatar'],
  TW: ['taiwan', 'tayvan', 'taipei'],
  HK: ['hong kong', 'gonkong'],
  GR: ['greece', 'gretsiya', 'athens', 'afina'],
  RO: ['romania', 'ruminiya', 'bucharest'],
  BG: ['bulgaria', 'bolgariya', 'sofia'],
  RS: ['serbia', 'serbiya', 'belgrade'],
  HR: ['croatia', 'xorvatiya', 'zagreb'],
  LT: ['lithuania', 'litva', 'vilnius'],
  LV: ['latvia', 'latviya', 'riga'],
  EE: ['estonia', 'estoniya', 'tallinn', 'tartu'],
  IS: ['iceland', 'islandiya', 'reykjavik'],
  LU: ['luxembourg', 'lyuksemburg'],
  MT: ['malta'],
  CY: ['cyprus', 'kipr'],
};

/** Original-case abbreviations, rewritten to a full name before matching so "us" the word never counts. */
const ABBREVIATIONS: [RegExp, string][] = [
  [/(?<![A-Za-z])(?:USA|U\.S\.A\.?|U\.S\.|US)(?![A-Za-z])/g, 'united states'],
  [/(?<![A-Za-z])(?:UK|U\.K\.)(?![A-Za-z])/g, 'united kingdom'],
  [/(?<![A-Za-z])UAE(?![A-Za-z])/g, 'united arab emirates'],
];

const ONLINE_WORDS = /\b(online|onlayn|virtual|remote|masofaviy)\b/;
const WORLD_WORDS = /\b(international|global|worldwide|multiple|various|xalqaro|dunyo|everywhere)\b/;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lowercase ASCII with apostrophes (o', oʻ, o‘, ’) dropped and dashes as spaces. */
const norm = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ʻʼ’‘'`´]/g, '')
    .replace(/[-‐–—_./,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Longest names first, so "south korea" is read before "korea" and "united states" before "us". */
const ALIASES: { name: string; iso: string; re: RegExp }[] = Object.entries(COUNTRIES)
  .flatMap(([iso, names]) => names.map((name) => ({ name, iso })))
  .sort((a, b) => b.name.length - a.name.length)
  .map((a) => ({ ...a, re: new RegExp(`\\b${esc(a.name)}\\b`, 'g') }));

export const flagOf = (iso: string): string =>
  String.fromCodePoint(...[...iso].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

const flagBadge = (iso: string): Badge => ({ emoji: flagOf(iso), id: FLAG_EMOJI[iso] || '' });

/** The badges for a location, in the order the places appear (at most 3). */
export function locationBadges(location?: string | null): Badge[] {
  if (!location || !location.trim()) return [];
  let s = location;
  for (const [re, full] of ABBREVIATIONS) s = s.replace(re, full);
  s = norm(s);

  const found: { pos: number; iso: string }[] = [];
  for (const { iso, re } of ALIASES) {
    s = s.replace(re, (m, offset: number) => {
      found.push({ pos: offset, iso });
      return ' '.repeat(m.length); // consumed, so a shorter alias can't match inside it
    });
  }
  const isos = [...new Set(found.sort((a, b) => a.pos - b.pos).map((f) => f.iso))].slice(0, 3);
  if (isos.length) return isos.map(flagBadge);
  if (ONLINE_WORDS.test(s)) return [ONLINE];
  if (WORLD_WORDS.test(s)) return [WORLD];
  return [];
}

/** Badges as `<tg-emoji>` HTML, space-separated. Empty when nothing is recognised. */
export const locationBadgeHtml = (location?: string | null): string =>
  locationBadges(location)
    .map((b) => (b.id ? `<tg-emoji emoji-id="${b.id}">${b.emoji}</tg-emoji>` : b.emoji))
    .join(' ');

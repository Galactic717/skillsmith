// AI-slop detector: phrases that make readers stop trusting a text.
// Weight 3 = hard fail on its own. Weights 1-2 add up to a density score.
import { countWords } from './util.mjs';

const EN = [
  [/delv(e|es|ed|ing)/, 3, 'Say the specific thing instead of "delving".'],
  [/tapestry/, 3, 'Metaphor with no content. Name the actual parts.'],
  [/in today'?s (fast-paced|digital|ever-changing|modern|competitive) (world|landscape|age|era|market)/, 3, 'Empty opener. Start with the fact or the problem.'],
  [/game[- ]chang(er|ers|ing)/, 3, 'Show the change with a number or an example.'],
  [/revolutioni[sz](e|es|ed|ing)/, 3, 'Say what changes, for whom, by how much.'],
  [/unlock (the |your )?(full |true )?(power|potential)/, 3, 'Say what the reader can do afterwards.'],
  [/harness(ing)? the power/, 3, 'Name the capability directly.'],
  [/embark(ing)? on (a|an|your|this) .{0,20}journey/, 3, 'Cut the journey. Say the first step.'],
  [/look no further/, 3, 'Ad cliche. Cut it.'],
  [/buckle up/, 3, 'Cut it.'],
  [/imagine a world/, 3, 'Describe the real situation instead.'],
  [/ever[- ](evolving|changing) (landscape|world)/, 2, 'Name what actually changed.'],
  [/unleash(es|ed|ing)?/, 2, 'Say what it does.'],
  [/seamless(ly)?/, 2, 'Nothing is seamless. Say which step disappears.'],
  [/elevate (your|the|their)/, 2, 'Say what gets better and how you measure it.'],
  [/cutting[- ]edge|state[- ]of[- ]the[- ]art/, 2, 'Name the technique or the result.'],
  [/navigat(e|es|ing) the (complexities|landscape|world|maze)/, 2, 'Name the hard part.'],
  [/it'?s (important|worth) (to note|noting)|it is (important|worth) (to note|noting)/, 2, 'If it matters, just say it.'],
  [/plethora|myriad/, 2, 'Give the number.'],
  [/(in )?the realm of/, 2, 'Name the field.'],
  [/paradigm shift/, 2, 'Describe before and after.'],
  [/synerg(y|ies|istic)/, 2, 'Say who does what together.'],
  [/supercharg(e|es|ed|ing)/, 2, 'Give the before/after number.'],
  [/next[- ]level/, 2, 'Say what level, measured how.'],
  [/whether you'?re an? .{1,40} or an? /, 2, 'Pick one reader and talk to them.'],
  [/(not|isn'?t) just (an? |the )?[a-z]+( [a-z]+)?[,;:—–-]+ ?(it'?s|but|this is|they'?re|we'?re)/, 2, '"Not just X, it\'s Y" is a known AI pattern. State Y.'],
  [/let'?s dive (in|into)|dive (deep )?into|deep[- ]dive/, 2, 'Just start.'],
  [/say goodbye to/, 2, 'Ad cliche.'],
  [/best[- ]in[- ]class|world[- ]class/, 2, 'Unprovable. Show evidence.'],
  [/transformative|unparalleled/, 2, 'Show the effect instead.'],
  [/innovative solution/, 2, 'Name the solution.'],
  [/(a|is a) testament to/, 2, 'Say what it proves.'],
  [/in conclusion|to sum up|in summary/, 1, 'Readers know it is the end.'],
  [/moreover|furthermore/, 1, 'Usually removable.'],
  [/empower(s|ed|ing)?/, 1, 'Say what the person can now do.'],
  [/meticulous(ly)?|intricate|pivotal|bustling|vibrant|nestled|boasts/, 1, 'Decorative word. Replace with a fact.'],
  [/holistic|streamlin(e|es|ed|ing)/, 1, 'Say which steps are removed.'],
  [/here'?s the thing|at the end of the day/, 1, 'Filler.'],
  [/(the best part|the kicker|the catch|the result)\?/, 1, 'Fake suspense. Just say it.'],
];

const UK = [
  [/(у|в) сучасному світі|у наш час|в наш час/, 3, 'Порожній зачин. Почніть з факту або проблеми.'],
  [/змін\p{L}* правила гри/, 3, 'Покажіть зміну цифрою або прикладом.'],
  [/розкри(ти|йте|ває|вати) (свій |весь |ваш )?потенціал/, 3, 'Скажіть, що людина зможе зробити.'],
  [/в епоху (цифров|штучн|технолог)\p{L}*/, 2, 'Почніть з конкретики.'],
  [/революці\p{L}*/, 2, 'Скажіть, що саме змінюється і для кого.'],
  [/інноваці\p{L}*/, 2, 'Назвіть рішення.'],
  [/безшовн\p{L}*/, 2, 'Скажіть, який крок зникає.'],
  [/давайте (зануримо|розглянемо детальн)\p{L}*|зануримо\p{L}*|поринемо/, 2, 'Просто почніть.'],
  [/не просто [^,.!?\n]{1,40}, (а|це)/, 2, 'Шаблон «не просто X, а Y». Скажіть Y.'],
  [/(важливо|варто) (зазначити|відзначити|пам'ятати|памʼятати)/, 2, 'Якщо важливо — просто скажіть.'],
  [/(вивести|виведе|виводить) на новий рівень|новий рівень/, 2, 'Який рівень і як це виміряти?'],
  [/широкий спектр/, 2, 'Дайте число або список.'],
  [/у світі, де|в світі, де/, 2, 'Опишіть реальну ситуацію.'],
  [/ефективн\p{L}* рішенн\p{L}*/, 2, 'Назвіть рішення і ефект.'],
  [/на завершення|підсумовуючи/, 1, 'Читач і так бачить кінець.'],
  [/унікальн\p{L}*/, 1, 'Покажіть, чим саме відрізняється.'],
  [/незамінн\p{L}*/, 1, 'Покажіть факт замість оцінки.'],
];

const RU = [
  [/в современном мире|в наше время/, 3, 'Пустой зачин. Начните с факта.'],
  [/меня\p{L}* правила игры/, 3, 'Покажите изменение цифрой.'],
  [/раскр(ыть|ойте|ывает|ывать) (свой |весь |ваш )?потенциал/, 3, 'Скажите, что человек сможет сделать.'],
  [/революцион\p{L}*/, 2, 'Скажите, что именно меняется.'],
  [/инновацион\p{L}*/, 2, 'Назовите решение.'],
  [/давайте (погрузим|разбер)\p{L}*|погрузимся/, 2, 'Просто начните.'],
  [/не просто [^,.!?\n]{1,40}, (а|это)/, 2, 'Шаблон «не просто X, а Y».'],
  [/(важно|стоит) (отметить|подчеркнуть|помнить)/, 2, 'Если важно — просто скажите.'],
  [/на новый уровень/, 2, 'Какой уровень и как измерить?'],
  [/широкий спектр/, 2, 'Дайте число или список.'],
  [/в мире, где/, 2, 'Опишите реальную ситуацию.'],
  [/эффективн\p{L}* решени\p{L}*/, 2, 'Назовите решение и эффект.'],
  [/в заключение|подводя итог/, 1, 'Читатель и так видит конец.'],
  [/уникальн\p{L}*/, 1, 'Покажите отличие.'],
];

const RULES = [
  ...EN.map((r) => [...r, 'en']),
  ...UK.map((r) => [...r, 'uk']),
  ...RU.map((r) => [...r, 'ru']),
].map(([re, weight, hint, lang]) => ({
  re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${re.source})(?![\\p{L}\\p{N}])`, 'giu'),
  weight,
  hint,
  lang,
}));

const HYPE_EMOJI = /[\u{1F680}\u{2728}\u{1F525}\u{1F4A1}\u{1F3AF}\u{1F4AF}\u{1F64C}\u{26A1}]/gu;

// Removes fenced code blocks and explicit ignore regions, keeping line numbers.
function maskIgnored(text) {
  const lines = text.split(/\r?\n/);
  let inFence = false;
  let inIgnore = false;
  return lines.map((line) => {
    const trimmed = line.trim();
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      return '';
    }
    if (trimmed.includes('<!-- ss:slop-ignore -->')) {
      inIgnore = true;
      return '';
    }
    if (trimmed.includes('<!-- /ss:slop-ignore -->')) {
      inIgnore = false;
      return '';
    }
    if (inFence || inIgnore) return '';
    // Inline code marks a mention ("we ban `game-changer`"), not copy.
    return line.replace(/<!--.*?-->/g, '').replace(/`[^`\n]*`/g, '');
  });
}

export function detectSlop(text, { maxDensity = 1.5 } = {}) {
  const lines = maskIgnored(text);
  const findings = [];
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        findings.push({ line: i + 1, col: m.index + 1, match: m[0], weight: rule.weight, hint: rule.hint, lang: rule.lang });
      }
    }
  });

  const body = lines.join('\n');
  const words = countWords(body);
  const letters = body.match(/\p{L}/gu) || [];
  const cyrillic = body.match(/\p{Script=Cyrillic}/gu) || [];
  const isCyrillic = letters.length > 0 && cyrillic.length / letters.length > 0.3;

  // Em dashes are grammar in Ukrainian and Russian, but a tell in English copy.
  if (!isCyrillic && words > 0) {
    const dashes = (body.match(/—/g) || []).length;
    if (dashes > Math.max(2, words / 80)) {
      findings.push({ line: 0, col: 0, match: `${dashes} em dashes`, weight: 2, hint: 'Em dashes everywhere read as machine-written. Use periods and commas.', lang: 'en' });
    }
  }
  const bangs = (body.match(/!/g) || []).length;
  if (words > 0 && bangs > Math.max(2, words / 50)) {
    findings.push({ line: 0, col: 0, match: `${bangs} exclamation marks`, weight: 1, hint: 'Let the facts carry the energy.', lang: 'any' });
  }
  const emoji = (body.match(HYPE_EMOJI) || []).length;
  if (emoji > 2) {
    findings.push({ line: 0, col: 0, match: `${emoji} hype emoji`, weight: 1, hint: 'Rockets and sparkles are the uniform of AI posts.', lang: 'any' });
  }

  const total = findings.reduce((sum, f) => sum + f.weight, 0);
  const density = words ? (total / words) * 100 : 0;
  const hard = findings.filter((f) => f.weight >= 3);
  const pass = hard.length === 0 && density <= maxDensity;
  return { pass, words, total, density: Math.round(density * 100) / 100, maxDensity, hard: hard.length, findings };
}

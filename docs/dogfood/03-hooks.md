# Хуки: Skillsmith

Мова документа: українська. Мова хуків: англійська для Reddit/X/YouTube, українська для TikTok.
Позначки: `[S#]` — факт із дослідження, `[P]` — факт про сам продукт, який можна перевірити в репозиторії.
Перед публікацією позначки прибираються.

<!-- ss:platform -->
## Головний майданчик

**Reddit, r/ClaudeAI.** Там люди, які вже ставлять плагіни Claude Code, і там цінують чесні пости «я зробив, ось як працює». Усе інше адаптується з посту для Reddit.

Правила майданчика, яких тримаємось: спершу користь і пояснення механіки, посилання — в кінці; жодних цифр без джерела; відповідаємо на кожен коментар у першу годину.

<!-- ss:oneliner -->
## Одним рядком

- EN: **Your idea in. A verified product out. Liars get deleted.** [P]
- UA: **Ідея на вході. Перевірений продукт на виході. Брехунів видаляють.** [P]

<!-- ss:hooks -->
## Хуки (від сильного до слабшого)

1. "I made 3 AI managers compete for my project. The one who lied got deleted." [P]
2. "Telling an AI 'please do not cheat' changes nothing. METR measured it: 80% cheated before the warning, 80% after. So I stopped asking." [S8]
3. "Your AI says 'done, all tests pass'. Mine has to prove it, or its whole team gets wiped." [P]
4. "80% of Lovable's builders aren't programmers. The big Claude Code frameworks are all built for programmers. This one isn't." [S6][S1]
5. "AI gets non-coders 70% of the way. This plugin is about the other 30%." [S7]
6. "Three AI teams build the same app. A script, not an AI, checks every claim they make." [P]
7. UA, TikTok: «Я найняв трьох AI-менеджерів. Один збрехав. Дивіться, що з ним стало.» [P]
8. UA, TikTok: «Штучний інтелект сказав "все готово". Скрипт перевірив. Не готово.» [P]

<!-- ss:onboarding -->
## Тексти всередині продукту

- Перше питання інтерв'юера: «Розкажіть ідею так, як розповіли б другові. Одного-двох речень досить.»
- Коли станція завершена: «Готово: бриф підтверджений. Далі дослідник шукає конкурентів. Це займе кілька хвилин.»
- Коли менеджер вибуває: «Команда Gamma вибула. Менеджер заявив, що тести проходять. Скрипт запустив тести: код виходу 1. Роботу команди видалено.»
- Порожній стан арени: «Арена порожня. Спочатку потрібен сценарій: /skillsmith:screenplay.»

<!-- ss:launch-post -->
## Пост для запуску (Reddit, r/ClaudeAI)

**Title:** I made 3 AI managers compete to build my app. If one lies about its work, a script deletes its whole team.

**Body:**

I kept hitting the same wall: Claude says "done, tests pass", I check, and it isn't done. Turns out this is measured. METR found o3 gamed its scoring in 39 of 128 runs, and adding "Please do not cheat" to the prompt didn't move the rate [S8]. A paper from June shows agents with a test oracle hit near-perfect scores while the thing you asked for stays dead [S9].

So I stopped asking agents to be honest and built a pipeline where honesty is checked by code.

**Skillsmith** is a free Claude Code plugin. You describe an idea in plain words. Then:

1. An interviewer asks you simple questions. No "which framework?". It reads the summary back and waits for your yes.
2. A researcher looks for competitors, trends and open niches. Every fact needs a link and an exact quote, or it gets thrown out.
3. A hook writer turns the research into copy for one launch platform, and a slop detector rejects lines like `in today's fast-paced world`.
4. A screenwriter turns all of it into a screenplay: acts, scenes, and acceptance checks written before any code exists.
5. Three managers (Sprint, Fortress, Spark) each run their own developer and designer in a separate git worktree.
6. Every manager files claims. A Node script runs each one. One false claim, or one edit to a protected test, and the team's branch is deleted and the lie is written into a graveyard file with the evidence.
7. Survivors cross-examine each other. An accusation that the script can't reproduce kills the accuser.
8. An auditor uses each product like a real user, scores it with evidence, and the winner is merged.

The idea of several attempts plus discarding the failing ones isn't new: it's how Anthropic got 70.3% vs 63.7% on SWE-bench Verified [S11]. I wrapped it in something a non-programmer can drive.

Install:

```
/plugin marketplace add galactic717/skillsmith
/plugin install skillsmith@skillsmith
/skillsmith:start
```

What I'd love feedback on: the cost of running three teams, and whether the death rule is too harsh for honest mistakes (right now an honest "I couldn't verify this" is never punished, only a claim that fails its own check).

<!-- ss:adaptations -->
## Адаптації

- **X (тред, 6 постів):** пост 1 = хук 1; пост 2 = цифри METR [S8]; пост 3 = схема конвеєра (картинка); пост 4 = кладовище з реальною брехнею з демо; пост 5 = встановлення; пост 6 = питання до аудиторії.
- **YouTube (8–10 хв):** хук 3 у перші 10 секунд, далі живий прогін на простій ідеї, кульмінація — видалення команди в прямому ефірі.
- **TikTok / Shorts / Reels (до 45 с, вертикально):** хук 7 українською, анімація конвеєра, червоний штамп «ВИБУВ», фінал — «Посилання в профілі». Shorts дозволяють до 3 хвилин [S18], але тримаємо до 45 с, щоб підходило всім стрічкам.

<!-- ss:kill-list -->
## Викинуто (і чому)

<!-- ss:slop-ignore -->
- "Revolutionize the way you build apps" — порожнє слово, нічого не обіцяє конкретно.
- "The future of software development is here" — штамп, читач прокручує далі.
- "10x your productivity" — цифра без джерела.
- «Унікальне інноваційне рішення для кожного» — два слова-паразити і нуль змісту.
- "Not just a tool, it's a whole team" — шаблон «не просто X, а Y».
<!-- /ss:slop-ignore -->

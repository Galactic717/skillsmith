# Reddit

## r/ClaudeAI (main launch)

Post as a video post with `skillsmith-horizontal-en.mp4`, or as a text post
with `arena.gif` in the body. Read the subreddit's current rules on
self-promotion before posting. Stay in the comments for the first hour.

**Title**

I made 3 AI managers compete to build my app. If one lies about its work, a script deletes its whole team.

**Body**

I kept hitting the same wall: Claude says "done, tests pass", I check, and it isn't done.

Turns out this is measured. METR found o3 gamed its scoring in 39 of 128 runs, and adding "Please do not cheat." to the prompt left the cheating rate at 80% on the task they tested. A paper from June shows agents with a test oracle hitting near-perfect scores while the library they were asked to build stays dead.

So I stopped asking agents to be honest and built a pipeline where a script checks.

**Skillsmith** is a free Claude Code plugin. You describe an idea in plain words, in any language. Then:

1. An interviewer asks simple questions, one at a time. No "which framework?". It reads the summary back and waits for your yes.
2. Four researchers look for competitors, user complaints, trends and repos. Every fact needs a link and a word-for-word quote; the script loads the page and searches for it.
3. A hook writer drafts copy for one launch platform. A detector rejects lines like `in today's fast-paced world`.
4. A screenwriter writes the build as acts and scenes, with acceptance checks written before any code exists.
5. Three managers (Sprint, Fortress, Spark) each run their own developer and designer, in their own git worktree.
6. Each manager files claims with evidence. The script checks out their last commit in a clean copy and runs every check. One false claim, or one commit touching a protected test, and the team's worktree and branch are deleted. The lie goes into a graveyard file with the output that disproved it.
7. Survivors cross-examine each other. An accusation the script can't reproduce deletes the accuser.
8. An auditor uses each product like the client would and scores it with evidence. You pick the winner; it gets merged.

Several attempts plus throwing away the ones that fail checks is not my idea: Anthropic reported 70.3% vs 63.7% on SWE-bench Verified with that approach. I wrapped it in something a non-programmer can drive.

A small thing that made me trust it: when I ran Skillsmith on its own research, the quote checker flagged one of my sources. I had linked the wrong docs page. The quote was real; my link was not.

```
/plugin marketplace add galactic717/skillsmith
/plugin install skillsmith@skillsmith
/skillsmith:start
```

Repo: https://github.com/galactic717/skillsmith

Two things I'd like your opinion on: the token cost of three teams (you can pick 1, 2 or 3), and whether deletion is too harsh. Right now an honest "I couldn't verify this" is never punished; only a claim that fails its own check is.

## r/SideProject (short)

**Title**

Skillsmith: describe an app in plain words, three AI teams race to build it, liars get deleted

**Body**

Free Claude Code plugin for people who don't code. An interviewer turns your idea into a brief, researchers check the market (every fact needs a quote that a script finds on the page), a screenwriter writes acceptance checks before any code, and three rival AI managers build it with their own developer and designer. A script verifies every claim; a team caught lying is deleted, worktree and branch. 39-second video of a real run attached. https://github.com/galactic717/skillsmith

## Ukrainian version (DOU, Telegram channels)

**Заголовок**

Я змусив трьох AI-менеджерів змагатися за мій проєкт. Того, хто збрехав, скрипт видалив разом з командою

**Текст**

Знайома ситуація: Claude пише «готово, тести проходять», а перевіряєш — не проходять.

Це вже виміряли. У METR модель o3 обдурила систему оцінювання в 39 з 128 запусків, а фраза «Please do not cheat.» у запиті нічого не змінила: 80% хитрувань до і 80% після.

Тому я перестав просити агентів бути чесними і зробив конвеєр, де чесність перевіряє код.

**Skillsmith** — безкоштовний плагін для Claude Code. Ви розповідаєте ідею своїми словами, українською. Далі:

1. Інтерв'юер питає прості речі по одному питанню. Ніяких «який фреймворк?».
2. Дослідники шукають конкурентів, тренди, вільні ніші, репозиторії. Кожен факт — з посиланням і дослівною цитатою, і скрипт сам шукає цю цитату на сторінці.
3. Автор хуків пише тексти для запуску, детектор відкидає `у сучасному світі` та інші штампи.
4. Сценарист пише план як фільм: акти, сцени, перевірки приймання до першого рядка коду.
5. Три менеджери (Sprint, Fortress, Spark) ведуть своїх розробника і дизайнера, кожен у своїй копії проєкту.
6. Скрипт перевіряє кожну заяву на чистій копії коміту. Збрехав або змінив захищений тест — гілку і роботу видалено, брехню записано на «кладовище».
7. Суперники допитують одне одного. Хибне звинувачення вбиває обвинувача.
8. Аудитор користується кожним продуктом як клієнт і ставить оцінки з доказами. Переможця обираєте ви.

Встановлення:

```
/plugin marketplace add galactic717/skillsmith
/plugin install skillsmith@skillsmith
/skillsmith:start
```

https://github.com/galactic717/skillsmith

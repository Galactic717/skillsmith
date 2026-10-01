# Source rules

A source enters the file only if you opened the page yourself in this session
and copied a sentence from it word for word.

## What counts

| Kind | Good | Not good enough |
|---|---|---|
| Numbers (users, revenue, market size) | The company's own report, a filing, a reputable newspaper quoting the company, an academic paper | A listicle or SEO blog that repeats a number without a link to where it came from |
| Product facts (price, features) | The product's own pricing or docs page | A comparison blog from a competitor |
| User pain | A real post or review with the author visible and a date | A summary of "what users say" written by a vendor |
| Trends | Two independent sources pointing the same way, at least one primary | One viral post |
| Repositories | The repository page: stars, last commit date, license, open issues | An "awesome list" mention alone |
| Research findings | The paper or the lab's own post | A tweet about the paper |

## Real posts and successful content

When you keep a post as evidence of pain or of what works:

- It is from a real account with history, not created last week.
- It has real engagement for its platform (comments with substance, not only
  emoji), and you note the numbers you saw with the date.
- It is not an ad, an affiliate post or the vendor's own marketing.
- Keep the post that shows the pattern most clearly; skip near-duplicates.

## Repositories

For each repository write down: stars and forks with the date, date of the
last commit, license (MIT, Apache-2.0, GPL-3.0, none), and what exactly we
would reuse. A repository with no license cannot be copied into the product;
it can only be studied.

## The record

```json
{
  "id": "S1",
  "title": "Exact page title",
  "url": "https://the.exact/page",
  "publisher": "Who published it",
  "published": "YYYY-MM-DD (if shown)",
  "kind": "repo | news | research | official | docs | forum | article",
  "accessed": "YYYY-MM-DD",
  "quote": "A sentence copied word for word from the page, 15+ characters.",
  "claim": "What this source proves for our product.",
  "status": "verified"
}
```

- `quote` must be copied, not paraphrased. The script searches the page for it.
- If you could not open the page, or the page does not literally support the
  claim, use `"status": "unconfirmed"` and say why in `claim`.
- Anything you saw but could not verify goes into `rejected` with a reason.
  Rejecting is good work, not failure.

## Never

- Never invent a quote, a number, a date, an author or a URL.
- Never "round up" a number or merge two numbers from different sources.
- Never cite a page you did not open.

A batch with one invented quote is deleted whole and redone by someone else.

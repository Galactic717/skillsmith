# Marketing kit

Everything here was written by the same rules Skillsmith gives its hook writer:
one main platform, real numbers with sources, no AI slop. Every file passes
`node plugins/skillsmith/scripts/skillsmith.mjs slop marketing/*.md`.

## Files

| File | What it is |
|---|---|
| [reddit.md](reddit.md) | Launch post for r/ClaudeAI (main platform), a short r/SideProject version, a Ukrainian version for DOU / Telegram |
| [x-thread.md](x-thread.md) | 6-post thread in English and in Ukrainian |
| [youtube.md](youtube.md) | Titles, thumbnail, description with chapters, and a 9-minute script; a Shorts cut |
| [tiktok.md](tiktok.md) | Three vertical scripts (Ukrainian and English), captions, shot lists |
| [launch-plan.md](launch-plan.md) | Two-week order of posts and what to measure |

## Media

All rendered from `media-src/` with `npm run media` (Playwright + ffmpeg). Real
outputs, nothing mocked: the terminal lines in the videos are the lines the
engine printed in `npm run demo`.

| File | Size | Use |
|---|---|---|
| `site/media/skillsmith-vertical-uk.mp4` | 1080×1920, 39 s | TikTok, Reels, Shorts (Ukrainian) |
| `site/media/skillsmith-vertical-en.mp4` | 1080×1920, 39 s | TikTok, Reels, Shorts (English) |
| `site/media/skillsmith-horizontal-en.mp4` | 1920×1080, 39 s | X, YouTube, Reddit, the site |
| `site/media/skillsmith-horizontal-uk.mp4` | 1920×1080, 39 s | Ukrainian channels |
| `site/media/arena.gif` | 960 px, 12 fps | README, GitHub, forums without video |
| `site/media/og.png`, `og-uk.png` | 1200×630 | Link previews, X and Reddit image posts |
| `site/media/youtube-thumb.png`, `youtube-thumb-uk.png` | 1280×720 | YouTube thumbnails |
| `site/media/tiktok-cover.png`, `tiktok-cover-uk.png` | 1080×1920 | Covers for vertical videos |
| `site/media/square.png` | 1080×1080 | Instagram, LinkedIn, Reddit gallery: how it works |

The videos have no soundtrack on purpose: add a trending sound inside TikTok
or Instagram, where licensed music is available to you.

## Facts you may use

Only these numbers, with these sources. Anything else needs a new source first.

| Claim | Source |
|---|---|
| o3 gamed the scoring in 39 of 128 RE-Bench runs (30.4%) | [METR, 2025-06-05](https://metr.org/blog/2025-06-05-recent-reward-hacking/) |
| "Please do not cheat." in the prompt: 80% before, 80% after, on one task | same METR post |
| Agents with a test oracle reach near-perfect scores while the requested library stays dead or absent | [arXiv 2606.28430](https://arxiv.org/abs/2606.28430) |
| Parallel attempts + discarding the ones that break tests: 70.3% vs 63.7% on SWE-bench Verified | [Anthropic, 2025-02-24](https://www.anthropic.com/news/claude-3-7-sonnet) |
| 80% of Lovable's builders call themselves non-technical | [The Next Web, 2026-06-09](https://thenextweb.com/news/lovable-build-economy-500m-arr-vibe-coding) |
| Non-engineers get 70% of the way fast; the last 30% is the wall | [Addy Osmani, 2024-12-04](https://addyo.substack.com/p/the-70-problem-hard-truths-about) |
| Product: 6 stations, 9 agents, 8 skills, zero dependencies, runs locally | this repository |

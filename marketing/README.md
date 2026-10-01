# Marketing kit

Everything here follows the rules Skillsmith gives its own hook writer: one
main platform, real numbers with sources, no AI slop. Every file passes
`node plugins/skillsmith/engine/skillsmith.js slop marketing/*.md`.

## Files

| File | What it is |
|---|---|
| [reddit.md](reddit.md) | Launch post for r/ClaudeAI (main platform), a short r/SideProject version, a Show HN version |
| [x-thread.md](x-thread.md) | A 6-post thread |
| [youtube.md](youtube.md) | Titles, thumbnail, description with chapters, a 9-minute script, a Shorts cut |
| [tiktok.md](tiktok.md) | Three vertical scripts, captions and shot lists |
| [launch-plan.md](launch-plan.md) | A two-week order of posts and what to measure |

## Media

Rendered from `media-src/` with `npm run media` (Playwright and ffmpeg). The
terminal lines and scores in the videos are condensed from what the engine
printed in `npm run demo` (the TrialGuard example in `examples/trialguard/`).

| File | Size | Use |
|---|---|---|
| `site/media/skillsmith-vertical.mp4` | 1080×1920, 43 s | TikTok, Reels, Shorts |
| `site/media/skillsmith-horizontal.mp4` | 1920×1080, 43 s | X, YouTube, Reddit, the site |
| `site/media/arena.gif` | 960 px, 12 fps | README, GitHub, forums without video |
| `site/media/og.png` | 1200×630 | Link previews, X and Reddit image posts |
| `site/media/youtube-thumb.png` | 1280×720 | YouTube thumbnail |
| `site/media/tiktok-cover.png` | 1080×1920 | Cover for vertical videos |
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
| SWE-bench Verified rose from 60% to near 100% in a single year | [Stanford AI Index 2026](https://hai.stanford.edu/ai-index/2026-ai-index-report) |
| 46% of developers distrust the accuracy of AI tools, 33% trust it | [Stack Overflow survey 2025](https://survey.stackoverflow.co/2025/ai) |
| Roughly 44% of AI code generation tasks introduced a risky security vulnerability | [Veracode 2026](https://www.veracode.com/blog/2026-genai-code-security-report-ai-risk/) |
| At least 5.2% (commercial) and 21.7% (open-source) of suggested packages were hallucinated | [Spracklen et al.](https://arxiv.org/abs/2406.10279) |
| Parallel attempts plus discarding the ones that break tests: 70.3% vs 63.7% on SWE-bench Verified | [Anthropic, 2025-02-24](https://www.anthropic.com/news/claude-3-7-sonnet) |
| 80% of Lovable's builders call themselves non-technical | [The Next Web, 2026-06-09](https://thenextweb.com/news/lovable-build-economy-500m-arr-vibe-coding) |
| Product: 6 stations, 9 agents, 8 skills, no runtime dependencies, runs locally, 46 engine tests | this repository |

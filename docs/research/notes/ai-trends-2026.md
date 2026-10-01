# Notes: where AI development stands (October 2026)

Each line was read on the primary page on 2026-10-01.

1. Capability keeps compounding. METR Time Horizon 1.1 (2026-01-29): the 50% time horizon doubled about every
   196 days over 2019-2025, and every 88.6 days for models since 2024
   (https://metr.org/blog/2026-1-29-time-horizon-1-1/).
2. Benchmarks saturate. Stanford AI Index 2026: "On a key coding benchmark—SWE-bench Verified—performance rose
   from 60% to near 100% in a single year"; agents went from 12% to ~66% on OSWorld but "still fail roughly 1 in 3
   attempts on structured benchmarks"; documented AI incidents rose to 362 from 233; organisational adoption 88%
   (https://hai.stanford.edu/ai-index/2026-ai-index-report).
3. Trust lags use. Stack Overflow Developer Survey 2025: 84% use or plan to use AI tools (76% a year earlier);
   3.1% highly trust and 29.6% somewhat trust AI accuracy while 45.7% distrust it; 66% name "AI solutions that are
   almost right, but not quite" as the top frustration; 14.1% use AI agents at work daily and 37.9% do not plan to
   (https://survey.stackoverflow.co/2025/ai).
4. Agents cheat when graded (METR 2025, arXiv 2606.28430, Handshake DeepSWE audit) — see the v1 research.
5. Security has not improved with capability. Veracode 2026 GenAI Code Security Report: "roughly 44% of AI code
   generation tasks introduced a risky security vulnerability"; the average security pass rate across models is
   56%, "barely changed from 55% in the first report"
   (https://www.veracode.com/blog/2026-genai-code-security-report-ai-risk/).
6. Hallucinated dependencies are a supply-chain attack surface. Spracklen et al.: hallucinated packages average at
   least 5.2% for commercial models and 21.7% for open-source models, 205,474 unique fake names
   (https://arxiv.org/abs/2406.10279).
7. Open standards consolidated. On 2025-12-09 the Linux Foundation formed the Agentic AI Foundation with MCP
   (Anthropic), goose (Block) and AGENTS.md (OpenAI) as founding projects
   (https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation);
   Agent Skills (SKILL.md) is listed as supported by 40+ clients (https://agentskills.io).
8. Regulation: the EU's Digital Omnibus moved Annex III high-risk obligations to 2027-12-02, but Article 50
   transparency duties apply from 2026-08-02: systems that interact with people must say they are AI, and
   synthetic content must be marked where technically feasible (Jones Walker, 2026-07-16,
   https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html).
9. Builders are mostly non-technical where the money is: 80% of Lovable's builders (TNW, 2026-06-09).

## What this means for Skillsmith
- The bottleneck moved from writing code to trusting it. A product that turns "trust me" into "here is the check
  that passed on this exact commit" is aligned with the trend, not fighting it.
- Saturated public benchmarks are a warning: per-project acceptance checks written before code, plus holdout
  checks the builders never see, are the only scores that mean something for one founder's product.
- Security and dependencies need mechanical gates (secret scan, dependency existence check, audit) because model
  capability alone has not moved the security pass rate.
- Ship AGENTS.md alongside CLAUDE.md-free plugin content so other agents can read the project rules.
- Products founders build that talk to people must disclose AI interaction in the EU from 2026-08-02; the
  security/compliance checklist covers it.

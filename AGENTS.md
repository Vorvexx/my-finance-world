<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vorvex Repository Instructions

Before meaningful product or engineering work, read:

- `docs/00-company/MISSION.md`
- `docs/00-company/PRODUCT_PRINCIPLES.md`
- `docs/VISION.md`
- `docs/02-architecture/DATA_MODEL.md`
- `docs/06-ai/ENGINEERING_PLAYBOOK.md`
- Relevant files in `docs/04-decisions/` and `docs/05-roadmap/`

Follow the authority, task, Git-safety, validation, and prototype-first rules in the Engineering Playbook. Do not duplicate the permanent documents here.

Out-of-scope findings must be recorded rather than implemented:

- Product ideas → `docs/04-decisions/PARKING_LOT.md`
- Engineering limitations → `docs/02-architecture/TECHNICAL_DEBT.md`
- Durable learning → `docs/04-decisions/LESSONS_LEARNED.md`
- Approved decisions → `docs/04-decisions/DECISIONS.md`

Do not add unapproved ideas to the roadmap. Consolidate duplicates and record only meaningful findings.

Every implementation completion report must include:

- Objective completed
- Files changed
- Behaviour changed
- Validation performed
- Assumptions
- Questions requiring founder or CTO review
- Deferred product ideas
- Technical debt observed
- Lessons learned
- Risks
- Recommended next task
- Git branch and commit, when applicable
- Files deliberately left uncommitted

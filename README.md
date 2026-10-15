<h1 align="center">RECF Feedback &amp; Support Portal</h1>

<p align="center">
  <strong>A modified version of <a href="https://github.com/QuackbackIO/quackback">Quackback</a>, maintained by the Robotics Education &amp; Competition Foundation.</strong>
</p>

<p align="center">
  <a href="https://quack.recf.org">quack.recf.org</a> &middot;
  <a href="https://c2.recf.org">Competition Control</a> &middot;
  <a href="https://github.com/QuackbackIO/quackback">Upstream Quackback</a>
</p>

<p align="center">
  <a href="https://github.com/RoboticsEducationCompetitionFoundation/quackback/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License" /></a>
  <a href="https://github.com/RoboticsEducationCompetitionFoundation/quackback/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/RoboticsEducationCompetitionFoundation/quackback/ci.yml?label=CI" alt="CI" /></a>
  <a href="https://github.com/RoboticsEducationCompetitionFoundation/quackback/actions/workflows/deploy-azure.yml"><img src="https://img.shields.io/github/actions/workflow/status/RoboticsEducationCompetitionFoundation/quackback/deploy-azure.yml?label=deploy" alt="Deploy" /></a>
</p>

## About this repository

This is the [Robotics Education & Competition Foundation](https://www.roboticseducation.org/) (RECF) fork of [Quackback](https://github.com/QuackbackIO/quackback), the open-source support and product feedback platform. RECF runs it at [quack.recf.org](https://quack.recf.org) as the feedback and support portal for [Competition Control](https://c2.recf.org) (`c2.recf.org`), the platform RECF operates for running its robotics competitions. The portal collects feature requests and bug reports, answers support questions, and publishes changelog and status updates for Competition Control and related RECF tools.

**If you want Quackback for your own use or modification, start from the official repository instead: <https://github.com/QuackbackIO/quackback>.** That is where the project is developed, documented, and supported, and where contributions belong. This fork is tailored to RECF's deployment and is not maintained as a general-purpose distribution; it is published because the [AGPL-3.0](LICENSE) requires the source of a modified version that is run as a network service to be available to its users.

### How this fork differs from upstream

- **Branding.** User-visible Quackback branding in the portal, embeddable widget, and emails is replaced with RECF branding. Package names, environment variables, and storage keys are unchanged so upstream changes still apply cleanly.
- **Legal pages and cookie consent.** Adds `/legal/*` pages (Terms of Service, Privacy Policy, Cookie Policy, Acceptable Use Policy) written for RECF's portal, a cookie consent banner that gates visitor analytics, and host-page consent handling in the widget. The legal text is specific to RECF and should not be reused as-is.
- **Azure deployment.** Adds an Azure Blob Storage backend for uploads and a GitHub Actions workflow (`deploy-azure.yml`) that builds the production image, pushes it to Azure Container Registry, and updates the App Service after CI passes on `main`.
- **Upstream sync.** Security and correctness fixes from upstream are cherry-picked periodically (see the `sync/*` branches and merged PRs). This fork may lag upstream; feature development happens upstream.

### Contributing

Issues and pull requests in this repository are for RECF's deployment only (branding, legal text, Azure configuration, and the like). Bug fixes and features that apply to Quackback itself should be opened against the [upstream repository](https://github.com/QuackbackIO/quackback) so that every user benefits; upstream contributions are governed by the upstream [CLA](CLA.md). RECF-specific changes here do not require a CLA.

Support requests for Competition Control should go through the portal at [quack.recf.org](https://quack.recf.org), not this repository's issue tracker.

---

The remainder of this document is the upstream Quackback README, retained for reference. Links in it point to the upstream project.

<h1 align="center">Quackback</h1>

<p align="center">
  <strong>Open source support and product feedback for teams that ship.</strong>
</p>

<p align="center">
  The open-source alternative to Canny, UserVoice, and Productboard.<br />
  Collect feedback. Answer customers. Prioritize what matters. Close the loop.
</p>

<p align="center">
  <a href="https://quackback.io">Website</a> &middot;
  <a href="https://quackback.io/docs">Docs</a> &middot;
  <a href="#get-started">Get Started</a>
</p>

<p align="center">
  <img src=".github/screenshot.png" alt="Quackback feedback portal" width="800" />
</p>

## Get Started

**Cloud** — start free at [app.quackback.io](https://app.quackback.io/signup). We host, scale, and maintain it for you. No setup required.

**Self-hosted** anywhere with [Docker](#docker) or [one click on Railway](#one-click-deploy).

## Why Quackback?

Most support-and-feedback suites are expensive, closed-source, and lock you in. Quackback is the suite you actually own: feedback, shared inbox, help center, changelog, status, and AI.

- **Self-host for free.** Run on your own infrastructure. No per-seat pricing.
- **Own your data.** Feedback, conversations, and knowledge live in your own database. No vendor lock-in.
- **AI-powered.** Automatic duplicate detection, AI summaries, feedback extraction from external sources, and an [MCP server](https://quackback.io/docs/mcp) that lets AI agents search, triage, and act on feedback directly.
- **25 integrations.** Slack, Linear, Jira, GitHub, Intercom, Zendesk, and [more](#integrations) out of the box.

## Features

- **Feedback boards.** Let users vote, comment, and track status on feature requests. Vote on behalf of customers, surface high-revenue accounts in triage, and see a full activity timeline on every post.
- **Quinn AI.** A customer-facing agent and a teammate Copilot. Detect duplicates, summarize themes, connect remote MCP servers as Connectors, and permission every write tool: always allow, ask for approval, or deny.
- **Embeddable widget.** Collect feedback right inside your app with a [drop-in widget](https://quackback.io/docs/widget/installation). Works on desktop and mobile, with native SDKs for [iOS](https://github.com/QuackbackIO/quackback-ios) and [Android](https://github.com/QuackbackIO/quackback-android).
- **Admin inbox.** Triage incoming feedback in one place. Filter, group, dismiss, and restore deleted posts.
- **Roadmap & changelog.** Show users what's planned, in progress, and shipped. Publish updates and schedule posts for later.
- **Integrations.** [25 integrations](#integrations) including Slack, Linear, Jira, GitHub, Intercom, Zendesk, and two-way issue tracker sync.
- **API, webhooks & MCP.** Automate workflows with the REST API, outbound webhooks, and an [MCP server](https://quackback.io/docs/mcp) for AI agents.
- **Internationalization.** Portal and widget available in English, French, German, Spanish, and Arabic with full RTL support. Auto-detects browser language.
- **Flexible auth.** Password, email OTP, Google, GitHub, and SSO with providers like Okta and Auth0.
- **SEO-ready.** Auto-generated sitemap and social sharing previews on every portal page.

## Integrations

Slack, Linear, Jira, GitHub, GitLab, Asana, ClickUp, Monday, Trello, Notion, Shortcut, Azure DevOps, Intercom, Zendesk, Freshdesk, HubSpot, Salesforce, Stripe, Discord, Teams, Segment, Zapier, Make, and n8n.

## Self-Hosted

### One-Click Deploy

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/quackback?referralCode=ez8Slg&utm_source=github&utm_medium=readme&utm_campaign=deploy-button)

### Docker

```bash
git clone https://github.com/QuackbackIO/quackback.git
cd quackback
cp .env.example .env   # Edit with your configuration
docker build -t quackback -f apps/web/Dockerfile .
docker run -p 3000:3000 --env-file .env quackback
```

Requires PostgreSQL. Set all variables in the canonical [runtime configuration table](docs/configuration.md). Migrations run automatically on startup.

### About the cloud code in this repo

Quackback's hosted service runs this same codebase, and the client side of that arrangement lives here: a default-off `cloud` settings block, plan and entitlement gating, and a control-plane client. On a self-hosted install none of it activates — an install with no cloud configuration is entitled to every feature, no upgrade prompts render, and no outbound requests are made. Disabling is the default; there is nothing to opt out of. This is stated here so you never have to discover it in the code first.

## Contributing

See the [Contributing Guide](CONTRIBUTING.md) to get started.

- [GitHub Discussions](https://github.com/QuackbackIO/quackback/discussions) — ask questions, share ideas

### Local Development

Prerequisites: [Bun](https://bun.sh/) v1.4.0+ and [Docker](https://docker.com/)

```bash
git clone https://github.com/QuackbackIO/quackback.git
cd quackback
bun run setup    # Install deps, start Docker, run migrations
bun run db:seed  # Optional: seed demo data
bun run dev      # http://localhost:3000
```

Log in with `demo@example.com` / `password`.

### Tech Stack

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) · Full-stack React framework
- [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/) · Database, type-safe ORM, and background job queue
- [Better Auth](https://www.better-auth.com/) · Authentication
- [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) · Styling
- [Bun](https://bun.sh/) · Runtime and package manager

<a href="https://github.com/QuackbackIO/quackback/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=QuackbackIO/quackback" alt="Contributors" />
</a>

## License

[AGPL-3.0](LICENSE).

- **Self-hosting** — free and fully functional, no limits
- **Modifications** — if you distribute or run a modified version as a service, open-source your changes under AGPL-3.0

Contributions to upstream Quackback require signing the [CLA](CLA.md).

Quackback is copyright its original authors and contributors. RECF's modifications in this fork are likewise released under AGPL-3.0; the complete corresponding source for the version running at quack.recf.org is this repository's `main` branch.

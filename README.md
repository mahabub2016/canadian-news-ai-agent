# Canadian News AI Agent

Runs automatically every morning at **7:00 AM EST/EDT** (auto-adjusts for
daylight saving, no manual switching needed) via GitHub Actions. It pulls
fresh headlines from four Canadian news outlets plus Google News Canada as
a resilient fallback, asks Claude to pick the **top 10** most significant
stories and write a tight 2-3 sentence summary for each in English (with a
"Read more" link back to the original article), and emails the digest to
**ai.token.mahabub@gmail.com**.

This is the sibling project to the
[Bangladesh News AI Agent](../bangladesh-news-ai-agent) -- same
architecture, same setup process, different sources/language.

## How it works

```
src/fetchNews.js   -> pulls & merges RSS feeds (CBC News, CTV News, Global News,
                       National Post, Google News Canada), dedupes, sorts by date
src/summarize.js   -> sends candidates to Claude (Anthropic API), gets back
                       JSON: top 10 picks (by index) with 2-3 sentence summaries
src/sendEmail.js   -> renders an HTML email and sends it via Gmail SMTP
src/index.js        -> orchestrates the three steps above
.github/workflows/daily-digest.yml -> cron job that runs it every morning
```

If an RSS source is down or blocks the request, that one feed is skipped
(logged as a warning) and the rest still run.

**Note on the summarizer:** Claude is asked to reference each pick by its
candidate number rather than retyping the title/link. This matters because
Google News links are very long, and having the model retype 10 of them
verbatim risks the JSON response getting cut off mid-string before it
finishes (this actually happened during testing of the Bangladesh agent --
fixed here from the start).

## How the 7:00 AM EST/EDT schedule works

GitHub Actions cron always runs in UTC and has no concept of daylight
saving, so a single fixed cron line can't stay pinned to "7:00 AM Eastern"
year-round. This workflow works around that with an auto-switching setup:

1. It's scheduled to fire at **both** `11:00 UTC` and `12:00 UTC` every day
   -- one of those is always 7:00 AM Eastern, depending on EDT (UTC-4,
   roughly mid-March to early November) or EST (UTC-5, the rest of the year).
2. The first step, **Check local time**, computes the actual current hour
   in `America/New_York`. If it isn't 7 AM, every remaining step is
   skipped -- so only the correct one of the two daily triggers actually
   does anything.
3. Manually running it from the **Actions** tab always runs regardless of
   the time check, so you can test it anytime.

## One-time setup

### 1. Create the GitHub repo and push the code

Easiest no-terminal way: create an empty repo named `canadian-news-ai-agent`
under [github.com/mahabub2016](https://github.com/mahabub2016) (don't
initialize it with a README), then on the empty repo's page click
**"uploading an existing file"** and drag in everything from this folder
-- including the hidden `.github` folder (you may need to enable "show
hidden files" in your file explorer to see it).

If any files land in the wrong place, `Add file -> Create new file` lets
you type a full path like `src/fetchNews.js` directly into the filename
box (GitHub auto-creates folders as you type each `/`), then paste the
content and commit.

### 2. Get an Anthropic API key (skip if you already have one from the Bangladesh agent)

You can reuse the same key from `console.anthropic.com/settings/keys` --
it's tied to your account, not to a specific repo. Just add it as a secret
in this new repo too (see step 4).

### 3. Get a Gmail App Password (skip if you already have one)

Same account/app password from the Bangladesh agent setup works fine here
too -- Gmail app passwords aren't limited to one use.

### 4. Add repository secrets

In this repo: **Settings -> Secrets and variables -> Actions -> New
repository secret**. Add:

| Secret name           | Value                                              |
|------------------------|-----------------------------------------------------|
| `ANTHROPIC_API_KEY`    | Your Anthropic API key                              |
| `GMAIL_USER`           | The Gmail address that will send the email          |
| `GMAIL_APP_PASSWORD`   | The 16-character app password                       |
| `DIGEST_RECIPIENT`     | `ai.token.mahabub@gmail.com` (optional -- already the default) |

### 5. Test it before trusting tomorrow's run

**Actions** tab -> **Canadian News Daily Digest** -> **Run workflow**
dropdown -> green **Run workflow** button. This bypasses the time check and
runs immediately, so you can confirm your secrets are correct and the email
actually arrives, tonight rather than tomorrow morning.

## Running it locally (optional)

```bash
npm install
cp .env.example .env   # then fill in your real keys in .env
npm start
```

## Customizing

- **Change the schedule:** edit the `cron` lines and/or the target hour
  (`"07"`) in the "Check local time" step of
  `.github/workflows/daily-digest.yml`.
- **Add/remove news sources:** edit the `FEEDS` array in `src/fetchNews.js`.
- **Change story count or tone:** edit the prompt in `src/summarize.js`.
- **Change recipient:** update the `DIGEST_RECIPIENT` secret, or edit the
  default in `src/sendEmail.js`.

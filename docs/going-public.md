# Going public: the steps only a person can take

Written September 21, 2026. Everything a session could do toward making this
repository public is committed. What follows is the rest, in order. Each step
is done in the GitHub or Supabase interface or with a push, none of which a
session does.

## 1. Push

The commits from September 21, 2026 were made on `main` locally: the removal
of the six handoff files, the README, `CONTRIBUTING.md`, `SECURITY.md`,
`.github/FUNDING.yml`, the search path migration and this file. The first
two reached GitHub from this machine while the rest were being written.

```
git log --oneline origin/main..HEAD
git push origin main
```

## 2. Remove the Vercel application's access

A Vercel GitHub application still has access to this repository and builds a
broken deployment on every push to `main`, then sends mail about each one.
`CLAUDE.md` section 5 records that Vercel was evaluated and rejected on
September 6, 2026.

GitHub, repository Settings, Integrations, GitHub Apps. Find Vercel and either
remove this repository from its access or uninstall it. Then in the Vercel
dashboard, delete the project so it stops trying.

## 3. Add the license file

Do not paste license text from memory or from a session. Use GitHub's own
template so the text is exact: on the repository page, Add file, Create new
file, name it `LICENSE`, and GitHub offers a "Choose a license template"
button. Pick GNU Affero General Public License v3.0 and commit it to `main`.

The recommendation is the Affero license rather than a permissive one because
this code runs as a service: the Affero license's one difference from the
ordinary General Public License is that somebody who runs a modified copy as a
website has to offer its source to that website's users, which is the only
term that keeps a hosted copy of birthed.app as open as this one. The README
already names this license; if a different one is chosen, edit the README's
last section in the same commit.

## 4. Fill in or remove `.github/FUNDING.yml`

It holds the placeholder `REPLACE-WITH-GITHUB-HANDLE`. Replace it with a real
GitHub Sponsors handle or delete the file. Left as it is, the repository shows
a Sponsor button that leads nowhere.

## 5. Decide about the six deleted handoff files in history

`HANDOFF.md`, `docs/handoff.md`, `docs/app-handoff.md`,
`docs/opus-worklist.md`, `docs/first-impression-prompt.md` and
`docs/test-pass-september-6.md` were removed from the tree on September 21,
2026. They remain in every commit before that, and a public repository's
history is public: anyone can read them at their old paths on an older
commit. Three of them open by describing who is at the keyboard.

The decision taken on September 21 is to leave history as it is. Removing
them from history means rewriting every commit since they were added with a
tool such as `git filter-repo`, force pushing `main`, and having every clone
re-cloned. If that is ever wanted, do it before the repository is public,
because after that the old commits may already be copied.

Fourteen references to those files remain in other documents and two code
comments (`web/src/render.ts`, `web/test/render.test.ts`,
`BirthedTests/DomainTests/RemembranceTests.swift` and eight files under
`docs/`). They point at files that now exist only in history. They were left
as they are.

## 6. Apply the migrations that are in the repository and not on the live database

Checked against the live project on September 21, 2026 by looking for the
objects each migration creates:

| Migration | Live? | Evidence |
|---|---|---|
| `20260911010000_thirty_seconds_to_take_it_back` | No | `wall_forget_boost`, `wall_undo_seconds` and `wall_boosts_after_delete` do not exist |
| `20260911020000_the_anniversary` | Unknown | It replaces `wall_web_standing`; not distinguishable from a catalogue query |
| `20260911030000_the_four_questions_the_hive_is_judged_on` | No | `wall_numbers` does not exist, so `/admin/numbers/` cannot answer |
| `20260911040000_what_a_history_row_is_about` | Yes | `historical_events.subject_url` exists |
| `20260911050000_reach_on_both_anniversaries` | Yes | `article_reach.views_on_date_low` exists |
| `20260911080000_event_pictures` | Yes | `event_pictures` exists |
| `20260911090000_story_pictures` | Yes | `story_pictures` exists |
| `20260911100000_the_hive_moves_live` | Yes | `wall_boosts` is in the `supabase_realtime` publication |
| `20260921000000_pin_the_search_path_on_four_functions` | No | Written September 21, tested in a rolled back transaction, not applied |

`CLAUDE.md` section 6 describes `wall_forget_boost` and the thirty second
window as if they were running. On the live database as of September 21 they
are not, and the `wall-write` Edge Function's undo path will fail until
`20260911010000` is applied. Whether to apply it, the four questions, the
anniversary and the search path migration is a decision for the person who
owns the project; the Supabase command line interface applies them in order.

The migrations table on the live project also carries versions that do not
match the file names in `supabase/migrations/` (for example the live
`20260905153554_brands_offers_rules_and_user_state` against the file
`20260905154500_...`), because several were applied through the dashboard
rather than the command line. `supabase db push` may therefore try to
re-apply migrations that are already live. Check with `supabase migration
list` before pushing and repair the history with `supabase migration repair`
where the file and the live version are the same change.

## 7. Check the two things the brief says are on the public site

- The privacy page at birthed.app/privacy/ says two pages run a script. That
  is true of the code on `main`. Confirm the deployed site is built from
  `main` before flipping to public, because the README points readers at the
  privacy page.
- Render's `birthed-web` service rebuilds only on changes under `web/`. If
  anything under `web/` changed in the commits being pushed, the push
  triggers a deploy; otherwise nothing does.

## 8. Flip the repository to public

GitHub, repository Settings, General, Danger Zone, Change visibility, Make
public. GitHub asks for the repository name to confirm.

After that:

- Check that the About panel still says what it should. The description was
  set while private and carries over.
- Turn on Dependabot alerts if wanted, under Security.
- The `Claude outputs/` folder is ignored by `.gitignore` and was never
  committed. Nothing in it is on GitHub.

## 9. Not done and not decided

- The App Store Connect secondary category is still Finance and should be
  Entertainment. `CLAUDE.md` section 5.
- The front door still opens with "When is your birthday?", which a stranger
  reads as harvesting. `CLAUDE.md` section 5, September 11 entry. That is a
  product decision, not a going public step.

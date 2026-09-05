# Notability ordering, first real result

Run date: September 4, 2026. Query: `import-day.ts 9 4 --dry-run --print`,
years 1600 to 2015, minimum 10 sitelinks.

**The query itself is proven.** 714 people matched in 6.6 seconds. Binding
exact dates with `VALUES` works, and open technical question 1 in `SDS.md`
section 17 is closed. The naive `MONTH()` and `DAY()` filter is not needed and
would very likely have timed out.

## What the ordering produced

Top 15 for September 4, by the current score:

1. Giorgi Marghvilashvili, 1969, 77 sitelinks
2. Raúl Albiol, 1985, 68, footballer
3. Shinya Yamanaka, 1962, 61
4. Yannick Carrasco, 1993, 55, footballer
5. Louis Aliot, 1969, 52
6. Argel Fuchs, 1974, 43, footballer
7. Ayumi Kaihori, 1986, 42, footballer
8. Chateaubriand, 1768 to 1848, 94
9. Olha Kharlan, 1990, 41, fencer
10. Fatih Terim, 1953, 52, footballer
11. Anton Bruckner, 1824 to 1896, 90
12. Layvin Kurzawa, 1992, 40, footballer
13. John DiMaggio, 1968, 40, actor
14. Hildur Guðnadóttir, 1982, 39
15. Tomáš Hübschman, 1981, 39, footballer

## Two separate problems, and they need separate fixes

**One: something is missing, which is a bug, not a weighting question.**
Beyoncé was born September 4, 1981 and does not appear anywhere in the result.
She should carry far more sitelinks than anyone on this list. Whatever is
dropping her is dropping other people too, so the count of 714 cannot be
trusted as complete. Candidate causes, none confirmed: the truthy `wdt:P569`
value not matching the bound literal for her item, more than one birth date
statement with ranks involved, or the label service. Diagnose before touching
any weights, because tuning against an incomplete result set teaches nothing.

**Two: sitelink count is a coverage measure, not a fame measure.** European
footballers have an article in every language a league is followed in. That is
why seven of the top fifteen are footballers. The recency term already in the
score is not the fix, because these people are recent. The likely fix is a term
that reflects how much attention a person actually gets rather than how many
projects have a stub about them, such as Wikipedia pageviews, which is a
separate interface and a separate import.

**Neither is urgent.** The day page renders and the pipeline works. This is a
tuning problem sitting on top of something that functions, and it is cheap to
revisit once there is an interface worth looking at.

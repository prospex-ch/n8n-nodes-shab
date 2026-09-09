Trigger
=======

**SHAB Trigger** polls the gazette and starts the workflow on publications it
has not emitted before. Rows carry the same fields as
:doc:`Publication → Get Many <publications>`.

Set Poll Times to once a day
----------------------------

n8n defaults every polling trigger to every minute. SHAB publishes on working
days and rate-limits by class of client, so a minute interval returns the same
rows a daily run returns.

What to watch
-------------

**Watch** offers a **UID List** (comma-separated, all three UID forms
accepted), a **Company Name** against the keyword index, or **Everything**.
Narrow further with **Cantons**, **Sub-Rubrics** and **Event Types**, and under
**Options** with **Language**, **Include Raw Content** and **Lookback Days**.

**Lookback Days** defaults to 7 and sets how far back each poll reads. A window
wider than the poll interval covers a run that was missed and picks up the
revisions SHAB files against days it has already published.

A UID watch reads the window whole
----------------------------------

The keyword index holds company names, not UIDs, so a UID cannot be queried
for. Each publication carries its own UID in its content block, so a UID watch
reads every HR publication in the lookback window and matches there. On the
default 7-day window that is a few thousand rows and a handful of requests once
a day, which is what the window is sized for. Widening **Lookback Days** widens
that cost in proportion.

The match is exact, which a name search was not: a company that changed its
legal name still comes through.

The stored position
-------------------

The first run records where it got to and emits nothing, so switching a workflow
on does not replay the archive.

After that, each poll stores the newest publication date it has seen and the IDs
seen on that date. A correction SHAB files against an earlier day still comes
through, and rows already emitted are not repeated.

In manual mode the trigger returns one recent item so you can see the shape
while building, and leaves the stored position untouched. Pinning that item lets
you build the rest of the workflow without polling again.

A name watch reads back a year in that mode: a single company publishes a
handful of times a year, so **Lookback Days**, which is sized for the polling
schedule, would leave **Fetch Test Event** with nothing to show. A UID watch
reads back 30 days, because it reads the whole register for every day in the
window and a year of that would not finish while you waited. A watch on
everything keeps the window it is given, since a day of the whole register is
never empty.

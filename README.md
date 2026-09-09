# n8n-nodes-shab

Read the Swiss Official Gazette of Commerce from n8n.

[SHAB](https://www.shab.ch) publishes every change to a commercial-register
entry, and a change takes effect for third parties on the day it appears there.
This package reads those publications and adds a polling trigger that starts a
workflow when the register publishes something about a company you watch.

The gazette is open, so the package needs no account and ships no credential.

For the current register entry behind a publication — purpose, capital, address,
legal form — install
[`n8n-nodes-zefix`](https://github.com/prospex-ch/n8n-nodes-zefix). The two are
separate packages because they are separate APIs, and they join on `uid`.

Built and maintained by [Prospex](https://prospex.ch), a Swiss B2B sales
intelligence platform.

Full documentation:
[n8n-nodes-shab.readthedocs.io](https://n8n-nodes-shab.readthedocs.io).

## Installation

In n8n: **Settings → Community nodes → Install**, then `n8n-nodes-shab`.

Self-hosted, from the command line:

```bash
npm install n8n-nodes-shab
```

## Operations

| Node | Operation | Reads |
|---|---|---|
| SHAB | Publication → Get Many | HR publications over a date range |
| SHAB Trigger | poll | new HR publications since the last run |

No credentials. The gazette answers unauthenticated.

## Compatibility

Requires Node.js 20.15 or newer and an n8n instance with community nodes
enabled. The package targets community node API version 1.

Every request goes through n8n's own HTTP helpers, so the package ships no
runtime dependencies.

## Usage

### Publication → Get Many

Reads HR publications from the gazette, one row per publication:

| Field | Notes |
|---|---|
| `id`, `publicationNumber` | the publication's own identifiers |
| `publicationDate`, `publicationState` | the day, and `PUBLISHED` or `CANCELLED` |
| `subRubric` | `HR01` new registrations, `HR02` mutations, `HR03` deletions |
| `language`, `cantons`, `title` | the title comes in all four languages |
| `uid`, `companyName` | read out of the publication's own content block |
| `eventTypes` | see the table below |
| `sourceUrl` | the public page for that publication |
| `content` | the full structured block, when **Include Raw Content** is on |

**Filter By** offers UID, Company Name, or the date range alone.

**A UID filter reads the whole date range.** The gazette has no UID filter:
`uid`, `hr.uid`, `companyUid` and `hr.uidFormatted` are all accepted and
silently ignored, and the keyword index holds company names only, so
`keyword=CHE-105.841.533` returns nothing. Each publication does carry its own
UID inside its structured content, so the node reads every publication in the
range and keeps the ones that match. That is exact — a company that was renamed
still matches — but the register publishes on the order of a thousand HR entries
a working day and a UID filter pays for all of them. Keep the range short, or
filter by company name, which goes through the keyword index and stays cheap
over any window.

`cantons`, `subRubrics` and `languages` are accepted by the API and ignored by
it in the same way, so the node applies those three itself, after the response
arrives. [The SHAB API guide](https://prospex.ch/guides/shab-api/) has the
parameter-by-parameter version.

### Trigger

Watch a UID list, a company name, or everything. Narrow by canton, sub-rubric
and event type.

**Set Poll Times to once a day.** n8n defaults every polling trigger to every
minute. The gazette publishes on working days and rate-limits by class of
client, so polling every minute adds nothing to a daily run.

A UID watch reads the lookback window whole and matches locally, for the reason
above. On the default 7-day window that is a few thousand rows and a handful of
requests once a day, which is what the window is sized for.

The first run records where it got to and emits nothing, so switching a workflow
on does not replay the archive. After that each poll stores the newest
publication date and the IDs seen on that date, so a correction filed against a
day the trigger has already read still comes through, and the rows already
emitted are not repeated.

In manual mode the trigger returns one recent item so you can see the shape
while building, and leaves the stored position untouched. A name watch reads
back a year in that mode, because a single company publishes a handful of times
a year and **Lookback Days** is meant for the schedule, not for finding a
sample. A UID watch reads back 30 days, since it reads the whole register for
every day in the window. A watch on everything keeps the window it is given,
since a day of the whole register is never empty.

### Event types

`eventTypes` is derived from the publication's structured content, and the
identifiers match the taxonomy in
[`shab-parser`](https://pypi.org/project/shab-parser/).

| Event | Derived from |
|---|---|
| `INCORPORATION` | sub-rubric `HR01` |
| `BRANCH_CREATED` | `HR01` with legal form 0111 or 0151 |
| `SEAT_MOVED` | the seat in `commonsNew` differs from `commonsActual` |
| `ADDRESS_CHANGED` | the `addressChanged` flag, confirmed by an address that really differs |
| `NAME_CHANGED` | the name differs by more than a liquidation qualifier |
| `PURPOSE_CHANGED` | the `purposeChanged` flag, or a purpose that differs |
| `CAPITAL_INCREASED` | a nominal amount in `commonsNew` above the one in `commonsActual` ([what a capital increase means](https://prospex.ch/guides/what-capital-increase-means/)) |
| `OFFICERS_CHANGED` | a labelled person block in the publication text |
| `LIQUIDATION` | a dissolution flag, or a legal name acquiring a liquidation qualifier |
| `DELETED` | sub-rubric `HR03` |

A publication carrying several events emits them in the table's order, which
follows a company's life cycle.

Three of the register's own change flags are unreliable, so the node checks each
one against the data behind it.

| Flag | How it misleads | What the node compares |
|---|---|---|
| `seatChanged` | fires when a company moves down the street inside the same commune | the seat in `commonsActual` against the one in `commonsNew` |
| `addressChanged` | fires when the register re-parses an address, splitting a PO box out of the street line | the two addresses, token by token |
| `nameChanged` | stays false on most renames the register publishes | the two legal names |

#### Limits of the classifier

`MERGER` needs free-text extraction in three languages and is absent here.

`OFFICERS_CHANGED` detects that officers changed, without saying who: the names,
roles and signature rights live only in the publication text. Geneva, Vaud and
Neuchâtel write those mutations as running prose with no labelled block, so an
officer change in those three cantons is missed altogether: over a
400-publication sample, 61 rows produced no event at all, and 40 of them came
from those cantons. A publication that swaps only the auditor uses the same
labelled block as a board change, so the node emits `OFFICERS_CHANGED` for it
too.

Against `shab-parser` on a 60-publication sample stratified across the three
sub-rubrics, the two agree on 57. The three differences are one `MERGER`, one
officer change in Vaud, and one auditor swap in Zug.
[`shab-parser`](https://pypi.org/project/shab-parser/) parses the prose form
and returns the person list, with the auditor marked as such.

### Example workflow

[`examples/slack-alert-on-board-change.json`](examples/slack-alert-on-board-change.json),
importable as it is: watch two UIDs daily, post board, seat and name changes to
Slack.

### Access and terms

The gazette is open. Its API answers at most 2,000 publications per request,
refuses a search offset above 10,000, and reorders its index while a result set
is read. The node splits a date range in half until each half fits in a single
request, so a whole-country month costs a few dozen of them. It sends one
request per second at most and backs off exponentially on failure. Its
`User-Agent` carries this repository's URL.

The register data is also published as linked data through LINDAS, under terms
the Federal Office of Justice states on
[the Zefix site](https://www.zefix.admin.ch/en/search/entity/welcome). Read
those before redistributing bulk extracts.

## Watching the whole register

The trigger on a daily schedule covers a UID list you already have.
[Prospex](https://prospex.ch) watches the whole register and joins it to hiring,
funding and web signals, then says which of those changes is worth a call.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [SHAB](https://www.shab.ch) and [the SHAB API guide](https://prospex.ch/guides/shab-api/)
- [`n8n-nodes-zefix`](https://github.com/prospex-ch/n8n-nodes-zefix), the register-entry side

The register is also reachable outside n8n:

| Package | Does |
|---|---|
| [`shab-parser`](https://pypi.org/project/shab-parser/) | the gazette: discovery, fetch, parse, eleven-type event classification |
| [`zefix-parser`](https://pypi.org/project/zefix-parser/) | the register entry: LINDAS SPARQL, PublicREST, UID validation |
| [`swissco`](https://github.com/prospex-ch/swissco-cli) | the same register from a command line, plus simap, FINMA, GLEIF and ARAMIS |

## Development

```bash
npm install
npm run dev     # starts n8n with the node linked
npm run lint
npm run build
npm test
```

## License

MIT

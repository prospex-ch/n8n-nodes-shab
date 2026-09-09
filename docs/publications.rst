Publications
============

**Publication → Get Many** reads HR publications from the Amtsblattportal and
returns one item per publication.

Filters
-------

**Filter By** offers three modes:

* **UID**: read the date range and keep the publications whose own content
  block carries that UID.
* **Company Name**: search the SHAB keyword index directly, which holds company
  names.
* **Date Range Only**: every HR publication in the window.

**Start Date** is required. **End Date** defaults to today. Under **Options**:
**Cantons**, **Sub-Rubrics**, **Event Types**, **Language**, **Include
Cancelled** and **Include Raw Content**.

Filtering by UID reads the whole range
--------------------------------------

SHAB has no UID filter. Every parameter that looks like one — ``uid``,
``hr.uid``, ``companyUid``, ``hr.uidFormatted`` — is accepted and silently
ignored, and UIDs are absent from the keyword index, which holds company names,
so ``keyword=CHE-105.841.533`` returns nothing.

Each publication does carry its own UID, inside its structured content, at
``commonsActual.company.uid`` or ``commonsNew.company.uid``. So the node reads
every HR publication in the date range and keeps the ones that match. That is
exact — a company that was renamed still matches, which a name search would
miss — but it is not cheap: the register publishes on the order of a thousand
HR entries a working day, and a UID filter pays for all of them.

Keep the range short. A week is a few requests; a year is a few thousand.
Filtering by **Company Name** goes through the keyword index and stays cheap
over any window, at the cost of missing a rename.

``cantons``, ``subRubrics`` and ``languages`` are accepted and ignored in the
same way, so the node applies those three itself once the response arrives.
`The SHAB API guide <https://prospex.ch/guides/shab-api/>`_ has the
parameter-by-parameter version.

Output fields
-------------

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Field
     - Notes
   * - ``id``, ``publicationNumber``
     - The publication's own identifiers
   * - ``publicationDate``, ``publicationState``
     - The day, and ``PUBLISHED`` or ``CANCELLED``
   * - ``subRubric``
     - ``HR01`` new registrations, ``HR02`` mutations, ``HR03`` deletions
   * - ``language``, ``cantons``, ``title``
     - The title comes in all four languages
   * - ``uid``, ``companyName``
     - Read out of the publication's own content block. ``uid`` is dotted, the
       form ``n8n-nodes-zefix`` also emits, so the two join directly.
   * - ``eventTypes``
     - See :doc:`events`
   * - ``sourceUrl``
     - The public page for that publication
   * - ``content``
     - The full structured block, when **Include Raw Content** is on

Cancelled publications
----------------------

SHAB revises what it has published. With **Include Cancelled** on, a
publication that exists in both states arrives once, in its ``CANCELLED``
state, matching how ``shab-parser`` collapses the pair.

How a date range is read
------------------------

The endpoint answers at most 2,000 publications per request and refuses a
search offset above 10,000. Its index also reorders while a result set is being
read, which costs roughly 1% of the rows on any range paged from front to back.

So the node never pages a range. It asks for the count, and while the count is
above 2,000 it halves the range and asks again, until every half fits in one
request. A whole-country month costs a few dozen requests and returns every
publication in the range.

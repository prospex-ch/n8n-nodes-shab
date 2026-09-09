Access and terms
================

Rate limiting
-------------

Open. No account, no key. The API caps a request at 2,000 publications and
refuses a search offset above 10,000. :doc:`Publications <publications>` covers
how the node reads a date range across those limits.

The node sends at most one request per second, waits 30 seconds for an answer,
retries four times with a backoff that doubles from 0.5 seconds to a 30-second
cap, and identifies itself with a ``User-Agent`` carrying this repository's URL.

Redistribution
--------------

The register data behind the gazette is also published as linked data through
LINDAS, under terms the Federal Office of Justice states on `the Zefix site
<https://www.zefix.admin.ch/en/search/entity/welcome>`_. Read those before
redistributing bulk extracts.

Built on
--------

.. list-table::
   :header-rows: 1
   :widths: 32 68

   * - Package
     - Does
   * - `shab-parser <https://pypi.org/project/shab-parser/>`_
     - SHAB: discovery, fetch, parse, eleven-type event classification
   * - `zefix-parser <https://pypi.org/project/zefix-parser/>`_
     - Zefix: LINDAS SPARQL, PublicREST, UID validation
   * - `swissco <https://github.com/prospex-ch/swissco-cli>`_
     - The same two registers from a command line, plus simap, FINMA, GLEIF and
       ARAMIS

Watching the whole register
---------------------------

`Prospex <https://prospex.ch>`_ reads every filing in the register and joins it
to hiring, funding and web signals, then says which of those changes is worth a
call. The trigger on a daily schedule covers the UID list you already have.

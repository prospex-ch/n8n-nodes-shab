Event types
===========

``eventTypes`` is derived from the publication's structured content. The
identifiers match the taxonomy in
`shab-parser <https://pypi.org/project/shab-parser/>`_, so a workflow can move
between the two.

.. list-table::
   :header-rows: 1
   :widths: 28 72

   * - Event
     - Derived from
   * - ``INCORPORATION``
     - Sub-rubric ``HR01``
   * - ``BRANCH_CREATED``
     - ``HR01`` with legal form 0111 or 0151
   * - ``SEAT_MOVED``
     - The seat in ``commonsNew`` differs from ``commonsActual``
   * - ``ADDRESS_CHANGED``
     - The ``addressChanged`` flag, confirmed by an address that really differs
   * - ``NAME_CHANGED``
     - The name differs by more than a liquidation qualifier
   * - ``PURPOSE_CHANGED``
     - The ``purposeChanged`` flag, or a purpose that differs
   * - ``CAPITAL_INCREASED``
     - A nominal amount in ``commonsNew`` above the one in ``commonsActual``
       (`what a capital increase means
       <https://prospex.ch/guides/what-capital-increase-means/>`_)
   * - ``OFFICERS_CHANGED``
     - A labelled person block in the publication text
   * - ``LIQUIDATION``
     - A dissolution flag, or a legal name acquiring a liquidation qualifier
   * - ``DELETED``
     - Sub-rubric ``HR03``

A publication carrying several events emits them in the table's order.
Filtering on **Event Types** keeps a
publication that carries at least one of the selected events.

The register's own flags
------------------------

Three of the change flags the register publishes are unreliable, so the node
checks each one against the data behind it.

.. list-table::
   :header-rows: 1
   :widths: 20 44 36

   * - Flag
     - How it misleads
     - What the node compares
   * - ``seatChanged``
     - Fires when a company moves down the street inside the same commune
     - The seat in ``commonsActual`` against the one in ``commonsNew``
   * - ``addressChanged``
     - Fires when the register re-parses an address, splitting a PO box out of
       the street line
     - The two addresses, token by token
   * - ``nameChanged``
     - Stays false on most renames the register publishes
     - The two legal names

Limits of the classifier
------------------------

``MERGER`` needs free-text extraction in three languages and is absent here.

``OFFICERS_CHANGED`` says that officers changed, without saying who. Names,
roles and signature rights live only in the publication text. Geneva, Vaud and
Neuchâtel write those mutations as running prose with no labelled block, so an
officer change filed in those three cantons is missed: over a 400-publication
sample, 61 rows produced no event at all, and 40 of them came from there. A
publication that swaps only the auditor uses the same labelled block as a board
change, so it emits ``OFFICERS_CHANGED`` too.

Against ``shab-parser`` on a 60-publication sample stratified across the three
sub-rubrics, the two agree on 57. The three differences are one ``MERGER``, one
officer change in Vaud, and one auditor swap in Zug.
`shab-parser <https://pypi.org/project/shab-parser/>`_ parses the prose form and
returns the person list, auditors distinguished from officers.

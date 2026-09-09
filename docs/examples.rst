Example workflows
=================

One workflow ships in `examples/
<https://github.com/prospex-ch/n8n-nodes-shab/tree/main/examples>`_, importable
as it is through **Workflows → Import from File**.

Slack alert on a board change
-----------------------------

``slack-alert-on-board-change.json``. The trigger polls at 08:00 every day for
two UIDs, keeps ``HR02`` mutations carrying ``OFFICERS_CHANGED``,
``SEAT_MOVED`` or ``NAME_CHANGED``, and posts the company name, the UID, the
events and the publication link to ``#sales-signals``.

To adapt it: put your own UIDs in the trigger, and pick your channel in the
Slack node. No gazette credential is involved.

Adding the register entry
-------------------------

A publication says what changed, not what the company now is. To post the
purpose, capital or address alongside the alert, install
`n8n-nodes-zefix <https://github.com/prospex-ch/n8n-nodes-zefix>`_ and put a
**Zefix → Company → Lookup** between the trigger and Slack, fed by the ``uid``
the publication carries. That step needs a Zefix account.

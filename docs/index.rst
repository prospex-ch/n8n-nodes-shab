n8n-nodes-shab
==============

Read the Swiss Official Gazette of Commerce from n8n.

`SHAB <https://www.shab.ch>`_ publishes every change to a commercial-register
entry, and a change takes effect for third parties on the day it appears there.
This package reads those publications and adds a polling trigger that starts a
workflow when the register publishes something about a company you watch.

Ten event types are classified out of each publication's structured content, so
a workflow can branch on a board change without reading the German, French or
Italian text under it.

The gazette is open, so the package needs no account and ships no credential.
For the current register entry behind a publication — purpose, capital,
address, legal form — install
`n8n-nodes-zefix <https://github.com/prospex-ch/n8n-nodes-zefix>`_. The two are
separate packages because they are separate APIs, and they join on ``uid``.

The package ships no runtime dependencies. Every request goes through n8n's own
HTTP helpers.

Built and maintained by `Prospex <https://prospex.ch>`_, a Swiss B2B sales
intelligence platform.

.. toctree::
   :maxdepth: 2

   install
   publications
   trigger
   events
   examples
   access
   changelog

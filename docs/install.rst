Install
=======

In n8n: **Settings → Community nodes → Install**, then type ``n8n-nodes-shab``.

Self-hosted, from the command line:

.. code-block:: bash

   npm install n8n-nodes-shab

Restart n8n, and both nodes appear in the node panel under **SHAB** and **SHAB
Trigger**.

No account needed
-----------------

The gazette is open: no account, no key, no credential to configure. Drop
either node on the canvas and run it.

The register entry
------------------

A publication says what changed. It does not carry the company's current
purpose, capital, address or legal form — those live in Zefix, a separate and
credentialed API, in
`n8n-nodes-zefix <https://github.com/prospex-ch/n8n-nodes-zefix>`_. Both
packages emit ``uid`` in the dotted form, so a publication and a Zefix lookup
join on it directly.

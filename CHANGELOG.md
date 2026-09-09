### Changelog

All notable changes to this project will be documented in this file. Dates are displayed in UTC.

#### 0.1.0

First release. Split out of
[`n8n-nodes-zefix-shab`](https://github.com/prospex-ch/n8n-nodes-zefix-shab) so
that one package addresses one API.

- Publication → Get Many, with UID, name, date, canton, sub-rubric, language and
  event-type filters.
- A polling trigger with a watermark that survives the revisions SHAB files
  against days it has already read.
- Ten event types classified from the structured publication content.

Changed from `n8n-nodes-zefix-shab`: filtering and watching by UID no longer
calls Zefix, and no longer needs an account. The old package resolved a UID to a
legal name through Zefix and searched the keyword index on that name. This
package matches the UID each publication carries in its own content block
instead, which is exact where a name search was approximate, at the cost of
reading the whole date range.

The register-entry side of the old package now lives in
[`n8n-nodes-zefix`](https://github.com/prospex-ch/n8n-nodes-zefix).

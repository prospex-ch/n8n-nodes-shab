# Verification demo

The screen recording submitted with the n8n verification request: install the
package from npm, read gazette publications, and set up the polling trigger.

Recorded with [ndemo](https://github.com/prospex-ch) against a local n8n at
`http://localhost:5678`.

## Recording it

The playbook is committed as it runs. The gazette needs no account, so there is
no credential to substitute and no build step.

```bash
ndemo open   demo/verification/verification.yaml
ndemo play   demo/verification/verification.yaml
ndemo render demo/verification/verification.yaml
```

Every run starts by calling `scripts/reset.sh`, which uninstalls the package and
deletes saved workflows, so the recording always begins from an untouched
instance. Set `NDEMO_KEEP_PACKAGE=1` to leave the package installed while
iterating on later segments.

## Before re-recording

Two segments query the live gazette for one company over the year to date, so
what comes back moves with the register. Check the `publications-result`
narration still matches the output, and that `trigger-fetch` finds an
`OFFICERS_CHANGED` row — widen **Lookback Days** or drop the event filter if it
does not.

The version is pinned in the narration and in the install step, so bump
`n8n-nodes-shab@0.1.0` when the submitted version changes.

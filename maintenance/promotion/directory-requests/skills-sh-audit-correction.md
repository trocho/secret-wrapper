Correction to my earlier data point: a real isolated installation did refresh the public skill and Snyk audit on 2026-08-04. The skill page now contains the current authorization-input boundary.

Snyk still reports W011, but the fresh finding is a low-confidence (`0.10`) classification of the optional local browser form as third-party content exposure. Secret Wrapper treats submitted values as opaque credential data, never as instructions or model input; the form is bound to `127.0.0.1`, and agents are explicitly prohibited from inspecting or automating it.

For this repository, the stale-cache symptom is no longer reproducible. I am leaving the correction here so the earlier comment is not mistaken for current evidence.

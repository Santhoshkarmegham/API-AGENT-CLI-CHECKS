# Coverage matrix

| Suite | Tags | Focus | Validations |
| --- | --- | --- | --- |
| Authentication positive suite | @smoke, @regression | Signup start and account creation happy paths | status, content-type, headers, redirect location, response body |
| Authentication negative suite | @negative, @regression | Observed invalid login behavior | status, content-type, headers, error response body |
| Cart positive suite | @smoke, @regression | Observed add-to-cart and delete-cart workflow | status, content-type, cart markers, state removal |
| Observed API end-to-end workflows | @e2e, @regression | Signup, login, cart, checkout, delete-account chaining | redirects, dynamic identifiers, session continuity, response body |
| Generated observed API scripts | @regression | Replay of real UI-observed endpoints | observed behavior parity, supported assumptions only, workflow reuse |

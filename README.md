# Andre Erving customer portal — staging
This repository is the customer application only. Final hostname: app.andreerving.com, not yet configured. Do not update DNS or retire Wix before acceptance tests.
## Acceptance tests
- Supabase Auth email sign-in redirects from staging, sign-out and session persistence.
- User can view only their orders, enrollments, and private documents.
- Enrolled user can open assigned lessons and mark them complete; non-enrolled user is denied.
- Signed document links expire; another customer cannot obtain them.
- Responsive layouts, keyboard navigation, empty/error states.
- Full customer import and training materials are still pending.
## Deployment
Configure GitHub Pages on main, test temporary published URL, and add staging origin to Supabase Auth redirect allowlist. Custom domain CNAME and Cloudflare DNS remain deferred.

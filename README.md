# Shared Days

Shared Days is an Expo expense-splitting app for dinners, trips, coliving spaces, and other shared experiences. A group can contain account holders and named guests. Itemized bills support equal or custom splits using stable group membership IDs.

## Current features

- Email signup and login
- Google and Apple OAuth integration hooks
- Group creation and named guest members
- Group currency selection
- Itemized expenses with one payer
- Equal and custom item allocations
- Expense editing and payment status
- WhatsApp expense summaries
- Camera and gallery receipt import into an editable draft

## Local development

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and add the Supabase project URL and publishable key. Never put service-role or OpenAI keys in the Expo environment.

3. Start Expo:

   ```sh
   npx expo start
   ```

## Supabase

Versioned SQL migrations are stored in `supabase/migrations`. Review them before applying them to a Supabase project.

Receipt scanning uses the authenticated `scan-receipt` Edge Function in `supabase/functions/scan-receipt`. It requires an `OPENAI_API_KEY` configured as a Supabase Edge Function secret. See its README for deployment details. The secret must never be added to this repository or the mobile app.

## Verification

```sh
npx tsc --noEmit
npx expo lint
```

The expense calculation tests use Node's test runner after TypeScript compilation. Currency values are represented as integer minor units throughout the calculation and database layers.

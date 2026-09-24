# Receipt scanning setup

The app sends a selected JPEG bill photo to this authenticated Edge Function. The function checks that the caller belongs to the group, sends the photo to OpenAI for article and price extraction, and returns a draft. It does not save the photo or an expense. The user reviews the draft and uses the existing expense form to assign participants and payer.

## Before enabling

1. Create an OpenAI API key in your own API account and set a usage budget there. The API charges for scans.
2. In Supabase Dashboard, open **Edge Functions → Secrets** and add `OPENAI_API_KEY`. Never add it to the Expo `.env` file or the repository.
3. Deploy `supabase/functions/scan-receipt/index.ts` as an Edge Function named `scan-receipt`. Keep **Verify JWT** enabled (the default); do not deploy with `--no-verify-jwt`.
4. Sign in to the app as a group member. In **Add expense**, choose **Take photo** on a real phone or **Choose photo** from the gallery. Check all recognized article names, prices, the receipt total, payer, and participants before saving.

For CLI deployment, from the project root after linking the correct Supabase project:

```sh
npx supabase functions deploy scan-receipt
```

Do not put the secret in that command. Add it through the Dashboard. The camera cannot be tested in the iOS Simulator; gallery import can be tested there after the simulator is healthy.

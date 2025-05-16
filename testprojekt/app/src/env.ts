import * as z from 'zod'
import { defineEnvValidationSchema } from 'wasp/env'

export const serverEnvValidationSchema = defineEnvValidationSchema(
  z.object({
    LINKEDIN_CLIENT_ID: z.string({
      required_error: 'LINKEDIN_CLIENT_ID is required in .env.server.',
    }),
    LINKEDIN_CLIENT_SECRET: z.string({
      required_error: 'LINKEDIN_CLIENT_SECRET is required in .env.server.',
    }),
    // Hier können bei Bedarf weitere Server-Umgebungsvariablen hinzugefügt werden
  })
)

// Wenn du auch Client-Umgebungsvariablen validieren möchtest, könntest du hier ein clientEnvValidationSchema definieren
// export const clientEnvValidationSchema = defineEnvValidationSchema(
//   z.object({
//     REACT_APP_MY_CLIENT_VAR: z.string(),
//   })
// ); 
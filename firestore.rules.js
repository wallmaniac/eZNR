// ============================================================================
// FIRESTORE SECURITY RULES
// Copy-paste this into: Firebase Console → Firestore → Rules
// ============================================================================
//
// IMPORTANT: The eZNR app uses Firebase Auth only for the questionnaire/training
// session dispatch (admin→worker flow). Workers who fill out questionnaires do NOT
// have Firebase Auth accounts — they access via public token links.
// Therefore:
//   - Sessions/responses: public read + write (token provides security)
//   - Company data: auth-required read + write
//   - Reference data: auth-required read + write
//
// To deploy these rules:
//   1. Go to https://console.firebase.google.com
//   2. Select your project
//   3. Firebase → Firestore Database → Rules
//   4. Replace the rules with the content below
//   5. Click "Publish"
// ============================================================================

/*

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Questionnaire sessions ─────────────────────────────
    // Workers access via token link (no auth), officers create sessions
    match /questionnaire_sessions/{docId} {
      allow read: if true;
      allow create: if true;
      allow update: if true;
      allow delete: if request.auth != null;
    }

    // ─── Questionnaire responses ────────────────────────────
    // Workers submit responses without auth, officers read results
    match /questionnaire_responses/{docId} {
      allow read: if true;
      allow write: if true;
    }

    // ─── Training sessions ──────────────────────────────────
    match /training_sessions/{docId} {
      allow read: if true;
      allow create: if true;
      allow update: if true;
      allow delete: if request.auth != null;
    }

    // ─── Training responses ─────────────────────────────────
    match /training_responses/{docId} {
      allow read: if true;
      allow write: if true;
    }

    // ─── Company-scoped data ────────────────────────────────
    // All data under /companies/{companyId}/... requires auth
    match /companies/{companyId}/{collection}/{docId} {
      allow read, write: if request.auth != null;
    }

    // ─── Global reference data ──────────────────────────────
    // Countries, counties, places, doctors, etc.
    match /{collection}/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}

*/

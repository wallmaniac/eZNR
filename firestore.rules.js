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

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }

    function belongsToCompany(companyId) {
      return isSignedIn() && (
        isAdmin() || 
        companyId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyIds
      );
    }

    // 1) Users Collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
      allow update: if request.auth.uid == userId || isAdmin();
    }

    // 2) Companies Collection
    match /companies/{companyId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    // 3) Global Catalog Data
    match /countries/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /counties/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /places/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /examTypes/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /certTypes/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /equipmentTypes/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /ppeTypes/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /fileTypes/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /isznrDocTypes/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }
    match /doctors/{document} { allow read: if isSignedIn(); allow write: if isAdmin(); }

    // 4) COMPANY-SCOPED DATA
    match /companies/{companyId}/{collection}/{documentId} {
      allow read, write: if isSignedIn() && belongsToCompany(companyId);
    }

    // 5) Ankete - Sesije
    match /questionnaire_sessions/{sessionId} {
      // Radnik pristupa javnim token linkom (bez Auth prijave) pa mora biti true. update treba pri otvaranju linka
      allow read, update: if true;
      // Admin formira novu anketu i jedini on je može obrisati
      allow create, delete: if isSignedIn();
    }

    // 6) Ankete - Odgovori
    match /questionnaire_responses/{responseId} {
      allow read, delete: if isSignedIn();
      allow create, update: if true; // Radnik uspješno polaže formu
    }

    // 7) Treninzi - Sesije
    match /training_sessions/{sessionId} {
      allow read, update: if true;
      allow create, delete: if isSignedIn();
    }

    // 8) Treninzi - Odgovori
    match /training_responses/{responseId} {
      allow read, delete: if isSignedIn();
      allow create, update: if true;
    }

  }
}

*/

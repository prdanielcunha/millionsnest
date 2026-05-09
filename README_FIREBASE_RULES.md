# Configuração Final Firebase (Obrigatório)

Como você adicionou as credenciais do Firebase manualmente, você precisa atualizar as regras de segurança no console do Firebase para permitir o funcionamento correto do frontend e resolver o erro `Missing or insufficient permissions`.

Siga os passos:

1. Acesse: https://console.firebase.google.com/
2. Escolha o seu projeto (`millionsnest`)
3. Vá em **Firestore Database** > Aba **Rules**
4. Substitua TODO o conteúdo atual por estas regras abaixo:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 0. Global Safety Net
    match /{document=**} {
      allow read, write: if false;
    }

    // --- Global Helpers ---
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function incoming() {
      return request.resource.data;
    }

    function existing() {
      return resource.data;
    }

    // --- Collection Rules ---

    match /users/{userId} {
      allow get: if isOwner(userId);
      allow list: if false;
      allow create: if isOwner(userId);
      allow update: if isOwner(userId)
        && incoming().uid == existing().uid
        && incoming().products == existing().products; 
    }

    match /organizations/{orgId} {
      allow read: if isSignedIn() && (
        resource.data.ownerUid == request.auth.uid ||
        exists(/databases/$(database)/documents/organization_members/$(request.auth.uid + "_" + orgId))
      );
      allow write: if false;
    }

    match /organization_members/{memberId} {
      allow read: if isSignedIn() && (
        resource.data.uid == request.auth.uid ||
        get(/databases/$(database)/documents/organizations/$(resource.data.organizationId)).data.ownerUid == request.auth.uid
      );
      allow write: if false;
    }

    match /subscriptions/{subId} {
      // PERMITE APENAS O PRÓPRIO USUÁRIO LER SUA ASSINATURA.
      // Modificações são restritas apenas ao webhook do servidor!
      allow get: if isOwner(subId);
      allow list: if false;
      allow write: if false;
    }
  }
}
```

5. Clique em **Publish** (Publicar).

## Sobre o Base64 da Service Account (Backend)

No arquivo `.env` (no Secrets do AI Studio), certifique-se de adicionar a variável:
`FIREBASE_SERVICE_ACCOUNT_BASE64`

Ela deve conter o JSON da sua Service Account do Firebase, codificado em Base64.
Para obter, vá em:
Configurações do Projeto > Contas de Serviço > Gerar nova chave privada.
Pegue o conteúdo do arquivo JSON, converta para Base64 (ex: https://www.base64encode.org/) e cole lá.

Isso dará permissões totais ("Total Admin") ao backend para escutar o Webhook do Stripe e aplicar no Firestore.

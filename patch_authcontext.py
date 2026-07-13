import re

with open('src/contexts/AuthContext.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace switchOrganization
new_switch = """  const switchOrganization = async (orgId: string) => {
    if (!user || !profile) return;
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch('/api/v1/user/active-organization', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
         },
         body: JSON.stringify({ organizationId: orgId })
      });
      
      if (!res.ok) {
         throw new Error('Failed to switch active organization');
      }

      const updatedProfile = { ...profile, organizationId: orgId, activeOrganizationId: orgId };
      setProfile(updatedProfile);
      localStorage.setItem('mn_user_profile', JSON.stringify(updatedProfile));
      localStorage.removeItem('mn_support_session');
      
      analytics.track('app_usage', {
        userId: user.uid,
        organizationId: orgId,
        metadata: { action: 'switch_organization' }
      });
    } catch (e) {
      console.error("Failed to switch organization", e);
    }
  };"""

content = re.sub(r"  const switchOrganization = async \(orgId: string\) => \{[\s\S]*?^\s*};\n", new_switch + "\n", content, flags=re.MULTILINE)

# Replace new user handling
new_user_block = """          } else {
            // New user without profile
            const inviteRedirect = sessionStorage.getItem('mn_invite_redirect');
            if (inviteRedirect && inviteRedirect.startsWith('/join')) {
                // Let Login/App handle the redirect to /join
                // Do not bootstrap automatically. Just set loading false and return.
                setProfile(null); // Or minimal profile if needed, but null forces them to stay in the flow
            } else {
                try {
                   const idToken = await currentUser.getIdToken(true);
                   const bootRes = await fetch('/api/v1/onboarding/bootstrap', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${idToken}` }
                   });
                   if (bootRes.ok) {
                      // Re-fetch user profile
                      const newUserSnap = await getDoc(userRef);
                      if (newUserSnap.exists()) {
                         const newProfileData = newUserSnap.data() as UserProfile;
                         setProfile(newProfileData);
                         localStorage.setItem('mn_user_profile', JSON.stringify(newProfileData));
                         
                         analytics.track('signup', {
                           userId: currentUser.uid,
                           organizationId: newProfileData.activeOrganizationId
                         });
                      }
                   }
                } catch (bootErr) {
                   console.error("Erro no bootstrap do usuário:", bootErr);
                }
            }
            
            // Cleanup any residual local storage invites just in case
            localStorage.removeItem('invite_org_id');
            localStorage.removeItem('invite_role');
          }"""

content = re.sub(r"          \} else \{\n            // Criar novo usuário e usa um ID único para seu workspace pessoal[\s\S]*?            \}\);\n          \}", new_user_block, content)

# Remove the inviteOrgId promotion from existing user flow
invite_pattern = r"            const inviteOrgId = localStorage.getItem\('invite_org_id'\);[\s\S]*?            localStorage.removeItem\('invite_role'\);\n            \}"

content = re.sub(invite_pattern, "            // Automatic promotion by email and localStorage invites removed per security audit P0-A", content)

with open('src/contexts/AuthContext.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")

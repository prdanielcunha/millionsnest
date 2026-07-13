import re

with open('src/pages/Login.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_effect = """  useEffect(() => {
    // invite_org_id injection removed to prevent blindly trusting invalid organization ids bypassing Join.tsx validations
    if (authLoading) return;
    
    if (user) {
      // Check for invite redirect first
      const inviteRedirect = sessionStorage.getItem('mn_invite_redirect');
      if (inviteRedirect && inviteRedirect.startsWith('/join')) {
        // Keep it in session to be picked up by Join, but navigate there first
        navigate(inviteRedirect);
        return;
      }
      
      if (profile) {
          // UX Optimized: Check if user was trying to buy something before login
          const purchaseIntent = sessionStorage.getItem('purchase_intent');
          if (purchaseIntent) {
            sessionStorage.removeItem('purchase_intent');
            navigate(`/checkout?plan=${purchaseIntent}`);
          } else {
            navigate("/dashboard");
          }
      }
    }
  }, [user, profile, authLoading, navigate]);"""

# Replace the useEffect block.
# Let's just find `  useEffect(() => {\n    // invite_org_id` up to `navigate("/dashboard");\n      }\n    }\n  },`
pattern = r"  useEffect\(\(\) => \{\n    // invite_org_id[\s\S]*?navigate\(\"/dashboard\"\);\n      \}\n    \}\n  \}, \[user, profile, authLoading, navigate\]\);"
content = re.sub(pattern, new_effect, content)

with open('src/pages/Login.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")

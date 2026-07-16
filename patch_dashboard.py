import sys

def main():
    with open('src/pages/Dashboard.tsx', 'r') as f:
        lines = f.readlines()
        
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if line.startswith("  const handleCreateInvite = async (role: string, method: 'whatsapp' | 'copy', email?: string, overrideOrgId?: string) => {"):
            start_idx = i
            break
            
    if start_idx != -1:
        for i in range(start_idx, len(lines)):
            if lines[i].startswith("  const handleAcceptJoinRequest = async (requestId: string) => {"):
                end_idx = i
                break
                
    if start_idx != -1 and end_idx != -1:
        new_code = """  const handleCreateInvite = async (
    role: "admin" | "member",
    email: string,
    overrideOrgId?: string
  ): Promise<{
    inviteUrl: string;
    invitation: {
      id: string;
      organizationId: string;
      organizationName: string;
      email: string;
      role: "admin" | "member";
      status: "pending";
      expiresAtMs: number;
    };
  }> => {
    if (!user) throw new Error("UNAUTHENTICATED");
    const orgId = overrideOrgId || activeContextOrgId;
    if (!email) throw new Error("INVALID_INVITE_EMAIL");

    const idToken = await user.getIdToken();
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 10000);

    let res;
    try {
      res = await fetch('/api/v1/invitations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId: orgId,
          email,
          role
        }),
        signal: abortController.signal
      });
    } catch (e: any) {
      if (e.name === 'AbortError') {
         throw new Error("TIMEOUT");
      }
      throw new Error("GENERIC");
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await res.json();
    if (!res.ok || data.success !== true) {
      throw new Error(data.reasonCode || "GENERIC");
    }

    if (typeof data.invitePath !== 'string' || !data.invitePath.startsWith('/join/')) {
       throw new Error("GENERIC");
    }
    
    if (!data.invitation || !data.invitation.id || !data.invitation.organizationId) {
       throw new Error("GENERIC");
    }

    const finalUrl = new URL(data.invitePath, window.location.origin);
    if (finalUrl.origin !== window.location.origin) {
       throw new Error("GENERIC");
    }

    setPendingInvites(prev => {
      if (prev.some(inv => inv.id === data.invitation.id)) return prev;
      return [...prev, data.invitation];
    });

    return {
      inviteUrl: finalUrl.toString(),
      invitation: data.invitation
    };
  };

"""
        with open('src/pages/Dashboard.tsx', 'w') as f:
            f.writelines(lines[:start_idx])
            f.write(new_code)
            f.writelines(lines[end_idx:])
        print("Replaced handleCreateInvite successfully.")
    else:
        print(f"Could not find indices: {start_idx}, {end_idx}")

main()

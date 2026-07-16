import re

with open("src/components/dashboard/MusicScaleGuideCenter.tsx", "r") as f:
    content = f.read()

content = content.replace(
    "export function MusicScaleGuideCenter({ onOpenMusicScale, onOpenSettings, onOpenTeam, musicScaleReady = true }) {",
    """export function MusicScaleGuideCenter({ 
  activeSection: externalActiveSection,
  organizationReady,
  musicScaleReady = true,
  teamStarted,
  canInvite,
  canManageTeam,
  canManageOrganization,
  canManageBilling,
  hasPaymentIssue,
  onSelectSection,
  onOpenInviteModal,
  onManageTeam,
  onReviewOrganization,
  onOpenMusicScale,
  onNavigateToBilling,
  heroContent: externalHeroContent,
  overviewContent: externalOverviewContent
}: any) {"""
)

content = content.replace(
    "const [activeSection, setActiveSection] = useState('overview');",
    "const [activeSection, setActiveSection] = useState(externalActiveSection || 'overview');"
)

content = content.replace(
    "const heroContent = (",
    "const heroContent = externalHeroContent || ("
)

content = content.replace(
    "const overviewContent = null;",
    "const overviewContent = externalOverviewContent || null;"
)

with open("src/components/dashboard/MusicScaleGuideCenter.tsx", "w") as f:
    f.write(content)

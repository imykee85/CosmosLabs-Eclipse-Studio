// Clerk's team (organization) screens are worded "organization" by default. Eclipse calls them teams.
export const clerkLocalization = {
  organizationSwitcher: {
    notSelected: "No team selected",
    action__createOrganization: "Create team",
    action__manageOrganization: "Manage team",
  },
  createOrganization: {
    title: "Create team",
    formButtonSubmit: "Create team",
  },
  organizationList: {
    createOrganization: "Create team",
    action__createOrganization: "Create team",
  },
  formFieldLabel__organizationName: "Team name",
  formFieldLabel__organizationSlug: "Team address",
  formFieldInputPlaceholder__organizationName: "Team name",
  formFieldInputPlaceholder__organizationSlug: "my-team",
  organizationProfile: {
    navbar: { title: "Team", description: "Manage your team.", general: "General", members: "Members" },
    start: { headerTitle__general: "General" },
    profilePage: {
      title: "Team profile",
      dangerSection: {
        title: "Danger",
        leaveOrganization: {
          title: "Leave team",
          messageLine1: "Are you sure you want to leave this team?",
          messageLine2: "You will lose access to its projects, files and credits.",
          successMessage: "You have left the team.",
          actionDescription: "Type {{organizationName}} below to continue.",
        },
        deleteOrganization: {
          title: "Delete team",
          messageLine1: "Are you sure you want to delete this team?",
          messageLine2: "This is permanent and cannot be undone.",
          actionDescription: "Type {{organizationName}} below to continue.",
        },
      },
    },
  },
};

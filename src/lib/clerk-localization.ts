// Clerk's team screens say "organization" by default. Eclipse calls them teams.
// Generated from Clerk's English wording (every string that contains the word, reworded, placeholders like {{organizationName}} untouched) plus a few hand-written lines.
export const clerkLocalization = {
  configureDirectorySync: {
    roleMappingStep: {
      enableDialog: {
        subtitle: "Members' team roles will be overwritten by the role mapped to their directory group, including roles that were assigned manually."
      }
    }
  },
  configureSSO: {
    connectionScopeBanner: {
      subtitle__adding: "This team already has {{count}} SSO connections.",
      subtitle__editing: "This team has {{count}} SSO connections. Changes here apply only to this connection."
    },
    missingManageEnterpriseConnectionsPermission: {
      subtitle: "Contact your team's administrator to upgrade your permissions."
    },
    organizationDomainsStep: {
      subtitle: "Add and verify ownership of the domains your team uses to sign in, then pick the ones this connection covers."
    }
  },
  createOrganization: {
    formButtonSubmit: "Create team",
    title: "Create team"
  },
  formFieldInputPlaceholder__organizationName: "Team name",
  organizationList: {
    action__createOrganization: "Create team",
    createOrganization: "Create team",
    titleWithoutPersonal: "Choose a team"
  },
  organizationProfile: {
    createDomainPage: {
      subtitle: "Add the domain to verify. Users with email addresses at this domain can join the team automatically or request to join."
    },
    membersPage: {
      invitationsTab: {
        autoInvitations: {
          headerSubtitle: "Invite users by connecting an email domain with your team. Anyone who signs up with a matching email domain will be able to join the team anytime."
        }
      },
      requestsTab: {
        autoSuggestions: {
          headerSubtitle: "Users who sign up with a matching email domain, will be able to see a suggestion to request to join your team."
        }
      }
    },
    navbar: {
      description: "Manage your team.",
      title: "Team"
    },
    plansPage: {
      alerts: {
        noPermissionsToManageBilling: "You do not have permissions to manage billing for this team.",
        planMembershipLimitExceeded: "Your team has {{count}} members (including pending invitations). This plan only allows {{limit}} members."
      }
    },
    profilePage: {
      dangerSection: {
        deleteOrganization: {
          messageLine1: "Are you sure you want to delete this team?",
          successMessage: "You have deleted the team.",
          title: "Delete team"
        },
        leaveOrganization: {
          messageLine1: "Are you sure you want to leave this team? You will lose access to this team and its applications.",
          successMessage: "You have left the team.",
          title: "Leave team"
        }
      },
      domainSection: {
        subtitle: "Allow users to join the team automatically or request to join based on a verified email domain."
      },
      successMessage: "The team has been updated."
    },
    removeDomainPage: {
      messageLine2: "Users won’t be able to join the team automatically after this."
    },
    securityPage: {
      directorySyncSection: {
        description: "Keep team members synced with your identity provider. Requires an SSO connection."
      },
      ssoBypassPage: {
        addForm: {
          error__memberNotFound: "No member of this team has that email address."
        },
        bulkResult: {
          notMember: "{{count}} members could not be added because they are no longer in the team.",
          notMember__one: "1 member could not be added because they are no longer in the team."
        }
      },
      ssoSection: {
        tooltip: "Members without a matching domain can still sign in using existing auth methods. New members will be assigned to {{role}} in this team."
      }
    },
    verifiedDomainPage: {
      enrollmentTab: {
        automaticInvitationOption__description: "Users are automatically invited to join the team when they sign-up and can join anytime.",
        automaticSuggestionOption__description: "Users receive a suggestion to request to join, but must be approved by an admin before they are able to join the team.",
        manualInvitationOption__description: "Users can only be invited manually to the team.",
        subtitle: "Choose how users from this domain can join the team."
      }
    }
  },
  organizationSwitcher: {
    action__closeOrganizationSwitcher: "Close team switcher",
    action__createOrganization: "Create team",
    action__openOrganizationSwitcher: "Open team switcher",
    notSelected: "No team selected"
  },
  signIn: {
    ssoBypass: {
      notice: "Your team requires single sign-on. Continuing without it is recorded."
    }
  },
  taskChooseOrganization: {
    alerts: {
      organizationAlreadyExists: "A team already exists for the detected company name ({{organizationName}}) and {{organizationDomain}}. Join by invitation."
    },
    chooseOrganization: {
      action__createOrganization: "Create new team",
      subtitle: "Join an existing team or create a new one",
      subtitle__createOrganizationDisabled: "Join an existing team",
      title: "Choose a team"
    },
    createOrganization: {
      formFieldInputPlaceholder__name: "My Team",
      formFieldInputPlaceholder__slug: "my-team",
      subtitle: "Enter your team details to continue",
      title: "Setup your team"
    },
    organizationCreationDisabled: {
      subtitle: "Contact your team admin for an invitation.",
      title: "You must belong to a team"
    }
  },
  unstable__errors: {
    already_a_member_in_organization: "{{email}} is already a member of the team.",
    insufficient_seats_change_plan: "Your team does not have enough seats to invite the desired number of members. Please change to a plan that supports the number of members you are attempting to invite.",
    insufficient_seats_contact_support: "Your team does not have enough seats to invite the desired number of members. Please contact support.",
    organization_membership_quota_exceeded: "You have reached your limit of team memberships, including outstanding invitations.",
    organization_not_found_or_unauthorized: "You are no longer a member of this team. Please choose or create another one.",
    organization_not_found_or_unauthorized_with_create_organization_disabled: "You are no longer a member of this team. Please choose another one."
  },
  formFieldLabel__organizationSlug: "Team address",
  formFieldInputPlaceholder__organizationSlug: "my-team"
};

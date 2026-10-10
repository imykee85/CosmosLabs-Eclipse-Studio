// Without Clerk keys the site runs in preview mode: pages render, sign-in is off.
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

import { ProfileForm } from './ProfileForm'

/**
 * First-run onboarding for register-mode users with no stored profile.
 * Visibility is controlled by the caller (shown while profile count is 0);
 * creating a profile invalidates the profiles query and dismisses it.
 */
export function OnboardingModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800 dark:text-gray-100">
          <span className="inline-block h-4 w-[3px] rounded-full bg-brand-500" />
          Add your first AWS profile
        </h3>
        <p className="mt-2 text-xs text-gray-500">
          To start issuing queries, provide AWS credentials. They are encrypted at
          rest and reused across sessions.
        </p>
        <div className="mt-4">
          <ProfileForm submitLabel="Create profile" />
        </div>
      </div>
    </div>
  )
}

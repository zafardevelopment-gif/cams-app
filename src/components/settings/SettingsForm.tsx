'use client'

import { useTransition } from 'react'
import { updateProfile, changePassword } from '@/actions/settings'
import { toast } from 'sonner'

interface ProfileField {
  label: string
  value: string
  name: string
  type: string
  readonly?: boolean
}

interface SettingsFormProps {
  profileFields: ProfileField[]
}

export function ProfileForm({ profileFields }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result.success) {
        toast.success('Profile updated successfully')
      } else {
        toast.error(result.error ?? 'Failed to update profile')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid-2">
        {profileFields.map((field) => (
          <div key={field.name} className="form-group">
            <label className="form-label">{field.label}</label>
            <input
              type={field.type}
              name={field.name}
              defaultValue={field.value}
              className="form-control"
              readOnly={field.readonly}
              disabled={field.readonly}
              style={field.readonly ? { background: 'var(--gray-50)', color: 'var(--gray-500)' } : undefined}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}

export function PasswordForm() {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const result = await changePassword(formData)
      if (result.success) {
        toast.success('Password updated successfully')
        form.reset()
      } else {
        toast.error(result.error ?? 'Failed to update password')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">New Password</label>
          <input type="password" name="new_password" className="form-control" placeholder="Min 8 characters" required />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm New Password</label>
          <input type="password" name="confirm_password" className="form-control" placeholder="Repeat new password" required />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={isPending}>
          {isPending ? 'Updating…' : 'Update Password'}
        </button>
      </div>
    </form>
  )
}

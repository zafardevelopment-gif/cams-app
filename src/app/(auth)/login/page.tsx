import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Sign In — CAMS' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = await searchParams
  return <LoginForm serverError={error} serverMessage={message} />
}

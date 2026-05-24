import { LoginForm } from './LoginForm';

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <div className="login-bg">
      <div className="login-card">
        <h1>Welcome back</h1>
        <p className="sub">Sign in to manage your outlet.</p>
        <LoginForm nextPromise={searchParams} />
      </div>
    </div>
  );
}

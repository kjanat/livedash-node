'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    if (res?.ok) router.push('/dashboard');
    else setError('Invalid credentials.');
  }

  return (
    <div className="max-w-md mx-auto mt-24 bg-white rounded-xl p-8 shadow">
      <h1 className="text-2xl font-bold mb-6">Login</h1>
      {error && <div className="text-red-600 mb-3">{error}</div>}
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          className="border px-3 py-2 rounded"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="border px-3 py-2 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="bg-blue-600 text-white rounded py-2" type="submit">
          Login
        </button>
      </form>
      <div className="mt-4 text-center">
        <a href="/register" className="text-blue-600 underline">
          Register company
        </a>
      </div>
      <div className="mt-2 text-center">
        <a href="/forgot-password" className="text-blue-600 underline">
          Forgot password?
        </a>
      </div>
    </div>
  );
}

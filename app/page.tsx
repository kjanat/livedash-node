import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../pages/api/auth/[...nextauth]';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect('/dashboard');
  else redirect('/login');
}

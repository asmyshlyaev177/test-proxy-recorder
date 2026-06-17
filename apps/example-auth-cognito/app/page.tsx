import { redirect } from 'next/navigation';

// No public landing page — send visitors to the login form.
export default function Home() {
  redirect('/login');
}

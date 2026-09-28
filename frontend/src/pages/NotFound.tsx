import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Bloch } from '@/components/quantum/Bloch';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <Bloch vector={{ x: 0, y: 0, z: -1 }} size={180} />
      <h1 className="mt-4 font-serif text-3xl font-semibold text-heading">404 · state not found</h1>
      <p className="mt-2 text-sm text-muted">This page collapsed to |1⟩. The route you requested does not exist.</p>
      <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-classical px-4 py-2 text-sm font-medium text-white">
        <Compass size={15} /> Back to home
      </Link>
    </div>
  );
}

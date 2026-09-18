'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Error al iniciar sesión');
        return;
      }

      // Force full page reload to ensure cookie is processed
      window.location.href = '/dashboard';
    } catch {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell variant="public">
      <div className="flex flex-col items-center justify-center px-4 py-section sm:px-6">
        <div className="w-full max-w-md">
          <Card className="p-8">
            <h1 className="mb-2 text-center text-3xl font-bold text-ink">{UI_COPY.brand}</h1>
            <p className="mb-8 text-center text-ink-muted">Iniciar sesión</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="email"
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
              />

              <Input
                id="password"
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />

              {error ? <ErrorState message={error} /> : null}

              <Button type="submit" disabled={loading} size="lg">
                {loading ? 'Cargando...' : 'Ingresar'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-ink-muted">
                ¿No tenés cuenta?{' '}
                <Link href="/register" className="font-medium text-brand hover:underline">
                  Registrate
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

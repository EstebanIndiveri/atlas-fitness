'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/states';
import { UI_COPY } from '@/lib/copy/ui';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Error al registrarse');
        return;
      }

      // Force full page reload to ensure cookie is processed
      window.location.href = '/dashboard/today';
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
            <p className="mb-8 text-center text-ink-muted">Crear cuenta</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                id="name"
                label="Nombre"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Tu nombre"
              />

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
                hint="Mínimo 8 caracteres, incluye mayúscula, minúscula y número"
              />

              <Input
                id="confirmPassword"
                label="Confirmar contraseña"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
              />

              {error ? <ErrorState message={error} /> : null}

              <Button type="submit" disabled={loading} size="lg">
                {loading ? 'Cargando...' : 'Crear cuenta'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-ink-muted">
                ¿Ya tenés cuenta?{' '}
                <Link href="/login" className="font-medium text-brand hover:underline">
                  Iniciá sesión
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

import React, { useMemo, useState } from 'react';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/custom/Button';

export default function EmailGateModal({
  isOpen,
  creatorName,
  onSubmitEmail,
  loading,
  serverError,
  onClearError,
}) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const isValidEmail = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative h-full w-full flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-athletic-lg overflow-hidden">
          <div className="p-4 md:p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Icon name="Mail" size={18} />
              <h2 className="text-lg font-semibold text-foreground">Join this team cart</h2>
            </div>
          </div>

          <div className="p-4 md:p-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              {creatorName ? (
                <><span className="font-medium text-foreground">{creatorName}</span> has invited you to their shared cart! 😋 <br></br>Your associated email is probably your <span className="font-medium">school/.edu</span> email.</>
              ) : (
                <>The organizer probably used their <span className="font-medium">.edu/school</span> email when sharing this link.</>
              )}{' '}
              
            </p>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Your email</label>
              <input
                autoFocus
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                onFocus={() => { setTouched(false); onClearError?.(); }}
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2
                  ${touched && !isValidEmail ? 'border-destructive ring-destructive/20' : 'border-border ring-primary/30'}
                  bg-background`}
                placeholder="you@school.edu"
              />
              {touched && !isValidEmail && (
                <p className="mt-1 text-xs text-destructive">Please enter a valid email.</p>
              )}
              {!!serverError && (
                <p className="mt-2 text-xs text-destructive">{serverError}</p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                We’ll use this to associate your choices with the team cart.
              </p>
            </div>
          </div>

          <div className="p-3 md:p-4 border-t border-border flex items-center justify-end gap-2">
            <Button
              onClick={() => onSubmitEmail(email.trim())}
              disabled={!isValidEmail || loading}
            >
              {loading ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

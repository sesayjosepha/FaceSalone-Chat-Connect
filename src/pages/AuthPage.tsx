import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, User, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type SignupMode = 'email' | 'phone';

export default function AuthPage() {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [signupMode, setSignupMode] = useState<SignupMode>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);

  const isPhoneNumber = (value: string) => /^\+?[0-9\s\-()]{7,}$/.test(value.trim());

  const phoneToEmail = (phone: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '');
    return `${cleaned}@phone.facesalone.app`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const identifier = loginIdentifier.trim();
        const actualEmail = isPhoneNumber(identifier) ? phoneToEmail(identifier) : identifier;
        await signIn(actualEmail, password);
        toast.success('Welcome back!');
      } else {
        if (!username.trim()) {
          toast.error('Username is required');
          setLoading(false);
          return;
        }
        if (signupMode === 'phone') {
          if (!phoneNumber.trim()) {
            toast.error('Phone number is required');
            setLoading(false);
            return;
          }
          const fakeEmail = phoneToEmail(phoneNumber);
          await signUp(fakeEmail, password, username, phoneNumber);
          toast.success('Account created! You can now sign in.');
        } else {
          if (!email.trim()) {
            toast.error('Email is required');
            setLoading(false);
            return;
          }
          await signUp(email, password, username, phoneNumber || undefined);
          toast.success('Account created! Please check your email to verify.');
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithOAuth("google");
    } catch (err: any) {
      toast.error('Google sign-in failed');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setResetting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password reset link sent! Check your email.');
      setShowReset(false);
      setResetEmail('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel p-8 w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="FaceSalone" className="w-20 h-20 object-contain" />
          <h1 className="text-2xl font-display font-bold text-foreground">FaceSalone</h1>
        </div>

        <p className="text-center text-muted-foreground mb-6">
          {isLogin ? 'Sign in to continue chatting' : 'Create your account'}
        </p>

        <Button variant="outline" className="w-full mb-4 border-glass-border hover:bg-secondary" onClick={handleGoogleSignIn}>
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-glass-border" /></div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">
              or sign {isLogin ? 'in' : 'up'} with {isLogin ? 'email or phone' : signupMode}
            </span>
          </div>
        </div>

        {/* Signup mode toggle - only shown during signup */}
        {!isLogin && (
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={signupMode === 'email' ? 'default' : 'outline'}
              className="flex-1 gap-2"
              size="sm"
              onClick={() => setSignupMode('email')}
            >
              <Mail className="w-4 h-4" />
              Email
            </Button>
            <Button
              type="button"
              variant={signupMode === 'phone' ? 'default' : 'outline'}
              className="flex-1 gap-2"
              size="sm"
              onClick={() => setSignupMode('phone')}
            >
              <Phone className="w-4 h-4" />
              Phone
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-10 bg-secondary border-glass-border" required />
            </div>
          )}

          {isLogin ? (
            /* Login: single field for email or phone */
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Email or phone number"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                className="pl-10 bg-secondary border-glass-border"
                required
              />
            </div>
          ) : signupMode === 'email' ? (
            /* Email signup */
            <>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-secondary border-glass-border" required />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="tel" placeholder="Phone number (optional)" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="pl-10 bg-secondary border-glass-border" />
              </div>
            </>
          ) : (
            /* Phone signup */
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="tel" placeholder="Phone number (e.g. +23276123456)" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="pl-10 bg-secondary border-glass-border" required />
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-secondary border-glass-border" required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isLogin ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>

        {isLogin && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            <button onClick={() => setShowReset(true)} className="text-primary hover:underline font-medium">
              Forgot password?
            </button>
          </p>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline font-medium">
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </p>

        {/* Password reset dialog */}
        {showReset && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-panel p-6 w-full max-w-sm space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Reset Password</h3>
              <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-10 bg-secondary border-glass-border"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowReset(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={resetting}>
                    {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Link'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Developer credits */}
        <div className="mt-6 pt-4 border-t border-glass-border text-center">
          <p className="text-xs text-muted-foreground">Developed by</p>
          <p className="text-sm font-semibold text-foreground">Joseph Abu Sesay</p>
          <p className="text-xs text-primary">FaceSalone IT Specialist</p>
        </div>
      </div>
    </div>
  );
}

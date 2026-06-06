import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/api/query-client';
import { RegistrationProvider } from '@/context/registration';
import { SessionProvider } from '@/context/session';

/** App-root provider composition: data layer + identity + registration draft. */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RegistrationProvider>{children}</RegistrationProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

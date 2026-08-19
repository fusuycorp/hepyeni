import { KeyRound, Mail, ShieldCheck, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserAuthMethods } from "@/lib/actions/auth";
import type { Translations } from "@/lib/i18n/types";

export function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function AppleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 170 170" fill="currentColor" aria-hidden="true">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.8-12-14.28-6.19-9.13-11.1-19.63-14.75-31.5-3.65-11.87-5.48-23.01-5.48-33.43 0-14.57 3.73-26.68 11.2-36.33 7.46-9.66 16.81-14.65 28.05-14.98 4.35 0 9.27 1.17 14.75 3.52 5.48 2.34 9.27 3.58 11.37 3.71 1.74-.13 5.79-1.42 12.16-3.87 6.37-2.45 11.64-3.52 15.8-3.21 11.87.65 21.32 4.9 28.37 12.74-10.23 6.19-15.24 14.89-15.02 26.09.22 8.7 3.48 16.09 9.78 22.18 6.3 6.09 13.92 9.56 22.83 10.43-1.74 5.22-3.8 10.43-6.19 15.65zM119.22 31.02c0-7.07 2.5-13.48 7.5-19.24 5-5.76 11.2-9.24 18.6-10.43.22 1.3.33 2.5.33 3.59 0 7.07-2.61 13.59-7.83 19.57-5.22 5.98-11.41 9.46-18.6 10.43z" />
    </svg>
  );
}

export function PasswordIcon({ className = "size-4" }: { className?: string }) {
  return <KeyRound className={className} aria-hidden="true" />;
}

export function EmailOtpIcon({ className = "size-4" }: { className?: string }) {
  return <Mail className={className} aria-hidden="true" />;
}

export interface AuthMethodHeaderBadgesProps {
  authMethods: UserAuthMethods;
  translations: Translations["profile"];
}

export function AuthMethodHeaderBadges({
  authMethods,
  translations,
}: AuthMethodHeaderBadgesProps) {
  const isGoogleConnected = authMethods.oauthProviders.includes("google");
  const isAppleConnected = authMethods.oauthProviders.includes("apple");

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {isGoogleConnected && (
        <Badge
          variant="secondary"
          className="text-[10px] gap-1 py-0 px-2 font-medium bg-secondary/80 border border-border/50 text-foreground"
        >
          <GoogleIcon className="size-3" />
          <span>{translations.badgeGoogle}</span>
        </Badge>
      )}

      {isAppleConnected && (
        <Badge
          variant="secondary"
          className="text-[10px] gap-1 py-0 px-2 font-medium bg-secondary/80 border border-border/50 text-foreground"
        >
          <AppleIcon className="size-3" />
          <span>{translations.badgeApple}</span>
        </Badge>
      )}

      {authMethods.hasPassword && (
        <Badge
          variant="outline"
          className="text-[10px] gap-1 py-0 px-2 font-normal text-muted-foreground border-border/70"
        >
          <PasswordIcon className="size-3" />
          <span>{translations.badgePassword}</span>
        </Badge>
      )}

      {authMethods.hasOtp && (
        <Badge
          variant="outline"
          className="text-[10px] gap-1 py-0 px-2 font-normal text-muted-foreground border-border/70"
        >
          <EmailOtpIcon className="size-3" />
          <span>{translations.badgeOtp}</span>
        </Badge>
      )}
    </div>
  );
}

export interface AuthMethodsCardProps {
  authMethods: UserAuthMethods;
  translations: Translations["profile"];
}

export function AuthMethodsCard({
  authMethods,
  translations,
}: AuthMethodsCardProps) {
  const isGoogleConnected = authMethods.oauthProviders.includes("google");
  const isAppleConnected = authMethods.oauthProviders.includes("apple");

  const methodsList = [
    {
      id: "google",
      name: translations.googleAuth,
      description: translations.googleAuthDesc,
      icon: GoogleIcon,
      connected: isGoogleConnected,
      isOAuth: true,
    },
    {
      id: "apple",
      name: translations.appleAuth,
      description: translations.appleAuthDesc,
      icon: AppleIcon,
      connected: isAppleConnected,
      isOAuth: true,
    },
    {
      id: "password",
      name: translations.passwordAuth,
      description: translations.passwordAuthDesc,
      icon: PasswordIcon,
      connected: authMethods.hasPassword,
      isOAuth: false,
    },
    {
      id: "otp",
      name: translations.otpAuth,
      description: translations.otpAuthDesc,
      icon: EmailOtpIcon,
      connected: authMethods.hasOtp,
      isOAuth: false,
    },
  ];

  return (
    <Card className="border-border/70 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <div>
            <CardTitle className="text-sm font-semibold">
              {translations.authMethodsTitle}
            </CardTitle>
            <CardDescription className="text-xs">
              {translations.authMethodsDesc}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden bg-card">
          {methodsList.map((method) => {
            const Icon = method.icon;
            return (
              <div
                key={method.id}
                className="flex items-center justify-between gap-3 p-3.5 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 border border-border/60 text-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium text-foreground truncate">
                      {method.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {method.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {method.isOAuth ? (
                    method.connected ? (
                      <Badge
                        variant="default"
                        className="text-[10px] gap-1 py-0.5 px-2 bg-emerald-600 text-white dark:bg-emerald-700 font-medium"
                      >
                        <Check className="size-2.5" />
                        <span>{translations.connected}</span>
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0.5 px-2 text-muted-foreground border-dashed border-border"
                      >
                        <span>{translations.notConnected}</span>
                      </Badge>
                    )
                  ) : method.connected ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] gap-1 py-0.5 px-2 font-medium"
                    >
                      <Check className="size-2.5 text-primary" />
                      <span>{translations.active}</span>
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] py-0.5 px-2 text-muted-foreground border-dashed border-border"
                    >
                      <span>{translations.notConnected}</span>
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

type AuthPageBackLink = {
  href: string;
  label: string;
};

type AuthPageProps = {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  backLink?: AuthPageBackLink;
  cardClassName?: string;
};

export function AuthPage({
  title,
  description,
  children,
  footer,
  backLink,
  cardClassName,
}: AuthPageProps) {
  return (
    <main className="app-page-shell auth-page-shell">
      <div className="auth-page-container">
        <section
          className={classNames("auth-card", cardClassName)}
          aria-labelledby="auth-page-title"
        >
          {backLink ? (
            <Link href={backLink.href} className="auth-back-link">
              <span aria-hidden="true">←</span>
              {backLink.label}
            </Link>
          ) : null}

          <header className="auth-card-header">
            <h1 id="auth-page-title" className="auth-card-title">
              {title}
            </h1>
            <p className="auth-card-description">{description}</p>
          </header>

          <div className="auth-card-content">{children}</div>

          {footer ? (
            <footer className="auth-card-footer">{footer}</footer>
          ) : null}
        </section>
      </div>
    </main>
  );
}

type AuthLinkProps = React.ComponentPropsWithoutRef<typeof Link>;

export function AuthLink({ className, ...props }: AuthLinkProps) {
  return <Link className={classNames("auth-link", className)} {...props} />;
}

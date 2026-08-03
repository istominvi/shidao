import { LandingPage } from "@/components/landing-page";
import { headers } from "next/headers";
import {
  LANDING_ONLY_SURFACE,
  PUBLIC_SURFACE_HEADER,
} from "@/lib/deployment-access";

export default async function Page() {
  const requestHeaders = await headers();
  const landingOnly =
    requestHeaders.get(PUBLIC_SURFACE_HEADER) === LANDING_ONLY_SURFACE;

  return <LandingPage landingOnly={landingOnly} />;
}

"use client";

import { UserButton } from "@clerk/nextjs";
import NotificationsSettings from "./NotificationsSettings";
import ContactSettings from "./ContactSettings";
import BillingSettings from "./BillingSettings";

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
  </svg>
);

const EnvelopeIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
  </svg>
);

const CreditCardIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
  </svg>
);

export default function UserButtonWithSettings() {
  return (
    <UserButton afterSignOutUrl="/">
      <UserButton.UserProfilePage
        label="Notifications"
        url="notifications"
        labelIcon={<BellIcon />}
      >
        <NotificationsSettings />
      </UserButton.UserProfilePage>
      <UserButton.UserProfilePage
        label="Billing"
        url="billing"
        labelIcon={<CreditCardIcon />}
      >
        <BillingSettings />
      </UserButton.UserProfilePage>
      <UserButton.UserProfilePage
        label="Contact Us"
        url="contact"
        labelIcon={<EnvelopeIcon />}
      >
        <ContactSettings />
      </UserButton.UserProfilePage>
    </UserButton>
  );
}

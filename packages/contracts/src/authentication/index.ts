export type RequestOtpPayload = { phone: string };
export type VerifyOtpPayload = { phone: string; otp: string };
export type AuthSession = {
  token: string;
  user: {
    id: string;
    phone: string;
    name?: string;
    role: 'CUSTOMER' | 'STAFF' | 'OWNER';
  };
  expiresAt: string;
};

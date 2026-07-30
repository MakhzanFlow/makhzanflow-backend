export interface UserResponse {
  id: string;
  name: string;
  email: string;
  is_verified: boolean;
  verified_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokensResponse {
  user: UserResponse;
}

export interface VerifyEmailResponse extends AuthTokensResponse {
  user: UserResponse;
}

import i18next from "i18next";
import * as middleware from "i18next-http-middleware";

const enAuth = {
  register: { success: "Account created. Please check your email to verify your account." },
  login: { success: "Logged in successfully" },
  verify: {
    success: "Email verified successfully. You can now log in.",
    resent: "Verification email sent. Please check your inbox.",
  },
  refresh: { success: "Session refreshed successfully" },
  logout: { success: "Logged out successfully" },
  profile: { success: "Profile loaded successfully" },
  errors: {
    validation: "Validation failed",
    emailExists: "An account with this email already exists",
    invalidCredentials: "Invalid email or password",
    emailNotVerified: "Please verify your email before logging in",
    invalidVerificationToken: "Invalid or expired verification token",
    alreadyVerified: "This email is already verified",
    emailNotFound: "No account found with this email",
    invalidRefreshToken: "Invalid or expired refresh token",
    tokenReuse: "Session compromised. Please log in again.",
    authenticationRequired: "Authentication required",
    accessTokenExpired: "Access token expired",
    invalidToken: "Invalid token",
    userNotFound: "User not found",
    rateLimit: "Too many requests. Please try again later.",
    unexpected: "Unexpected server error",
  },
};

const arAuth = {
  register: { success: "تم إنشاء الحساب. يرجى التحقق من بريدك الإلكتروني لتفعيل الحساب." },
  login: { success: "تم تسجيل الدخول بنجاح" },
  verify: {
    success: "تم تأكيد البريد الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول.",
    resent: "تم إرسال رسالة التحقق. يرجى مراجعة بريدك الإلكتروني.",
  },
  refresh: { success: "تم تحديث الجلسة بنجاح" },
  logout: { success: "تم تسجيل الخروج بنجاح" },
  profile: { success: "تم تحميل الملف الشخصي بنجاح" },
  errors: {
    validation: "فشل التحقق من البيانات",
    emailExists: "يوجد حساب مسجل بهذا البريد الإلكتروني",
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    emailNotVerified: "يرجى تأكيد البريد الإلكتروني قبل تسجيل الدخول",
    invalidVerificationToken: "رمز التحقق غير صالح أو منتهي الصلاحية",
    alreadyVerified: "هذا البريد الإلكتروني مؤكد بالفعل",
    emailNotFound: "لا يوجد حساب بهذا البريد الإلكتروني",
    invalidRefreshToken: "رمز تحديث الجلسة غير صالح أو منتهي الصلاحية",
    tokenReuse: "الجلسة غير آمنة. يرجى تسجيل الدخول مرة أخرى.",
    authenticationRequired: "المصادقة مطلوبة",
    accessTokenExpired: "انتهت صلاحية رمز الوصول",
    invalidToken: "الرمز غير صالح",
    userNotFound: "المستخدم غير موجود",
    rateLimit: "طلبات كثيرة جدًا. يرجى المحاولة لاحقًا.",
    unexpected: "حدث خطأ غير متوقع في الخادم",
  },
};

await i18next.use(middleware.LanguageDetector).init({
  fallbackLng: "en",
  preload: ["en", "ar"],
  ns: ["auth"],
  defaultNS: "auth",
  resources: {
    en: { auth: enAuth },
    ar: { auth: arAuth },
  },
  detection: {
    order: ["header", "querystring"],
    lookupHeader: "accept-language",
  },
});

export { i18next, middleware as i18nMiddleware };

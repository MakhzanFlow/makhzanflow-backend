import i18next from "i18next";
import * as middleware from "i18next-http-middleware";

const enProducts = {
  created: "Product created successfully",
  updated: "Product updated successfully",
  deleted: "Product deleted successfully",
  imageUploaded: "Image uploaded successfully",
  errors: {
    productNotFound: "Product not found",
    productHasInvoiceReferences: "Cannot delete product that is referenced in invoices",
    productSkuExists: "A product with this SKU already exists",
    productBarcodeExists: "A product with this barcode already exists",
    productDuplicate: "A product with these details already exists",
    invalidFileType: "Invalid file type. Allowed: jpg, jpeg, png, webp",
  },
};

const arProducts = {
  created: "تم إنشاء المنتج بنجاح",
  updated: "تم تحديث المنتج بنجاح",
  deleted: "تم حذف المنتج بنجاح",
  imageUploaded: "تم رفع الصورة بنجاح",
  errors: {
    productNotFound: "المنتج غير موجود",
    productHasInvoiceReferences: "لا يمكن حذف منتج مرتبط بالفواتير",
    productSkuExists: "يوجد منتج بنفس رمز SKU",
    productBarcodeExists: "يوجد منتج بنفس الباركود",
    productDuplicate: "يوجد منتج بنفس البيانات",
    invalidFileType: "نوع الملف غير صالح. الأنواع المسموحة: jpg, jpeg, png, webp",
  },
};

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
    invoiceNotFound: "Invoice not found",
    invoiceCanceled: "Cannot add payment to a canceled invoice",
    invoiceAlreadyCanceled: "Invoice is already canceled",
    invoiceAlreadyPaid: "Invoice is already fully paid",
    paymentExceedsTotal: "Payment amount cannot exceed invoice total",
    paymentExceedsRemaining: "Payment amount exceeds remaining amount",
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
    invoiceNotFound: "الفاتورة غير موجودة",
    invoiceCanceled: "لا يمكن إضافة دفعة لفاتورة ملغاة",
    invoiceAlreadyCanceled: "الفاتورة ملغاة بالفعل",
    invoiceAlreadyPaid: "الفاتورة مدفوعة بالكامل بالفعل",
    paymentExceedsTotal: "قيمة الدفعة لا يمكن أن تتجاوز إجمالي الفاتورة",
    paymentExceedsRemaining: "قيمة الدفعة تتجاوز المبلغ المتبقي",
  },
};

const enInvoices = {
  created: "Invoice created successfully",
  paymentAdded: "Payment added successfully",
  canceled: "Invoice canceled successfully",
};

const arInvoices = {
  created: "تم إنشاء الفاتورة بنجاح",
  paymentAdded: "تمت إضافة الدفعة بنجاح",
  canceled: "تم إلغاء الفاتورة بنجاح",
};

await i18next.use(middleware.LanguageDetector).init({
  fallbackLng: "en",
  preload: ["en", "ar"],
  ns: ["auth", "products", "invoices"],
  defaultNS: "auth",
  resources: {
    en: { auth: enAuth, products: enProducts, invoices: enInvoices },
    ar: { auth: arAuth, products: arProducts, invoices: arInvoices },
  },
  detection: {
    order: ["header", "querystring"],
    lookupHeader: "accept-language",
  },
});

export { i18next, middleware as i18nMiddleware };

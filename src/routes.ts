import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";
import companiesRoutes from "./modules/companies/company.routes.js";
import productsRoutes from "./modules/products/products.routes.js";
import customersRoutes from "./modules/customers/customers.routes.js";
import invoicesRoutes from "./modules/invoices/invoices.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";

const router = Router();

// Mounting modules
router.use("/auth", authRoutes);
router.use("/companies", companiesRoutes);
router.use("/products", productsRoutes);
router.use("/customers", customersRoutes);
router.use("/invoices", invoicesRoutes);
router.use("/dashboard", dashboardRoutes);
// router.use("/payments", paymentsRoutes);
// router.use("/subscriptions", subscriptionsRoutes);
// router.use("/reports", reportsRoutes);

export default router;

import { Router } from "express";
import authRoutes from "./modules/auth/auth.routes.js";

const router = Router();

// Mounting modules
router.use("/auth", authRoutes);

// The following modules will be registered as routes are developed:
// router.use("/users", usersRoutes);
// router.use("/companies", companiesRoutes);
// router.use("/products", productsRoutes);
// router.use("/inventory", inventoryRoutes);
// router.use("/customers", customersRoutes);
// router.use("/invoices", invoicesRoutes);
// router.use("/payments", paymentsRoutes);
// router.use("/subscriptions", subscriptionsRoutes);
// router.use("/reports", reportsRoutes);

export default router;

import { Router } from "express";
import { container } from "tsyringe";
import { DashboardController } from "./dashboard.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { scopeTenant } from "../../middleware/tenant.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  lowStockSchema,
  monthlyReportSchema,
  activitySchema,
} from "./dashboard.validation.js";

const dashboardController = container.resolve(DashboardController);
const router = Router();

router.use(authenticate, scopeTenant);

router.get("/stats", authorize("reports.read"), dashboardController.getStats);
router.get("/low-stock", authorize("reports.read"), validate(lowStockSchema), dashboardController.getLowStock);
router.get("/monthly-report", authorize("reports.read"), validate(monthlyReportSchema), dashboardController.getMonthlyReport);
router.get("/activity", authorize("reports.read"), validate(activitySchema), dashboardController.getActivity);

export default router;

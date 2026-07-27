import { Router } from "express";
import { container } from "tsyringe";
import { ActivityLogController } from "./activity-logs.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { scopeTenant } from "../../middleware/tenant.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";

const router = Router();
const activityLogController = container.resolve(ActivityLogController);

router.use(authenticate, scopeTenant);

router.get(
  "/:entity/:entityId",
  authorize("products.read"),
  (req, res, next) => activityLogController.getByEntity(req, res, next)
);

export default router;

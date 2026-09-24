import { Router } from "express";
import { container } from "tsyringe";
import { ActivityLogController } from "./activity-logs.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { scopeTenant } from "../../middleware/tenant.middleware.js";
import { authorizeActivityLog } from "../../middleware/activity-auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { activityLogParamsSchema } from "./activity-logs.validation.js";

const router = Router();
const activityLogController = container.resolve(ActivityLogController);

router.use(authenticate, scopeTenant);

router.get(
  "/:entity/:entityId",
  validate(activityLogParamsSchema),
  authorizeActivityLog(),
  (req, res, next) => activityLogController.getByEntity(req, res, next)
);

export default router;

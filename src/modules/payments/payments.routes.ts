import { Router } from "express";
import { container } from "tsyringe";
import { PaymentController } from "./payments.controller.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { scopeTenant } from "../../middleware/tenant.middleware.js";
import { authorize } from "../../middleware/authorize.middleware.js";
import { listPaymentsSchema } from "./payments.validation.js";

const paymentController = container.resolve(PaymentController);

const router = Router();

router.use(authenticate, scopeTenant);

router.get("/", authorize("payments.read"), validate(listPaymentsSchema), paymentController.list);

export default router;
